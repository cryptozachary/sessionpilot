const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'compTakes',
  description: 'Review and manage vocal takes for comping.',

  async preview(bridge, args = {}) {
    let trackId = args.trackId;
    if (!trackId) {
      const selResult = await bridge.getSelectedTrack();
      trackId = selResult.data?.id || null;
    }
    const trackLabel = trackId ? `track ${trackId}` : 'the selected track';

    let takes = [];
    try {
      const takesResult = await bridge.listTakes({ trackId });
      takes = takesResult.data?.takes || takesResult.data || [];
    } catch (err) {
      // listTakes may not be available or track may have no takes
    }

    if (!takes || takes.length === 0) {
      return {
        workflow: 'compTakes',
        summary: 'No takes found on ' + trackLabel + '. Record multiple passes first.',
        requiresConfirmation: false,
        proposedActions: [],
        checklist: [
          'No takes detected on the target track',
          'Record multiple passes to create takes for comping',
          'Tip: Use loop recording to capture several takes in one pass'
        ],
        expectedOutcome: 'No action taken — record takes first.'
      };
    }

    const proposedActions = [
      {
        id: uuidv4(),
        type: 'reviewTakes',
        label: `Review ${takes.length} takes on ${trackLabel}`,
        description: `List all takes: ${takes.map((t, i) => `Take ${i + 1}: ${t.name || 'Unnamed'}`).join(', ')}.`,
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { trackId: args.trackId || null }
      },
      {
        id: uuidv4(),
        type: 'setActiveTake',
        label: 'Select the best take as active',
        description: 'Set the preferred take as the active take for playback.',
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { trackId: args.trackId || null, activeTakeIndex: args.activeTakeIndex || null }
      }
    ];

    if (takes.length > 1) {
      proposedActions.push({
        id: uuidv4(),
        type: 'splitAtCursor',
        label: 'Split items at cursor for section comping',
        description: 'Split items at the edit cursor to comp section-by-section across multiple takes.',
        riskLevel: 'medium',
        requiresConfirmation: true,
        args: { trackId: args.trackId || null }
      });
    }

    return {
      workflow: 'compTakes',
      summary: `Review and manage vocal takes for comping. ${takes.length} take(s) found.`,
      requiresConfirmation: false,
      proposedActions,
      checklist: [
        'List all takes on track',
        'Identify current active take',
        'Set preferred take as active',
        'Tip: Split items at section boundaries for detailed comping'
      ],
      expectedOutcome: 'Takes listed and active take set for comping.'
    };
  },

  async execute(bridge, args = {}) {
    const executedActions = [];

    const selectedTrackResult = await bridge.getSelectedTrack();
    const trackId = args.trackId || (selectedTrackResult.data && selectedTrackResult.data.id);

    let takes = [];
    try {
      const takesResult = await bridge.listTakes({ trackId });
      takes = takesResult.data?.takes || takesResult.data || [];
    } catch (err) {
      // listTakes may not be available
    }

    executedActions.push({
      action: 'listTakes',
      trackId,
      takeCount: takes.length,
      takes: takes.map((t, i) => ({ index: i, name: t.name || 'Unnamed', length: t.length || null }))
    });

    // Identify current active take
    const activeTake = takes.find(t => t.active || t.isActive);
    executedActions.push({
      action: 'identifyActiveTake',
      activeTake: activeTake ? activeTake.name : 'Unknown'
    });

    // Set active take if requested
    if (args.activeTakeIndex !== undefined && args.activeTakeIndex !== null) {
      try {
        await bridge.setActiveTake({ trackId, itemIndex: args.itemIndex || 0, takeIndex: args.activeTakeIndex });
        executedActions.push({
          action: 'setActiveTake',
          trackId,
          takeIndex: args.activeTakeIndex,
          takeName: takes[args.activeTakeIndex] ? takes[args.activeTakeIndex].name : 'Unknown'
        });
      } catch (err) {
        executedActions.push({
          action: 'setActiveTake',
          trackId,
          takeIndex: args.activeTakeIndex,
          note: 'Failed to set active take: ' + err.message
        });
      }
    }

    return {
      workflow: 'compTakes',
      summary: `Review and manage vocal takes for comping. ${takes.length} take(s) found.`,
      requiresConfirmation: false,
      proposedActions: [],
      checklist: [
        'List all takes on track',
        'Identify current active take',
        'Set preferred take as active',
        'Tip: Split items at section boundaries for detailed comping'
      ],
      expectedOutcome: 'Takes listed and active take set for comping.',
      executedActions
    };
  }
};
