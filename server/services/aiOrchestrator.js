// SessionPilot for REAPER - AI Orchestrator
// Rule-based intent classifier (no cloud LLM required for MVP).

const workflowService = require('./workflowService');

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
  {
    patterns: [/punch\s*in/i, /punch.*bar/i, /re-?record.*section/i, /drop\s*in/i],
    intent: 'prepare_punch_in', workflow: 'preparePunchIn', actionType: 'safe_action'
  },
  {
    patterns: [/organize.*track/i, /clean\s*up.*session/i, /folder.*track/i, /sort.*track/i],
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
        return { startBar: parseInt(rangeMatch[1], 10), endBar: parseInt(rangeMatch[2], 10) };
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

    default:
      return {};
  }
}

/**
 * Handle non-workflow (direct action) intents.
 */
async function handleDirectAction(bridge, matched, message) {
  const args = extractArgs(message, matched.intent);

  switch (matched.intent) {
    case 'arm_track': {
      const selected = await bridge.getSelectedTrack();
      if (!selected.ok || !selected.data) {
        return buildResponse("Select a track first and I'll arm it for you.", [], 'advice');
      }
      const trackName = selected.data.name || 'Track ' + selected.data.index;
      return buildResponse(
        `I'll arm "${trackName}" for recording. You're good to go.`,
        [{ type: 'armTrack', trackIndex: selected.data.index, label: `Arm "${trackName}"`, requiresConfirmation: false }],
        matched.actionType
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
        [{ type: 'disarmTrack', trackIndex: selected.data.index, label: `Disarm "${trackName}"`, requiresConfirmation: false }],
        matched.actionType
      );
    }

    case 'rename_track': {
      const selected = await bridge.getSelectedTrack();
      if (!selected.ok || !selected.data) {
        return buildResponse("Select the track you want to rename first.", [], 'advice');
      }
      if (!args.name) {
        return buildResponse("What do you want to call it? Say something like \"rename track to Lead Vocal\".", [], 'advice');
      }
      const oldName = selected.data.name || 'Track ' + selected.data.index;
      return buildResponse(
        `I'll rename "${oldName}" to "${args.name}".`,
        [{ type: 'renameTrack', trackIndex: selected.data.index, name: args.name, label: `Rename "${oldName}" to "${args.name}"`, requiresConfirmation: false }],
        matched.actionType
      );
    }

    case 'create_track': {
      const trackName = args.name || 'New Track';
      return buildResponse(
        `I'll create a new track called "${trackName}".`,
        [{ type: 'createTrack', name: trackName, label: `Create track "${trackName}"`, requiresConfirmation: false }],
        matched.actionType
      );
    }

    case 'duplicate_track': {
      const selected = await bridge.getSelectedTrack();
      if (!selected.ok || !selected.data) {
        return buildResponse("Select the track you want to duplicate first.", [], 'advice');
      }
      const trackName = selected.data.name || 'Track ' + selected.data.index;
      return buildResponse(
        `I'll duplicate "${trackName}" for you.`,
        [{ type: 'duplicateTrack', trackIndex: selected.data.index, label: `Duplicate "${trackName}"`, requiresConfirmation: false }],
        matched.actionType
      );
    }

    case 'insert_marker': {
      const markerName = args.name || 'Marker';
      return buildResponse(
        `I'll drop a marker called "${markerName}" at the current cursor position.`,
        [{ type: 'insertMarker', name: markerName, label: `Insert marker "${markerName}" at cursor`, requiresConfirmation: false }],
        matched.actionType
      );
    }

    case 'session_info': {
      const summary = await bridge.getProjectSummary();
      if (!summary.ok || !summary.data) {
        return buildResponse("Couldn't pull up the session info. Is REAPER running?", [], 'advice');
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
      return buildResponse(lines.join('\n'), [], 'advice');
    }

    case 'greeting': {
      return buildResponse(
        "Hey! I'm your session engineer. I can set up vocal tracks, prepare punch-ins, troubleshoot monitoring, organize your session \u2014 you name it. What are we working on?",
        [],
        'advice'
      );
    }

    default:
      return buildResponse(
        "I'm your recording engineer assistant. I can help set up vocal tracks, prepare punch-ins, diagnose monitoring issues, and organize your session. What do you need?",
        [],
        'advice'
      );
  }
}

/**
 * Build a standardized AssistantResponse object.
 */
function buildResponse(message, proposedActions, actionType, context) {
  return {
    message,
    proposedActions: proposedActions || [],
    requiresConfirmation: actionType === 'needs_confirmation' || (proposedActions || []).some(a => a.requiresConfirmation),
    actionType: actionType || 'advice',
    context: context || {}
  };
}

module.exports = {
  async processMessage(bridge, message) {
    // 1. Classify intent
    const matched = classifyIntent(message);

    // 2. Generate response based on intent
    if (!matched) {
      return buildResponse(
        "I'm your recording engineer assistant. I can help set up vocal tracks, prepare punch-ins, diagnose monitoring issues, and organize your session. What do you need?",
        [],
        'advice'
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
        { workflow: matched.workflow, args, checklist: wfResult.checklist, expectedOutcome: wfResult.expectedOutcome }
      );
    }

    // Handle direct action intents
    return await handleDirectAction(bridge, matched, message);
  }
};
