const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'sessionNotes',
  description: 'Add timestamped notes/markers at the current position or specific regions.',

  async preview(bridge, args = {}) {
    const { note = 'Session note', position, trackId } = args;
    const positionLabel = position !== undefined ? `position ${position}s` : 'the current cursor position';
    const trackLabel = trackId ? ` on track ${trackId}` : '';

    const proposedActions = [
      {
        id: uuidv4(),
        type: 'insertMarker',
        label: `Insert note marker: "${note}"`,
        description: `Place a marker with the note "${note}" at ${positionLabel}.`,
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { name: note, position: position || null }
      }
    ];

    if (trackId) {
      proposedActions.push({
        id: uuidv4(),
        type: 'addTrackNote',
        label: `Add track note${trackLabel}`,
        description: `Annotate the track with: "${note}".`,
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { trackId, note }
      });
    }

    return {
      workflow: 'sessionNotes',
      summary: `Added session note: '${note}'`,
      requiresConfirmation: false,
      proposedActions,
      checklist: [
        `Insert marker: "${note}" at ${positionLabel}`,
        trackId ? `Add track note${trackLabel}` : null,
        'Common uses: "retake this line", "keep this adlib", "pitch off here"'
      ].filter(Boolean),
      expectedOutcome: `Note marker placed at ${positionLabel}. Visible in timeline for reference.`
    };
  },

  async execute(bridge, args = {}) {
    const executedActions = [];
    const { note = 'Session note', position, trackId } = args;

    // Resolve position — use provided position or get current cursor position
    let resolvedPosition = position;
    if (resolvedPosition === undefined || resolvedPosition === null) {
      try {
        const sessionResult = await bridge.getProjectSummary();
        const session = sessionResult.data || {};
        resolvedPosition = session.playCursor || 0;
      } catch (err) {
        resolvedPosition = 0;
      }
    }

    // Insert marker with note text
    try {
      await bridge.insertMarker({ name: note, position: resolvedPosition });
      executedActions.push({ action: 'insertMarker', name: note, position: resolvedPosition });
    } catch (err) {
      executedActions.push({ action: 'insertMarker', name: note, note: 'Failed: ' + err.message });
    }

    // Add track note if trackId provided
    if (trackId) {
      try {
        await bridge.addTrackNote({ trackId, note });
        executedActions.push({ action: 'addTrackNote', trackId, note });
      } catch (err) {
        executedActions.push({ action: 'addTrackNote', trackId, note: 'Failed: ' + err.message });
      }
    }

    const positionLabel = `${resolvedPosition.toFixed(2)}s`;

    return {
      workflow: 'sessionNotes',
      summary: `Added session note: '${note}'`,
      requiresConfirmation: false,
      proposedActions: [],
      checklist: [
        `Insert marker: "${note}" at ${positionLabel}`,
        trackId ? `Add track note on track ${trackId}` : null
      ].filter(Boolean),
      expectedOutcome: `Note marker placed at ${positionLabel}. Visible in timeline for reference.`,
      executedActions
    };
  }
};
