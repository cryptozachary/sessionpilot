const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'preparePunchIn',
  description: 'Set up REAPER for a punch-in recording over a specified bar range.',

  async preview(bridge, args = {}) {
    const { trackId } = args;
    // Default to a 4-bar punch when bars are unspecified so labels/markers
    // never render as "bar undefined".
    const startBar = Number.isFinite(args.startBar) ? args.startBar : 1;
    const endBar = Number.isFinite(args.endBar) ? args.endBar : startBar + 4;
    const trackLabel = trackId ? `track ${trackId}` : 'the selected track';

    const proposedActions = [
      {
        id: uuidv4(),
        type: 'createRegion',
        label: `Create punch-in region (Bar ${startBar}-${endBar})`,
        description: `Create a region named "Punch In: Bar ${startBar}-${endBar}" spanning the punch range.`,
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { name: `Punch In: Bar ${startBar}-${endBar}`, startBar, endBar }
      },
      {
        id: uuidv4(),
        type: 'insertMarker',
        label: `Insert marker at bar ${startBar} (punch start)`,
        description: `Place a marker at bar ${startBar} to indicate the punch-in start point.`,
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { bar: startBar, name: 'Punch Start' }
      },
      {
        id: uuidv4(),
        type: 'insertMarker',
        label: `Insert marker at bar ${endBar} (punch end)`,
        description: `Place a marker at bar ${endBar} to indicate the punch-out point.`,
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { bar: endBar, name: 'Punch End' }
      },
      {
        id: uuidv4(),
        type: 'armTrack',
        label: `Arm ${trackLabel} for recording`,
        description: `Arm ${trackLabel} so it is ready to receive the punch-in recording.`,
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { trackId: trackId || null }
      },
      {
        id: uuidv4(),
        type: 'toggleMonitoring',
        label: `Enable monitoring on ${trackLabel}`,
        description: `Turn on input monitoring so you can hear yourself during the punch-in.`,
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { trackId: trackId || null }
      }
    ];

    return {
      workflow: 'preparePunchIn',
      summary: `Prepare punch-in recording from bar ${startBar} to bar ${endBar}.`,
      requiresConfirmation: false,
      proposedActions,
      checklist: [
        'Region created for punch range',
        'Start/end markers placed',
        'Track armed',
        'Monitoring enabled',
        'Tip: Use pre-roll for a smooth punch-in'
      ],
      expectedOutcome: 'Region marked, track armed, monitoring on. Ready to punch in.'
    };
  },

  async execute(bridge, args = {}) {
    const { trackId } = args;
    // Default to a 4-bar punch when bars are unspecified so labels/markers
    // never render as "bar undefined".
    const startBar = Number.isFinite(args.startBar) ? args.startBar : 1;
    const endBar = Number.isFinite(args.endBar) ? args.endBar : startBar + 4;

    const selectedTrackResult = await bridge.getSelectedTrack();
    const resolvedTrackId = trackId || (selectedTrackResult.data && selectedTrackResult.data.id);

    await bridge.createRegion({
      name: `Punch In: Bar ${startBar}-${endBar}`,
      startBar,
      endBar
    });

    await bridge.insertMarker({ bar: startBar, name: 'Punch Start' });
    await bridge.insertMarker({ bar: endBar, name: 'Punch End' });

    await bridge.armTrack({ trackId: resolvedTrackId });
    await bridge.toggleMonitoring({ trackId: resolvedTrackId, enabled: true });

    return {
      workflow: 'preparePunchIn',
      summary: `Prepare punch-in recording from bar ${startBar} to bar ${endBar}.`,
      requiresConfirmation: false,
      proposedActions: [],
      checklist: [
        'Region created for punch range',
        'Start/end markers placed',
        'Track armed',
        'Monitoring enabled',
        'Tip: Use pre-roll for a smooth punch-in'
      ],
      expectedOutcome: 'Region marked, track armed, monitoring on. Ready to punch in.'
    };
  }
};
