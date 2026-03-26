const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'setupHeadphoneMix',
  description: 'Create a cue/headphone mix send with reverb so the artist hears a polished signal while recording dry.',

  async preview(bridge, args = {}) {
    const trackLabel = args.trackId ? `track ${args.trackId}` : 'the selected vocal track';

    const proposedActions = [
      {
        id: uuidv4(),
        type: 'createTrack',
        label: 'Create "Cue Mix" bus track',
        description: 'Create a new bus track named "Cue Mix" with color #3498db for headphone routing.',
        riskLevel: 'low',
        requiresConfirmation: true,
        args: { name: 'Cue Mix', color: '#3498db' }
      },
      {
        id: uuidv4(),
        type: 'loadFx',
        label: 'Add reverb FX to Cue Mix bus',
        description: 'Load ReaVerbate on the Cue Mix bus so the artist hears a polished signal in headphones.',
        riskLevel: 'medium',
        requiresConfirmation: true,
        args: { fxName: 'ReaVerbate' }
      },
      {
        id: uuidv4(),
        type: 'createSend',
        label: `Create send from ${trackLabel} to Cue Mix`,
        description: `Route audio from ${trackLabel} to the Cue Mix bus for headphone monitoring.`,
        riskLevel: 'low',
        requiresConfirmation: true,
        args: { sourceTrackId: args.trackId || null, destTrackName: 'Cue Mix' }
      },
      {
        id: uuidv4(),
        type: 'setSendVolume',
        label: 'Set send volume to -6dB',
        description: 'Set the send level to -6dB (0.5) so the cue mix sits comfortably without clipping.',
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { volume: 0.5 }
      }
    ];

    return {
      workflow: 'setupHeadphoneMix',
      summary: 'Set up a headphone cue mix with reverb for comfortable vocal monitoring.',
      requiresConfirmation: true,
      proposedActions,
      checklist: [
        'Create Cue Mix bus track',
        'Add ReaVerbate reverb to cue bus',
        'Create send from vocal track to cue bus',
        'Set send volume to -6dB',
        'Note: The artist will hear reverb in headphones but the recording stays dry'
      ],
      expectedOutcome: 'Cue mix bus with reverb send from vocal track. Recording stays dry.'
    };
  },

  async execute(bridge, args = {}) {
    const executedActions = [];

    // Create the Cue Mix bus track
    const cueBusResult = await bridge.createTrack({ name: 'Cue Mix', color: '#3498db' });
    const cueBusId = cueBusResult.data && cueBusResult.data.id;
    executedActions.push({ action: 'createTrack', trackId: cueBusId, name: 'Cue Mix' });

    // Load reverb FX on the cue bus
    try {
      await bridge.loadFxChain({ trackId: cueBusId, fxChainName: 'ReaVerbate' });
      executedActions.push({ action: 'loadFx', trackId: cueBusId, fxName: 'ReaVerbate' });
    } catch (err) {
      executedActions.push({ action: 'loadFx', trackId: cueBusId, fxName: 'ReaVerbate', note: 'Could not auto-load FX — add ReaVerbate manually to the Cue Mix bus' });
    }

    // Resolve the source track
    const selectedTrackResult = await bridge.getSelectedTrack();
    const sourceTrackId = args.trackId || (selectedTrackResult.data && selectedTrackResult.data.id);

    // Create the send from vocal track to cue bus
    await bridge.createSend({ fromTrackId: sourceTrackId, toTrackId: cueBusId, volume: 0.5 });
    executedActions.push({ action: 'createSend', sourceTrackId, destTrackId: cueBusId, volume: 0.5 });

    return {
      workflow: 'setupHeadphoneMix',
      summary: 'Set up a headphone cue mix with reverb for comfortable vocal monitoring.',
      requiresConfirmation: true,
      proposedActions: [],
      checklist: [
        'Create Cue Mix bus track',
        'Add ReaVerbate reverb to cue bus',
        'Create send from vocal track to cue bus',
        'Set send volume to -6dB',
        'Note: The artist will hear reverb in headphones but the recording stays dry'
      ],
      expectedOutcome: 'Cue mix bus with reverb send from vocal track. Recording stays dry.',
      executedActions
    };
  }
};
