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
