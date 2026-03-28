// SessionPilot for REAPER - AI Orchestrator
// Rule-based intent classifier for deterministic session commands.

const workflowService = require('./workflowService');

const DEFAULT_FALLBACK_MESSAGE =
  "I'm your recording engineer assistant. I can help set up vocal tracks, prepare punch-ins, diagnose monitoring issues, and organize your session. What do you need?";

// Intent patterns - array of { patterns: RegExp[], intent, workflow?, actionType }
const INTENT_PATTERNS = [
  // Vocal setup intents
  {
    patterns: [/set\s*(me\s*)?up.*vocal/i, /create.*lead\s*vocal/i, /new.*vocal\s*track/i, /record\s*vocals?/i, /vocal\s*setup/i],
    intent: 'setup_lead_vocal', workflow: 'setupLeadVocal', actionType: 'safe_action'
  },
  {
    patterns: [/lead.*double.*adlib/i, /vocal\s*stack/i, /doubles?\s*(and|&)\s*adlib/i, /full\s*vocal/i, /set\s*up.*(lead|double|adlib)/i, /make.*(lead|double|adlib)/i],
    intent: 'setup_vocal_stack', workflow: 'setupLeadDoubleAdlib', actionType: 'needs_confirmation'
  },
  // Quick punch loop (must be before preparePunchIn so "loop punch" matches here)
  {
    patterns: [/loop.*punch/i, /punch.*loop/i, /loop\s*record/i, /loop.*bar/i, /keep\s*loop/i, /nail\s*(this|it|the)\s*(part|section)/i, /loop\s*(the|this)/i],
    intent: 'quick_punch_loop', workflow: 'quickPunchLoop', actionType: 'safe_action'
  },
  {
    patterns: [/punch\s*in/i, /punch.*bar/i, /re-?record.*section/i, /drop\s*in/i],
    intent: 'prepare_punch_in', workflow: 'preparePunchIn', actionType: 'safe_action'
  },
  {
    patterns: [/organize.*track/i, /organize.*session/i, /clean\s*up.*session/i, /folder.*track/i, /sort.*track/i],
    intent: 'organize_session', workflow: 'organizeSessionTracks', actionType: 'needs_confirmation'
  },
  {
    patterns: [/color.*vocal/i, /color.*track/i, /color\s*code/i],
    intent: 'color_code', workflow: 'colorCodeVocals', actionType: 'safe_action'
  },

  // Troubleshooting
  {
    patterns: [/can'?t.*hear/i, /no\s*(sound|audio|signal)/i, /monitor/i, /hear\s*(my|the)\s*(voice|input|mic)/i, /why.*no\s*sound/i, /not\s*hearing/i],
    intent: 'diagnose_monitoring', workflow: 'diagnoseMonitoringIssue', actionType: 'advice'
  },
  {
    patterns: [/low\s*(input|level|volume|gain|signal)/i, /quiet/i, /too\s*low/i, /barely\s*hear/i, /weak\s*signal/i, /input.*low/i],
    intent: 'diagnose_low_input', workflow: 'diagnoseLowInputIssue', actionType: 'advice'
  },

  // Headphone / cue mix
  {
    patterns: [/headphone/i, /cue\s*mix/i, /hear\s*(myself|reverb).*while.*record/i, /monitor.*mix/i, /vocal.*reverb.*headphone/i],
    intent: 'setup_headphone_mix', workflow: 'setupHeadphoneMix', actionType: 'needs_confirmation'
  },

  // Comp takes
  {
    patterns: [/\bcomp\b/i, /comp.*take/i, /best\s*take/i, /pick.*take/i, /choose.*take/i, /review.*take/i, /which\s*take/i, /takes?\s*(on|for)/i, /show.*takes?/i],
    intent: 'comp_takes', workflow: 'compTakes', actionType: 'safe_action'
  },

  // Rough mix
  {
    patterns: [/rough\s*mix/i, /quick\s*mix/i, /balance.*vocals?/i, /pan.*double/i, /set.*levels?/i, /level.*vocal/i, /mix\s*it\s*quick/i],
    intent: 'rough_mix', workflow: 'roughMix', actionType: 'needs_confirmation'
  },

  // Mark song structure
  {
    patterns: [/mark.*structure/i, /song\s*structure/i, /section.*marker/i, /mark.*sections?/i, /verse.*chorus/i, /mark.*verse/i, /mark.*chorus/i, /mark.*bridge/i, /map.*song/i],
    intent: 'mark_song_structure', workflow: 'markSongStructure', actionType: 'safe_action'
  },

  // Session notes
  {
    patterns: [/session\s*note/i, /add\s*(a\s*)?note/i, /mark\s*this/i, /remember\s*this/i, /note\s*(here|at)/i, /flag\s*this/i, /bookmark/i],
    intent: 'session_notes', workflow: 'sessionNotes', actionType: 'safe_action'
  },

  // Preflight check
  {
    patterns: [/pre-?flight/i, /ready\s*to\s*record/i, /check.*setup/i, /everything\s*(good|ready|set)/i, /session\s*check/i, /before\s*(we|I)\s*record/i, /am\s*I\s*good/i],
    intent: 'preflight_check', workflow: 'preflightCheck', actionType: 'advice'
  },

  // FX chain management
  {
    patterns: [/fx\s*chain/i, /plug-?ins?/i, /effect/i, /add.*(?:comp|eq|reverb|delay)/i, /remove.*fx/i, /bypass.*fx/i, /show.*fx/i, /what.*fx/i, /manage.*fx/i],
    intent: 'manage_fx_chain', workflow: 'manageFxChain', actionType: 'needs_confirmation'
  },

  // Batch recording
  {
    patterns: [/batch\s*record/i, /multiple\s*songs?/i, /playlist\s*record/i, /song\s*list/i, /set\s*up\s*songs/i, /recording\s*session.*songs/i],
    intent: 'batch_recording', workflow: 'batchRecording', actionType: 'needs_confirmation'
  },

  // Export / bounce
  {
    patterns: [/\bexport\b/i, /\bbounce\b/i, /\brender\b/i, /mix\s*down/i, /\bstems?\b/i, /final\s*mix/i, /print.*mix/i],
    intent: 'export_bounce', workflow: 'exportBounce', actionType: 'needs_confirmation'
  },

  // MIDI composition (must be before transport so "play a scale" doesn't match transport_play)
  {
    patterns: [
      /chord\s*progression/i, /play\s*(some\s*)?chords/i, /write\s*(some\s*)?chords/i,
      /create\s*(a\s*)?chord\s*progression/i, /add\s*(a\s*)?chord\s*progression/i,
      /chords?\s*(with|using)\s/i, /progression\s*(with|using|in)\s/i,
      /chord\s*pattern/i
    ],
    intent: 'create_chord_progression', actionType: 'safe_action'
  },
  {
    patterns: [
      /scale\s*run/i, /play\s+.*\bscale\b/i, /write\s+.*\bscale\b/i,
      /create\s+.*\bscale\b/i, /add\s+.*\bscale\b/i,
      /run\s*(the\s*)?(major|minor|pentatonic|blues|chromatic|dorian|mixolydian)/i,
      /\b(major|minor|pentatonic|blues|dorian|mixolydian|lydian|phrygian)\s*scale/i
    ],
    intent: 'create_scale_run', actionType: 'safe_action'
  },
  {
    patterns: [
      /write\s*(some\s*)?midi\s*notes/i, /insert\s*midi\s*notes/i,
      /add\s*midi\s*notes/i, /create\s*midi\s*notes/i,
      /put\s*(some\s*)?notes\s*(on|in)/i, /write\s*notes\s/i
    ],
    intent: 'insert_midi_notes', actionType: 'safe_action'
  },

  // Transport controls (stop must be before play so "stop playback" doesn't match play)
  {
    patterns: [/\bstop\s*(play|record|it|the|every)?\b/i, /\bhit\s*stop\b/i, /\bstop\s*playback\b/i, /\bpress\s*stop\b/i],
    intent: 'transport_stop', actionType: 'safe_action'
  },
  {
    patterns: [/\bhit\s*play\b/i, /\bstart\s*play/i, /\bplay\s*(it|back|the)?\b/i, /\bplayback\b/i, /\bpress\s*play\b/i],
    intent: 'transport_play', actionType: 'safe_action'
  },
  {
    patterns: [/\bpause\s*(it|play|record)?\b/i, /\bhit\s*pause\b/i],
    intent: 'transport_pause', actionType: 'safe_action'
  },
  {
    patterns: [/\bstart\s*record/i, /\bhit\s*record\b/i, /\bpress\s*record\b/i, /\broll\s*tape\b/i, /\brecord\s*now\b/i, /\blet'?s?\s*record\b/i],
    intent: 'transport_record', actionType: 'safe_action'
  },
  {
    patterns: [/\bgo\s*to\s*(the\s*)?start\b/i, /\brewind\s*to\s*(the\s*)?(start|begin)/i, /\btop\s*of\s*(the\s*)?(song|project|session)\b/i, /\bgo\s*to\s*bar\s*1\b/i, /\bfrom\s*the\s*top\b/i],
    intent: 'transport_goto_start', actionType: 'safe_action'
  },
  {
    patterns: [/\bgo\s*to\s*(the\s*)?end\b/i, /\bjump\s*to\s*(the\s*)?end\b/i],
    intent: 'transport_goto_end', actionType: 'safe_action'
  },
  {
    patterns: [/\bgo\s*to\s*bar\s*(\d+)\b/i, /\bjump\s*to\s*bar\s*(\d+)\b/i, /\bbar\s*(\d+)\b/i],
    intent: 'transport_goto_bar', actionType: 'safe_action'
  },
  // Marker navigation ("go to chorus", "jump to verse 2")
  {
    patterns: [/\bgo\s*to\s*(the\s*)?(intro|verse|pre-?chorus|chorus|hook|bridge|outro|break|solo|interlude)/i, /\bjump\s*to\s*(the\s*)?(intro|verse|pre-?chorus|chorus|hook|bridge|outro|break|solo|interlude)/i, /\bgo\s*to\s*marker\s+/i, /\bjump\s*to\s*marker\s+/i],
    intent: 'goto_marker', actionType: 'safe_action'
  },

  // Volume / pan controls
  {
    patterns: [/\b(turn|set|bring)\s*(up|down)\s*(the\s*)?(volume|level|fader)/i, /\bvolume\b.*\b(up|down|\d)/i, /\b(louder|quieter|softer)\b/i, /\bset\s*(the\s*)?volume\b/i],
    intent: 'set_volume', actionType: 'safe_action'
  },
  {
    patterns: [/\bpan\s*(left|right|center|centre|\d)/i, /\bset\s*(the\s*)?pan\b/i, /\bpan\s*(it|the|this)/i],
    intent: 'set_pan', actionType: 'safe_action'
  },

  // Undo / redo
  { patterns: [/\bundo\b/i, /take\s*(that|it)\s*back/i, /reverse\s*(that|last)/i], intent: 'undo', actionType: 'safe_action' },
  { patterns: [/\bredo\b/i, /redo\s*(that|last)/i], intent: 'redo', actionType: 'safe_action' },

  // MIDI / instrument track creation (must be before generic create_track)
  {
    patterns: [/create\s*(a\s*)?midi\s*track/i, /new\s*midi\s*track/i, /add\s*(a\s*)?midi\s*track/i, /midi\s*track/i],
    intent: 'create_midi_track', actionType: 'safe_action'
  },
  {
    patterns: [/create\s*(an?\s*)?instrument\s*track/i, /new\s*instrument\s*track/i, /add\s*(an?\s*)?instrument/i, /load\s*(a\s*)?synth/i, /add\s*(a\s*)?synth/i],
    intent: 'create_instrument_track', actionType: 'safe_action'
  },

  // FX parameter control
  {
    patterns: [/set\s*(the\s*)?(eq|comp|reverb|delay|fx|plugin)\s*param/i, /tweak\s*(the\s*)?(eq|comp|reverb|delay|fx|plugin)/i, /adjust\s*(the\s*)?(eq|comp|reverb|delay|fx|plugin)/i, /(?:set|turn)\s*(the\s*)?(threshold|ratio|frequency|freq|gain|attack|release|feedback|mix|drive|time|decay|cutoff|resonance)\s*(?:to|at)/i],
    intent: 'set_fx_parameter', actionType: 'safe_action'
  },
  {
    patterns: [/show\s*(me\s*)?(the\s*)?param/i, /what.*param/i, /list\s*param/i, /get\s*(the\s*)?param/i, /show\s*(me\s*)?(the\s*)?knobs/i],
    intent: 'get_fx_parameters', actionType: 'advice'
  },

  // Session templates
  {
    patterns: [/save\s*(session\s*)?template/i, /save\s*(this\s*)?session\s*as/i, /snapshot\s*(the\s*)?session/i],
    intent: 'save_session_template', actionType: 'safe_action'
  },
  {
    patterns: [/load\s*(session\s*)?template/i, /restore\s*(session\s*)?template/i, /apply\s*template/i, /use\s*template/i],
    intent: 'load_session_template', actionType: 'needs_confirmation'
  },
  {
    patterns: [/list\s*(session\s*)?templates?/i, /show\s*(me\s*)?(session\s*)?templates?/i, /what\s*templates?/i, /my\s*templates?/i],
    intent: 'list_session_templates', actionType: 'advice'
  },

  // Simple track actions
  { patterns: [/arm\s*(the\s*)?track/i, /arm\s*it/i], intent: 'arm_track', actionType: 'safe_action' },
  { patterns: [/disarm/i, /un-?arm/i], intent: 'disarm_track', actionType: 'safe_action' },
  { patterns: [/rename.*track/i, /call\s*(it|the\s*track)/i], intent: 'rename_track', actionType: 'safe_action' },
  { patterns: [/create\s*(a\s*)?track/i, /new\s*track/i, /add\s*(a\s*)?track/i], intent: 'create_track', actionType: 'safe_action' },
  { patterns: [/duplicate/i, /copy\s*(the\s*)?track/i], intent: 'duplicate_track', actionType: 'safe_action' },
  { patterns: [/marker/i, /drop\s*(a\s*)?marker/i], intent: 'insert_marker', actionType: 'safe_action' },
  {
    patterns: [/what.*session/i, /session\s*(info|status|summary)/i, /project\s*(info|status|summary)/i, /show.*track/i],
    intent: 'session_info', actionType: 'advice'
  },

  // Greeting / help
  {
    patterns: [/^(hey|hi|hello|sup|yo)/i, /what\s*can\s*you\s*do/i, /help\s*me/i],
    intent: 'greeting', actionType: 'advice'
  }
];

/**
 * Classify the user's message into an intent.
 * Returns the first matching pattern entry or null.
 */
function classifyIntent(message) {
  for (const entry of INTENT_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(message)) {
        return entry;
      }
    }
  }
  return null;
}

/**
 * Extract relevant arguments from the message text based on intent.
 */
function extractArgs(message, intent) {
  switch (intent) {
    case 'prepare_punch_in': {
      // Parse bar numbers from "bars X to Y" or "bar X-Y"
      const rangeMatch = message.match(/bars?\s*(\d+)\s*(?:to|-)\s*(\d+)/i);
      if (rangeMatch) {
        let startBar = parseInt(rangeMatch[1], 10);
        let endBar = parseInt(rangeMatch[2], 10);
        if (startBar < 1) startBar = 1;
        if (endBar < 1) endBar = 1;
        if (startBar > endBar) { const tmp = startBar; startBar = endBar; endBar = tmp; }
        return { startBar, endBar };
      }
      const singleMatch = message.match(/bar\s*(\d+)/i);
      if (singleMatch) {
        return { startBar: parseInt(singleMatch[1], 10) };
      }
      return {};
    }

    case 'rename_track': {
      // Extract the new name from patterns like 'rename track to "X"' or 'call it X'
      const quotedMatch = message.match(/(?:rename.*?to|call\s*(?:it|the\s*track))\s*["'](.+?)["']/i);
      if (quotedMatch) return { name: quotedMatch[1] };
      const unquotedMatch = message.match(/(?:rename.*?to|call\s*(?:it|the\s*track))\s+(.+)/i);
      if (unquotedMatch) return { name: unquotedMatch[1].trim() };
      return {};
    }

    case 'create_track': {
      // Extract track name from patterns like 'create a track called X' or 'new track "X"'
      const calledMatch = message.match(/(?:create|new|add)\s*(?:a\s*)?track\s*(?:called|named)\s*["']?(.+?)["']?\s*$/i);
      if (calledMatch) return { name: calledMatch[1].trim() };
      const quotedMatch = message.match(/(?:create|new|add)\s*(?:a\s*)?track\s*["'](.+?)["']/i);
      if (quotedMatch) return { name: quotedMatch[1] };
      return {};
    }

    case 'insert_marker': {
      // Extract marker name
      const namedMatch = message.match(/marker\s*(?:called|named|:)?\s*["'](.+?)["']/i);
      if (namedMatch) return { name: namedMatch[1] };
      const labelMatch = message.match(/(?:drop\s*(?:a\s*)?)?marker\s+(.+)/i);
      if (labelMatch) return { name: labelMatch[1].trim() };
      return {};
    }

    case 'mark_song_structure': {
      // Parse section names and bar numbers, e.g. "verse at bar 9, chorus at 25, bridge at 33"
      const sections = [];
      const sectionPattern = /(intro|verse|pre-?chorus|chorus|hook|bridge|outro|break|solo|interlude)\s*(?:at\s*)?(?:bar\s*)?(\d+)/gi;
      let match;
      while ((match = sectionPattern.exec(message)) !== null) {
        sections.push({ name: match[1], bar: parseInt(match[2], 10) });
      }
      if (sections.length > 0) return { sections };
      return {};
    }

    case 'session_notes': {
      // Extract note text from the message
      const notePatterns = [
        /(?:session\s*note|add\s*(?:a\s*)?note|note\s*(?:here|at))[:\s]+["']?(.+?)["']?\s*$/i,
        /(?:mark\s*this|remember\s*this|flag\s*this|bookmark)[:\s]+["']?(.+?)["']?\s*$/i
      ];
      for (const pat of notePatterns) {
        const noteMatch = message.match(pat);
        if (noteMatch && noteMatch[1]) return { note: noteMatch[1].trim() };
      }
      return {};
    }

    case 'quick_punch_loop': {
      // Parse bar range like "bars X to Y" or "bar X-Y", and optional pre-roll
      const args = {};
      const rangeMatch = message.match(/bars?\s*(\d+)\s*(?:to|-)\s*(\d+)/i);
      if (rangeMatch) {
        args.startBar = parseInt(rangeMatch[1], 10);
        args.endBar = parseInt(rangeMatch[2], 10);
        if (args.startBar < 1) args.startBar = 1;
        if (args.endBar < 1) args.endBar = 1;
        if (args.startBar > args.endBar) { const tmp = args.startBar; args.startBar = args.endBar; args.endBar = tmp; }
      } else {
        const singleMatch = message.match(/bar\s*(\d+)/i);
        if (singleMatch) {
          args.startBar = parseInt(singleMatch[1], 10);
        }
      }
      // Extract pre-roll beats if mentioned, e.g. "2 beat pre-roll" or "pre-roll 4 beats"
      const preRollMatch = message.match(/(\d+)\s*beats?\s*pre-?roll|pre-?roll\s*(?:of\s*)?(\d+)\s*beats?/i);
      if (preRollMatch) {
        args.preRollBeats = parseInt(preRollMatch[1] || preRollMatch[2], 10);
      }
      return args;
    }

    case 'set_volume': {
      // Parse volume like "volume 80%", "volume to 0.5", "turn up", "louder"
      const pctMatch = message.match(/(\d+)\s*%/);
      if (pctMatch) return { volume: parseInt(pctMatch[1], 10) / 100 };
      const numMatch = message.match(/volume\s*(?:to\s*)?(\d+(?:\.\d+)?)/i);
      if (numMatch) return { volume: parseFloat(numMatch[1]) };
      if (/\b(up|louder)\b/i.test(message)) return { volumeDelta: 0.1 };
      if (/\b(down|quieter|softer)\b/i.test(message)) return { volumeDelta: -0.1 };
      return {};
    }

    case 'set_pan': {
      // Parse pan like "pan left", "pan right", "pan center", "pan -0.5", "pan 50% left"
      const pctPanMatch = message.match(/(\d+)\s*%?\s*(left|right)/i);
      if (pctPanMatch) {
        const val = parseInt(pctPanMatch[1], 10) / 100;
        return { pan: pctPanMatch[2].toLowerCase() === 'left' ? -val : val };
      }
      if (/\bcenter\b|\bcentre\b|\bmiddle\b/i.test(message)) return { pan: 0 };
      if (/\bleft\b/i.test(message)) return { pan: -1.0 };
      if (/\bright\b/i.test(message)) return { pan: 1.0 };
      const numPan = message.match(/pan\s*(?:to\s*)?(-?\d+(?:\.\d+)?)/i);
      if (numPan) return { pan: parseFloat(numPan[1]) };
      return {};
    }

    case 'transport_play':
    case 'transport_stop':
    case 'transport_pause':
    case 'transport_record':
    case 'transport_goto_start':
    case 'transport_goto_end':
    case 'comp_takes':
    case 'setup_headphone_mix': {
      const hpArgs = {};
      // Parse reverb type: "reverb ReaDelay", "with Valhalla", "use ReaVerbate"
      const reverbMatch = message.match(/(?:reverb|with|use)\s+["']?([A-Z][A-Za-z0-9_-]+)["']?/);
      if (reverbMatch) hpArgs.reverb = reverbMatch[1];
      // Parse volume: "at -3dB", "volume 50%", "cue level 0.3"
      const hpPctMatch = message.match(/(\d+)\s*%/);
      if (hpPctMatch) hpArgs.volume = parseInt(hpPctMatch[1], 10) / 100;
      const hpDbMatch = message.match(/-(\d+)\s*dB/i);
      if (hpDbMatch && !hpPctMatch) hpArgs.volume = Math.pow(10, -parseInt(hpDbMatch[1], 10) / 20);
      return hpArgs;
    }

    case 'rough_mix': {
      const rmArgs = {};
      // Parse lead volume: "lead at -2dB", "lead at 80%"
      const leadPct = message.match(/lead\s*(?:at|to)?\s*(\d+)\s*%/i);
      if (leadPct) rmArgs.leadVolume = parseInt(leadPct[1], 10) / 100;
      const leadDb = message.match(/lead\s*(?:at|to)?\s*-(\d+)\s*dB/i);
      if (leadDb && !leadPct) rmArgs.leadVolume = Math.pow(10, -parseInt(leadDb[1], 10) / 20);
      // Parse double pan: "pan doubles hard", "doubles wide", "doubles 80%"
      if (/\b(hard|wide|full)\b/i.test(message)) rmArgs.doublePan = 1.0;
      const dblPct = message.match(/doubles?\s*(?:at|to)?\s*(\d+)\s*%/i);
      if (dblPct) rmArgs.doublePan = parseInt(dblPct[1], 10) / 100;
      // Parse adlib volume: "adlibs at -6dB", "adlibs at 50%"
      const adPct = message.match(/adlib\s*(?:at|to)?\s*(\d+)\s*%/i);
      if (adPct) rmArgs.adlibVolume = parseInt(adPct[1], 10) / 100;
      const adDb = message.match(/adlib\s*(?:at|to)?\s*-(\d+)\s*dB/i);
      if (adDb && !adPct) rmArgs.adlibVolume = Math.pow(10, -parseInt(adDb[1], 10) / 20);
      return rmArgs;
    }

    case 'create_chord_progression': {
      const cpArgs = {};
      // Extract chord names: prefer "with/using" as delimiter, fall back to "chords:" or generic
      const withMatch = message.match(/(?:with|using)\s+(.+)/i);
      const colonMatch = !withMatch && message.match(/(?:chords?|progression)\s*[:]\s*(.+)/i);
      const chordSection = withMatch || colonMatch;
      if (chordSection) {
        const raw = chordSection[1]
          .replace(/\band\b/gi, ',')
          .replace(/\bthen\b/gi, ',')
          .split(/[,]+/)
          .map(s => s.trim())
          .filter(Boolean);
        cpArgs.chordNames = raw;
      } else {
        // Find chord-like tokens anywhere in the message
        const chordPattern = /\b([A-G][#b]?\s*(?:maj|min|m|dim|aug|sus|add|dom|7|9|11|13|major|minor|diminished|augmented|suspended)*(?:\d*)?)\b/gi;
        const found = [];
        let m;
        while ((m = chordPattern.exec(message)) !== null) {
          found.push(m[1].trim());
        }
        if (found.length > 0) cpArgs.chordNames = found;
      }
      // Beats per chord
      const bpcMatch = message.match(/(\d+)\s*beats?\s*(per|each)/i);
      if (bpcMatch) cpArgs.beatsPerChord = parseInt(bpcMatch[1], 10);
      if (/whole\s*notes?/i.test(message)) cpArgs.beatsPerChord = 4;
      if (/half\s*notes?/i.test(message)) cpArgs.beatsPerChord = 2;
      if (/quarter\s*notes?/i.test(message)) cpArgs.beatsPerChord = 1;
      // Octave
      const octMatch = message.match(/octave\s*(\d)/i);
      if (octMatch) cpArgs.octave = parseInt(octMatch[1], 10);
      // Velocity
      if (/\bsoft\b|\bquiet\b|\bpiano\b/i.test(message)) cpArgs.velocity = 60;
      if (/\bloud\b|\bhard\b|\bforte\b/i.test(message)) cpArgs.velocity = 120;
      const velMatch = message.match(/velocity\s*(\d+)/i);
      if (velMatch) cpArgs.velocity = parseInt(velMatch[1], 10);
      return cpArgs;
    }

    case 'create_scale_run': {
      const srArgs = {};
      // Normalize sharp/flat words before extraction (keep trailing space for regex)
      const normalizedMsg = message.replace(/\s*\bsharp\b/gi, '#').replace(/\s*\bflat\b/gi, 'b');
      // Extract scale name: "C major scale", "A minor pentatonic", "D dorian"
      // Note letter MUST be followed by a scale quality keyword to avoid matching "a" as article
      const scaleMatch = normalizedMsg.match(
        /\b([A-Ga-g][#b]?)\s+(minor\s*pentatonic|major\s*pentatonic|harmonic\s*minor|melodic\s*minor|whole\s*tone|major|minor|pentatonic|blues|chromatic|dorian|mixolydian|lydian|phrygian|locrian|aeolian|ionian|bebop)/i
      );
      if (scaleMatch) {
        srArgs.root = scaleMatch[1].charAt(0).toUpperCase() + scaleMatch[1].slice(1);
        srArgs.scaleType = scaleMatch[2].trim();
        srArgs.scaleName = `${srArgs.root} ${srArgs.scaleType}`;
      }
      const octMatch = message.match(/octave\s*(\d)/i);
      if (octMatch) srArgs.octave = parseInt(octMatch[1], 10);
      const bpnMatch = message.match(/(\d+)\s*beats?\s*(per|each)\s*note/i);
      if (bpnMatch) srArgs.beatsPerNote = parseInt(bpnMatch[1], 10);
      return srArgs;
    }

    case 'insert_midi_notes': {
      const mnArgs = {};
      const notePattern = /\b([A-G][#b]?\d)\b/gi;
      const found = [];
      let m;
      while ((m = notePattern.exec(message)) !== null) {
        found.push(m[1]);
      }
      if (found.length > 0) mnArgs.noteNames = found;
      return mnArgs;
    }

    case 'create_midi_track': {
      const nameMatch = message.match(/(?:midi\s*track|track)\s*(?:called|named)\s*["']?(.+?)["']?\s*$/i);
      if (nameMatch) return { name: nameMatch[1].trim() };
      const quotedMatch = message.match(/["'](.+?)["']/);
      if (quotedMatch) return { name: quotedMatch[1] };
      return {};
    }

    case 'create_instrument_track': {
      const args = {};
      // Extract instrument/synth name: "add a synth called ReaSynth" or "instrument track with Kontakt"
      const instrMatch = message.match(/(?:with|using|called|named|load)\s*["']?([A-Z][A-Za-z0-9_ -]+)["']?/i);
      if (instrMatch) args.instrument = instrMatch[1].trim();
      // Extract track name if separate from instrument
      const trackNameMatch = message.match(/track\s*(?:called|named)\s*["']?(.+?)["']?(?:\s*with|\s*$)/i);
      if (trackNameMatch) args.name = trackNameMatch[1].trim();
      return args;
    }

    case 'set_fx_parameter': {
      const args = {};
      // Extract parameter name: "set threshold to -20" or "turn the frequency to 5000"
      const paramMatch = message.match(/(?:set|tweak|adjust|turn)\s*(?:the\s*)?(threshold|ratio|frequency|freq|gain|attack|release|feedback|mix|drive|time|decay|cutoff|resonance|bandwidth|output|input|wet|dry)\s*(?:to|at)\s*(-?\d+(?:\.\d+)?)/i);
      if (paramMatch) {
        args.paramName = paramMatch[1];
        args.value = parseFloat(paramMatch[2]);
      }
      // Extract FX name context: "on the compressor" or "on ReaComp"
      const fxMatch = message.match(/(?:on|for|in)\s*(?:the\s*)?["']?([A-Za-z][A-Za-z0-9_ -]+)["']?/i);
      if (fxMatch) args.fxName = fxMatch[1].trim();
      return args;
    }

    case 'get_fx_parameters': {
      // Extract FX index or name
      const fxMatch = message.match(/(?:for|on|of)\s*(?:the\s*)?(?:fx\s*)?["']?([A-Za-z][A-Za-z0-9_ -]+)["']?/i);
      if (fxMatch) return { fxName: fxMatch[1].trim() };
      const idxMatch = message.match(/(?:fx|plugin|slot)\s*(\d+)/i);
      if (idxMatch) return { fxIndex: parseInt(idxMatch[1], 10) };
      return {};
    }

    case 'save_session_template': {
      // Extract template name: 'save template as "My Template"' or 'save template My Session'
      const quotedMatch = message.match(/(?:as|called|named)\s*["'](.+?)["']/i);
      if (quotedMatch) return { name: quotedMatch[1] };
      const unquotedMatch = message.match(/(?:as|called|named)\s+(.+)/i);
      if (unquotedMatch) return { name: unquotedMatch[1].trim() };
      return {};
    }

    case 'load_session_template': {
      // Extract template name or ID
      const quotedMatch = message.match(/(?:template|load|restore|apply|use)\s*["'](.+?)["']/i);
      if (quotedMatch) return { name: quotedMatch[1] };
      const unquotedMatch = message.match(/(?:load|restore|apply|use)\s*(?:session\s*)?template\s+(.+)/i);
      if (unquotedMatch) return { name: unquotedMatch[1].trim() };
      return {};
    }

    case 'list_session_templates':
      return {};

    case 'preflight_check':
    case 'manage_fx_chain':
    case 'undo':
    case 'redo':
      return {};

    case 'transport_goto_bar': {
      const barMatch = message.match(/bar\s*(\d+)/i);
      if (barMatch) return { bar: parseInt(barMatch[1], 10) };
      return {};
    }

    case 'goto_marker': {
      // Extract marker/section name like "go to chorus", "go to verse 2", "go to marker Bridge"
      const sectionMatch = message.match(/(?:go|jump)\s*to\s*(?:the\s*)?(intro|verse|pre-?chorus|chorus|hook|bridge|outro|break|solo|interlude)(?:\s*(\d+))?/i);
      if (sectionMatch) {
        const name = sectionMatch[2] ? `${sectionMatch[1]} ${sectionMatch[2]}` : sectionMatch[1];
        return { name };
      }
      const markerMatch = message.match(/(?:go|jump)\s*to\s*marker\s+["']?(.+?)["']?\s*$/i);
      if (markerMatch) return { name: markerMatch[1].trim() };
      return {};
    }

    case 'batch_recording': {
      const songMatch = message.match(/songs?[:\s]+(.+)/i);
      if (songMatch) {
        const songNames = songMatch[1].split(/,\s*/).map(s => s.trim().replace(/^["']|["']$/g, ''));
        return { songs: songNames.filter(Boolean).map(name => ({ name })) };
      }
      return {};
    }

    case 'export_bounce': {
      const a = {};
      if (/stems?\b/i.test(message)) a.mode = 'stems';
      else if (/all|everything/i.test(message)) a.mode = 'all';
      else a.mode = 'mix';
      return a;
    }

    default:
      return {};
  }
}

/**
 * Handle non-workflow (direct action) intents.
 */
async function handleDirectAction(bridge, matched, message) {
  const args = extractArgs(message, matched.intent);
  const baseContext = {
    route: 'rule_based',
    intent: matched.intent
  };

  switch (matched.intent) {
    case 'arm_track': {
      const selected = await bridge.getSelectedTrack();
      if (!selected.ok || !selected.data) {
        return buildResponse("Select a track first and I'll arm it for you.", [], 'advice');
      }
      const trackName = selected.data.name || 'Track ' + selected.data.index;
      return buildResponse(
        `I'll arm "${trackName}" for recording. You're good to go.`,
        [{
          type: 'armTrack',
          args: { trackIndex: selected.data.index },
          label: `Arm "${trackName}"`,
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'disarm_track': {
      const selected = await bridge.getSelectedTrack();
      if (!selected.ok || !selected.data) {
        return buildResponse("Select the track you want to disarm first.", [], 'advice');
      }
      const trackName = selected.data.name || 'Track ' + selected.data.index;
      return buildResponse(
        `I'll disarm "${trackName}" so it won't record.`,
        [{
          type: 'disarmTrack',
          args: { trackIndex: selected.data.index },
          label: `Disarm "${trackName}"`,
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'rename_track': {
      const selected = await bridge.getSelectedTrack();
      if (!selected.ok || !selected.data) {
        return buildResponse("Select the track you want to rename first.", [], 'advice', baseContext);
      }
      if (!args.name) {
        return buildResponse(
          "What do you want to call it? Say something like \"rename track to Lead Vocal\".",
          [],
          'advice',
          baseContext
        );
      }
      const oldName = selected.data.name || 'Track ' + selected.data.index;
      return buildResponse(
        `I'll rename "${oldName}" to "${args.name}".`,
        [{
          type: 'renameTrack',
          args: { trackIndex: selected.data.index, name: args.name },
          label: `Rename "${oldName}" to "${args.name}"`,
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'create_track': {
      const trackName = args.name || 'New Track';
      return buildResponse(
        `I'll create a new track called "${trackName}".`,
        [{
          type: 'createTrack',
          args: { name: trackName },
          label: `Create track "${trackName}"`,
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'duplicate_track': {
      const selected = await bridge.getSelectedTrack();
      if (!selected.ok || !selected.data) {
        return buildResponse("Select the track you want to duplicate first.", [], 'advice', baseContext);
      }
      const trackName = selected.data.name || 'Track ' + selected.data.index;
      return buildResponse(
        `I'll duplicate "${trackName}" for you.`,
        [{
          type: 'duplicateTrack',
          args: { trackIndex: selected.data.index },
          label: `Duplicate "${trackName}"`,
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'insert_marker': {
      const markerName = args.name || 'Marker';
      return buildResponse(
        `I'll drop a marker called "${markerName}" at the current cursor position.`,
        [{
          type: 'insertMarker',
          args: { name: markerName },
          label: `Insert marker "${markerName}" at cursor`,
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'transport_play': {
      return buildResponse(
        "Rolling playback.",
        [{
          type: 'play',
          args: {},
          label: 'Start playback',
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'transport_stop': {
      return buildResponse(
        "Stopping transport.",
        [{
          type: 'stop',
          args: {},
          label: 'Stop transport',
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'transport_pause': {
      return buildResponse(
        "Pausing transport.",
        [{
          type: 'pause',
          args: {},
          label: 'Pause transport',
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'transport_record': {
      return buildResponse(
        "Starting recording. Make sure your tracks are armed!",
        [{
          type: 'record',
          args: {},
          label: 'Start recording',
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'transport_goto_start': {
      return buildResponse(
        "Moving cursor to the top of the project.",
        [{
          type: 'goToStart',
          args: {},
          label: 'Go to project start',
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'transport_goto_end': {
      return buildResponse(
        "Moving cursor to the end of the project.",
        [{
          type: 'goToEnd',
          args: {},
          label: 'Go to project end',
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'transport_goto_bar': {
      const bar = args.bar;
      if (!bar) {
        return buildResponse("Which bar do you want to jump to?", [], 'advice', baseContext);
      }
      return buildResponse(
        `Moving cursor to bar ${bar}.`,
        [{
          type: 'goToPosition',
          args: { bar },
          label: `Go to bar ${bar}`,
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'goto_marker': {
      if (!args.name) {
        return buildResponse("Which marker or section? Say something like \"go to chorus\" or \"go to verse 2\".", [], 'advice', baseContext);
      }
      return buildResponse(
        `Navigating to "${args.name}".`,
        [{
          type: 'goToMarker',
          args: { name: args.name },
          label: `Go to "${args.name}"`,
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'set_volume': {
      const selected = await bridge.getSelectedTrack();
      if (!selected.ok || !selected.data) {
        return buildResponse("Select a track first to adjust its volume.", [], 'advice', baseContext);
      }
      const trackName = selected.data.name || 'Track ' + selected.data.index;
      let targetVolume = args.volume;
      if (targetVolume === undefined && args.volumeDelta !== undefined) {
        const currentVol = selected.data.volume !== undefined ? selected.data.volume : 1.0;
        targetVolume = Math.max(0, Math.min(2.0, currentVol + args.volumeDelta));
      }
      if (targetVolume === undefined) {
        return buildResponse("What volume level? Say something like \"volume 80%\" or \"turn up\".", [], 'advice', baseContext);
      }
      const pctDisplay = Math.round(targetVolume * 100);
      return buildResponse(
        `Setting "${trackName}" volume to ${pctDisplay}%.`,
        [{
          type: 'setTrackVolume',
          args: { trackIndex: selected.data.index, volume: targetVolume },
          label: `Set "${trackName}" volume to ${pctDisplay}%`,
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'set_pan': {
      const selected = await bridge.getSelectedTrack();
      if (!selected.ok || !selected.data) {
        return buildResponse("Select a track first to adjust its pan.", [], 'advice', baseContext);
      }
      const trackName = selected.data.name || 'Track ' + selected.data.index;
      const panVal = args.pan;
      if (panVal === undefined) {
        return buildResponse("Which direction? Say \"pan left\", \"pan right\", or \"pan center\".", [], 'advice', baseContext);
      }
      const panLabel = panVal === 0 ? 'center' : panVal < 0 ? `${Math.round(Math.abs(panVal) * 100)}% left` : `${Math.round(panVal * 100)}% right`;
      return buildResponse(
        `Panning "${trackName}" ${panLabel}.`,
        [{
          type: 'setTrackPan',
          args: { trackIndex: selected.data.index, pan: panVal },
          label: `Pan "${trackName}" ${panLabel}`,
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'undo': {
      return buildResponse(
        "I'll undo the last action in REAPER.",
        [{
          type: 'undo',
          args: {},
          label: 'Undo last action',
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'redo': {
      return buildResponse(
        "I'll redo the last undone action.",
        [{
          type: 'redo',
          args: {},
          label: 'Redo last action',
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'session_info': {
      const summary = await bridge.getProjectSummary();
      if (!summary.ok || !summary.data) {
        return buildResponse("Couldn't pull up the session info. Is REAPER running?", [], 'advice', baseContext);
      }
      const s = summary.data;
      const lines = [
        `Here's what we're working with:`,
        ``,
        `Project: ${s.name || 'Untitled'}`,
        `Tracks: ${s.trackCount || 0}`,
        `BPM: ${s.bpm || '?'}`,
        `Time Signature: ${s.timeSignature || '?'}`,
        `Sample Rate: ${s.sampleRate ? (s.sampleRate / 1000) + ' kHz' : '?'}`,
        `Length: ${s.length || '?'}`,
        `File: ${s.filePath || 'Not saved yet'}`
      ];
      return buildResponse(lines.join('\n'), [], 'advice', baseContext);
    }

    case 'greeting': {
      return buildResponse(
        "Hey! I'm your session engineer. I can set up vocal tracks, prepare punch-ins, troubleshoot monitoring, organize your session \u2014 you name it. What are we working on?",
        [],
        'advice',
        baseContext
      );
    }

    case 'create_chord_progression': {
      const musicTheory = require('./musicTheory');

      if (!args.chordNames || args.chordNames.length === 0) {
        return buildResponse(
          "What chords do you want? Try: \"chord progression with C, Am, F, G\" or \"chords using C major and E minor\".",
          [], 'advice', baseContext
        );
      }

      let normalizedChords;
      try {
        normalizedChords = args.chordNames.map(name => musicTheory.normalizeChordName(name));
        normalizedChords.forEach(name => musicTheory.resolveChord(name, args.octave || 4));
      } catch (e) {
        return buildResponse(
          `Couldn't resolve one of those chords: ${e.message}. Try standard names like C, Am, Dm7, G7.`,
          [], 'advice', baseContext
        );
      }

      const progression = musicTheory.buildChordProgression(normalizedChords, {
        octave: args.octave || 4,
        beatsPerChord: args.beatsPerChord || 4,
        velocity: args.velocity || 96,
        channel: 0
      });

      const allNotes = musicTheory.flattenProgression(progression);
      const chordDisplay = progression.map(c => c.displayName).join(' — ');
      const totalBeats = progression.reduce((sum, c) => sum + c.durationQN, 0);

      const selected = await bridge.getSelectedTrack();
      const hasTrack = selected.ok && selected.data;
      const trackDesc = hasTrack
        ? `on "${selected.data.name || 'Track ' + selected.data.index}"`
        : 'on a new MIDI track';

      const actions = [];
      if (!hasTrack) {
        actions.push({
          type: 'createMidiTrack',
          args: { name: 'Chords' },
          label: 'Create MIDI track "Chords"',
          requiresConfirmation: false
        });
      }
      actions.push({
        type: 'insertMidiNotes',
        args: {
          target: hasTrack ? 'selected' : undefined,
          notes: allNotes,
          itemName: `Chords: ${chordDisplay}`,
          startPositionQN: null
        },
        label: `Write ${chordDisplay} (${allNotes.length} notes, ${totalBeats} beats)`,
        requiresConfirmation: false
      });

      return buildResponse(
        `I'll write a **${chordDisplay}** chord progression ${trackDesc} — ${allNotes.length} notes across ${totalBeats} beats.`,
        actions,
        matched.actionType,
        baseContext
      );
    }

    case 'create_scale_run': {
      const musicTheory = require('./musicTheory');

      if (!args.scaleName) {
        return buildResponse(
          "Which scale? Try \"C major scale\", \"A minor pentatonic\", or \"D dorian\".",
          [], 'advice', baseContext
        );
      }

      let scaleNotes;
      try {
        scaleNotes = musicTheory.buildScaleRun(args.scaleName, {
          octave: args.octave || 4,
          beatsPerNote: args.beatsPerNote || 1,
          velocity: args.velocity || 80,
          channel: 0
        });
      } catch (e) {
        return buildResponse(
          `Couldn't resolve that scale: ${e.message}. Try \"C major\", \"A minor pentatonic\", etc.`,
          [], 'advice', baseContext
        );
      }

      const allNotes = musicTheory.flattenNoteSequence(scaleNotes);
      const selected = await bridge.getSelectedTrack();
      const hasTrack = selected.ok && selected.data;
      const trackDesc = hasTrack ? `on "${selected.data.name}"` : 'on a new MIDI track';

      const actions = [];
      if (!hasTrack) {
        actions.push({
          type: 'createMidiTrack',
          args: { name: args.scaleName + ' Scale' },
          label: `Create MIDI track "${args.scaleName} Scale"`,
          requiresConfirmation: false
        });
      }
      actions.push({
        type: 'insertMidiNotes',
        args: {
          target: hasTrack ? 'selected' : undefined,
          notes: allNotes,
          itemName: `${args.scaleName} Scale Run`
        },
        label: `Write ${args.scaleName} scale (${allNotes.length} notes)`,
        requiresConfirmation: false
      });

      return buildResponse(
        `I'll write a **${args.scaleName}** scale run ${trackDesc} — ${allNotes.length} notes.`,
        actions,
        matched.actionType,
        baseContext
      );
    }

    case 'insert_midi_notes': {
      const musicTheory = require('./musicTheory');

      if (!args.noteNames || args.noteNames.length === 0) {
        return buildResponse(
          "Which notes? Specify like \"C4 E4 G4\" or \"notes D3, F#3, A3\".",
          [], 'advice', baseContext
        );
      }

      let allNotes;
      try {
        allNotes = musicTheory.buildMelodyFromNotes(args.noteNames).map(n => ({
          pitch: n.pitch, velocity: n.velocity, channel: n.channel,
          startQN: n.startQN, durationQN: n.durationQN
        }));
      } catch (e) {
        return buildResponse(
          `Couldn't resolve those notes: ${e.message}. Use format like C4, E4, G4.`,
          [], 'advice', baseContext
        );
      }

      const selected = await bridge.getSelectedTrack();
      const hasTrack = selected.ok && selected.data;

      return buildResponse(
        `I'll write ${allNotes.length} MIDI notes: ${args.noteNames.join(', ')}.`,
        [{
          type: 'insertMidiNotes',
          args: {
            target: hasTrack ? 'selected' : undefined,
            notes: allNotes,
            itemName: 'MIDI Notes'
          },
          label: `Insert ${allNotes.length} MIDI notes`,
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'create_midi_track': {
      const trackName = args.name || 'MIDI Track';
      return buildResponse(
        `I'll create a new MIDI track called "${trackName}".`,
        [{
          type: 'createMidiTrack',
          args: { name: trackName },
          label: `Create MIDI track "${trackName}"`,
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'create_instrument_track': {
      const trackName = args.name || (args.instrument ? args.instrument : 'Instrument Track');
      const instrument = args.instrument || null;
      const desc = instrument
        ? `I'll create an instrument track "${trackName}" with ${instrument}.`
        : `I'll create an instrument track called "${trackName}". You can load a plugin on it afterwards.`;
      return buildResponse(
        desc,
        [{
          type: 'createMidiTrack',
          args: { name: trackName, instrument },
          label: `Create instrument track "${trackName}"`,
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'get_fx_parameters': {
      const selected = await bridge.getSelectedTrack();
      if (!selected.ok || !selected.data) {
        return buildResponse("Select a track first so I can show its FX parameters.", [], 'advice', baseContext);
      }
      const trackName = selected.data.name || 'Track ' + selected.data.index;
      const fxList = selected.data.fxNames || [];
      if (fxList.length === 0) {
        return buildResponse(`"${trackName}" has no FX loaded. Add some plugins first!`, [], 'advice', baseContext);
      }
      // Determine which FX to show params for
      let fxIndex = 0;
      if (args.fxIndex !== undefined) {
        fxIndex = args.fxIndex;
      } else if (args.fxName) {
        const idx = fxList.findIndex(name => name.toLowerCase().includes(args.fxName.toLowerCase()));
        if (idx >= 0) fxIndex = idx;
      }
      const fxName = fxList[fxIndex] || `FX ${fxIndex}`;
      try {
        const paramResult = await bridge.getFxParameters({ trackId: selected.data.id, fxIndex });
        const params = (paramResult.data && paramResult.data.params) || [];
        const lines = [`**${fxName}** on "${trackName}" — ${params.length} parameters:\n`];
        params.slice(0, 20).forEach((p, i) => {
          lines.push(`  ${i}. **${p.name}**: ${p.formattedValue || (p.value !== undefined ? p.value.toFixed(2) : '?')} (${p.minValue ?? p.min ?? 0}–${p.maxValue ?? p.max ?? 1})`);
        });
        if (params.length > 20) lines.push(`  ...and ${params.length - 20} more`);
        return buildResponse(lines.join('\n'), [], 'advice', baseContext);
      } catch (e) {
        return buildResponse(`Couldn't read parameters for ${fxName}: ${e.message}`, [], 'advice', baseContext);
      }
    }

    case 'set_fx_parameter': {
      const selected = await bridge.getSelectedTrack();
      if (!selected.ok || !selected.data) {
        return buildResponse("Select a track first so I can adjust its FX.", [], 'advice', baseContext);
      }
      if (!args.paramName || args.value === undefined) {
        return buildResponse(
          "Tell me what to adjust, like \"set threshold to -20\" or \"turn the frequency to 5000\".",
          [], 'advice', baseContext
        );
      }
      const trackName = selected.data.name || 'Track ' + selected.data.index;
      return buildResponse(
        `Setting ${args.paramName} to ${args.value} on "${trackName}".`,
        [{
          type: 'setFxParameter',
          args: {
            trackIndex: selected.data.index,
            fxName: args.fxName || null,
            paramName: args.paramName,
            value: args.value
          },
          label: `Set ${args.paramName} to ${args.value}`,
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'save_session_template': {
      const templateName = args.name || null;
      if (!templateName) {
        return buildResponse(
          "What should I call this template? Say something like: save template as \"My Vocal Session\".",
          [], 'advice', baseContext
        );
      }
      return buildResponse(
        `I'll save the current session as template "${templateName}".`,
        [{
          type: 'saveSessionTemplate',
          args: { name: templateName },
          label: `Save session template "${templateName}"`,
          requiresConfirmation: false
        }],
        matched.actionType,
        baseContext
      );
    }

    case 'load_session_template': {
      if (!args.name) {
        return buildResponse(
          "Which template do you want to load? Say something like: load template \"My Vocal Session\".",
          [], 'advice', baseContext
        );
      }
      return buildResponse(
        `I'll load the "${args.name}" template. This will create tracks, markers, and regions from the template.`,
        [{
          type: 'loadSessionTemplate',
          args: { name: args.name },
          label: `Load template "${args.name}"`,
          requiresConfirmation: true
        }],
        'needs_confirmation',
        baseContext
      );
    }

    case 'list_session_templates': {
      try {
        const templateService = require('./templateService');
        const templates = await templateService.listTemplates();
        if (templates.length === 0) {
          return buildResponse("No saved templates yet. Save one with: save template as \"My Session\".", [], 'advice', baseContext);
        }
        const lines = [`You have **${templates.length}** saved template(s):\n`];
        templates.forEach(t => {
          lines.push(`  - **${t.name}** (${t.trackCount} tracks, ${t.markerCount} markers) — ${t.description || 'no description'}`);
        });
        return buildResponse(lines.join('\n'), [], 'advice', baseContext);
      } catch (e) {
        return buildResponse(`Couldn't list templates: ${e.message}`, [], 'advice', baseContext);
      }
    }

    default:
      return buildResponse(DEFAULT_FALLBACK_MESSAGE, [], 'advice', baseContext);
  }
}

/**
 * Build a standardized AssistantResponse object.
 */
function buildResponse(message, proposedActions, actionType, context) {
  const normalizedContext = context ? { ...context } : {};
  if (!normalizedContext.workflow && !normalizedContext.actionType && proposedActions && proposedActions.length === 1) {
    const [firstAction] = proposedActions;
    if (firstAction && firstAction.type) {
      normalizedContext.actionType = firstAction.type;
      normalizedContext.args = firstAction.args || {};
    }
  }

  return {
    message,
    proposedActions: proposedActions || [],
    requiresConfirmation: actionType === 'needs_confirmation' || (proposedActions || []).some(a => a.requiresConfirmation),
    actionType: actionType || 'advice',
    context: normalizedContext
  };
}

module.exports = {
  DEFAULT_FALLBACK_MESSAGE,
  classifyIntent,
  extractArgs,
  buildResponse,

  async processMessage(bridge, message, options = {}) {
    // 1. Classify intent
    const matched = options.matchedIntent || classifyIntent(message);

    // 2. Generate response based on intent
    if (!matched) {
      return buildResponse(
        DEFAULT_FALLBACK_MESSAGE,
        [],
        'advice',
        {
          route: 'fallback',
          intent: null
        }
      );
    }

    // Handle workflow-based intents
    if (matched.workflow) {
      const args = extractArgs(message, matched.intent);
      const preview = await workflowService.previewWorkflow(bridge, matched.workflow, args);
      if (!preview.ok) {
        return buildResponse(`Had trouble with that: ${preview.error}`, [], 'advice');
      }
      const wfResult = preview.data;
      return buildResponse(
        wfResult.summary,
        wfResult.proposedActions,
        matched.actionType,
        {
          route: 'rule_based',
          intent: matched.intent,
          workflow: matched.workflow,
          args,
          checklist: wfResult.checklist,
          expectedOutcome: wfResult.expectedOutcome
        }
      );
    }

    // Handle direct action intents
    return await handleDirectAction(bridge, matched, message);
  }
};
