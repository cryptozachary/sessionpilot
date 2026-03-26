const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'quickPunchLoop',
  description: 'Set up a loop region around a problem section with pre-roll for seamless punch-in recording.',

  async preview(bridge, args = {}) {
    const { startBar, endBar, trackId, preRollBeats = 4 } = args;
    const trackLabel = trackId ? `track ${trackId}` : 'the selected track';

    const proposedActions = [
      {
        id: uuidv4(),
        type: 'setTimeSelection',
        label: `Set time selection: bars ${startBar}-${endBar}`,
        description: `Set the time selection to span from bar ${startBar} to bar ${endBar}.`,
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { startBar, endBar }
      },
      {
        id: uuidv4(),
        type: 'setLoopPoints',
        label: `Set loop points: bars ${startBar}-${endBar}`,
        description: `Enable loop playback over bars ${startBar} to ${endBar} for repeated punch-in takes.`,
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { startBar, endBar }
      },
      {
        id: uuidv4(),
        type: 'enablePreRoll',
        label: `Enable pre-roll (${preRollBeats} beats)`,
        description: `Add ${preRollBeats}-beat pre-roll so you hear context before the punch-in point.`,
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { beats: preRollBeats }
      },
      {
        id: uuidv4(),
        type: 'armTrack',
        label: `Arm ${trackLabel} for recording`,
        description: `Arm ${trackLabel} so it captures new takes during each loop pass.`,
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { trackId: trackId || null }
      },
      {
        id: uuidv4(),
        type: 'toggleMonitoring',
        label: `Enable monitoring on ${trackLabel}`,
        description: `Turn on input monitoring so you can hear yourself during the punch loop.`,
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { trackId: trackId || null }
      },
      {
        id: uuidv4(),
        type: 'setAutoFade',
        label: `Enable auto-crossfade on ${trackLabel}`,
        description: `Enable automatic crossfades so each new take blends smoothly at punch boundaries.`,
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { trackId: trackId || null }
      }
    ];

    return {
      workflow: 'quickPunchLoop',
      summary: `Loop punch setup: bars ${startBar}-${endBar} with ${preRollBeats}-beat pre-roll. Hit record and loop until you nail it.`,
      requiresConfirmation: false,
      proposedActions,
      checklist: [
        'Time selection set',
        'Loop enabled',
        `Pre-roll active (${preRollBeats} beats)`,
        'Track armed',
        'Monitoring on',
        'Auto-crossfade enabled',
        'Tip: Press record and loop — stop when you\'re happy'
      ],
      expectedOutcome: 'Loop armed and ready. Each pass automatically creates a new take with crossfade.'
    };
  },

  async execute(bridge, args = {}) {
    const executedActions = [];
    const { startBar, endBar, preRollBeats = 4 } = args;

    const selectedTrackResult = await bridge.getSelectedTrack();
    const resolvedTrackId = args.trackId || (selectedTrackResult.data && selectedTrackResult.data.id);

    // Set time selection
    try {
      await bridge.setTimeSelection({ startBar, endBar });
      executedActions.push({ action: 'setTimeSelection', startBar, endBar });
    } catch (err) {
      executedActions.push({ action: 'setTimeSelection', note: 'Failed: ' + err.message });
    }

    // Set loop points
    try {
      await bridge.setLoopPoints({ startBar, endBar });
      executedActions.push({ action: 'setLoopPoints', startBar, endBar });
    } catch (err) {
      executedActions.push({ action: 'setLoopPoints', note: 'Failed: ' + err.message });
    }

    // Enable pre-roll
    try {
      await bridge.enablePreRoll({ beats: preRollBeats });
      executedActions.push({ action: 'enablePreRoll', beats: preRollBeats });
    } catch (err) {
      executedActions.push({ action: 'enablePreRoll', note: 'Failed: ' + err.message });
    }

    // Arm the track
    try {
      await bridge.armTrack({ trackId: resolvedTrackId });
      executedActions.push({ action: 'armTrack', trackId: resolvedTrackId });
    } catch (err) {
      executedActions.push({ action: 'armTrack', note: 'Failed: ' + err.message });
    }

    // Enable monitoring
    try {
      await bridge.toggleMonitoring({ trackId: resolvedTrackId, enabled: true });
      executedActions.push({ action: 'toggleMonitoring', trackId: resolvedTrackId, enabled: true });
    } catch (err) {
      executedActions.push({ action: 'toggleMonitoring', note: 'Failed: ' + err.message });
    }

    // Enable auto-crossfade
    try {
      await bridge.setAutoFade({ trackId: resolvedTrackId, enabled: true });
      executedActions.push({ action: 'setAutoFade', trackId: resolvedTrackId, enabled: true });
    } catch (err) {
      executedActions.push({ action: 'setAutoFade', note: 'Failed: ' + err.message });
    }

    return {
      workflow: 'quickPunchLoop',
      summary: `Loop punch setup: bars ${startBar}-${endBar} with ${preRollBeats}-beat pre-roll. Hit record and loop until you nail it.`,
      requiresConfirmation: false,
      proposedActions: [],
      checklist: [
        'Time selection set',
        'Loop enabled',
        `Pre-roll active (${preRollBeats} beats)`,
        'Track armed',
        'Monitoring on',
        'Auto-crossfade enabled',
        'Tip: Press record and loop — stop when you\'re happy'
      ],
      expectedOutcome: 'Loop armed and ready. Each pass automatically creates a new take with crossfade.',
      executedActions
    };
  }
};
