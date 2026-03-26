const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'roughMix',
  description: 'Create a quick rough mix — set levels, pan doubles, bus vocals, add basic compression.',

  async preview(bridge, args = {}) {
    const proposedActions = [
      {
        id: uuidv4(),
        type: 'setTrackVolume',
        label: 'Set Lead Vocal to 0dB',
        description: 'Set the lead vocal track volume to 0dB (1.0) as the anchor level.',
        riskLevel: 'medium',
        requiresConfirmation: true,
        args: { trackName: 'Lead Vocal', volume: 1.0 }
      },
      {
        id: uuidv4(),
        type: 'setTrackPan',
        label: 'Pan Double L to -0.6 (left)',
        description: 'Pan the left vocal double to the left side of the stereo field.',
        riskLevel: 'medium',
        requiresConfirmation: true,
        args: { trackName: 'Double L', pan: -0.6 }
      },
      {
        id: uuidv4(),
        type: 'setTrackPan',
        label: 'Pan Double R to 0.6 (right)',
        description: 'Pan the right vocal double to the right side of the stereo field.',
        riskLevel: 'medium',
        requiresConfirmation: true,
        args: { trackName: 'Double R', pan: 0.6 }
      },
      {
        id: uuidv4(),
        type: 'setTrackVolume',
        label: 'Set Adlibs to -3dB',
        description: 'Tuck the adlib track to -3dB (~0.7) so it supports without overpowering.',
        riskLevel: 'medium',
        requiresConfirmation: true,
        args: { trackName: 'Adlibs', volume: 0.7 }
      },
      {
        id: uuidv4(),
        type: 'createTrack',
        label: 'Create "Vocal Bus" if it doesn\'t exist',
        description: 'Create a vocal bus track to group all vocal tracks for unified processing.',
        riskLevel: 'low',
        requiresConfirmation: true,
        args: { name: 'Vocal Bus', color: '#9b59b6' }
      },
      {
        id: uuidv4(),
        type: 'createSend',
        label: 'Route all vocal tracks to Vocal Bus',
        description: 'Create sends from Lead Vocal, Double L, Double R, and Adlibs to the Vocal Bus.',
        riskLevel: 'low',
        requiresConfirmation: true,
        args: { trackNames: ['Lead Vocal', 'Double L', 'Double R', 'Adlibs'], destTrackName: 'Vocal Bus' }
      }
    ];

    return {
      workflow: 'roughMix',
      summary: 'Quick rough mix: levels set, doubles panned, vocals bussed.',
      requiresConfirmation: true,
      proposedActions,
      checklist: [
        'Set Lead Vocal to 0dB',
        'Pan Double L to -0.6, Double R to 0.6',
        'Set Adlibs to -3dB',
        'Create Vocal Bus (if needed)',
        'Route all vocal tracks to Vocal Bus',
        'Note: This is a rough mix for monitoring — not a final mix'
      ],
      expectedOutcome: 'Vocal levels balanced with doubles panned L/R and adlibs tucked. Quick playback-ready mix.'
    };
  },

  async execute(bridge, args = {}) {
    const executedActions = [];
    const tracksResult = await bridge.listTracks();
    const tracks = tracksResult.data || [];

    // Helper to find track by name (case-insensitive partial match)
    const findTrack = (name) => tracks.find(t =>
      t.name && t.name.toLowerCase().includes(name.toLowerCase())
    );

    // Set lead vocal volume
    const leadVocal = findTrack('Lead Vocal');
    if (leadVocal) {
      await bridge.setTrackVolume(leadVocal.id, 1.0);
      executedActions.push({ action: 'setTrackVolume', trackId: leadVocal.id, name: leadVocal.name, volume: 1.0 });
    }

    // Pan doubles
    const doubleL = findTrack('Double L');
    if (doubleL) {
      await bridge.setTrackPan(doubleL.id, -0.6);
      executedActions.push({ action: 'setTrackPan', trackId: doubleL.id, name: doubleL.name, pan: -0.6 });
    }

    const doubleR = findTrack('Double R');
    if (doubleR) {
      await bridge.setTrackPan(doubleR.id, 0.6);
      executedActions.push({ action: 'setTrackPan', trackId: doubleR.id, name: doubleR.name, pan: 0.6 });
    }

    // Set adlibs volume
    const adlibs = findTrack('Adlib');
    if (adlibs) {
      await bridge.setTrackVolume(adlibs.id, 0.7);
      executedActions.push({ action: 'setTrackVolume', trackId: adlibs.id, name: adlibs.name, volume: 0.7 });
    }

    // Create Vocal Bus if it doesn't exist
    let vocalBus = findTrack('Vocal Bus');
    if (!vocalBus) {
      const vocalBusResult = await bridge.createTrack({ name: 'Vocal Bus', color: '#9b59b6' });
      const vocalBusId = vocalBusResult.data;
      executedActions.push({ action: 'createTrack', trackId: vocalBusId, name: 'Vocal Bus' });
      vocalBus = { id: vocalBusId, name: 'Vocal Bus' };
    } else {
      executedActions.push({ action: 'vocalBusExists', trackId: vocalBus.id, name: vocalBus.name });
    }

    // Create sends from vocal tracks to bus
    const vocalTracks = [leadVocal, doubleL, doubleR, adlibs].filter(Boolean);
    for (const vt of vocalTracks) {
      try {
        await bridge.createSend({ sourceTrackId: vt.id, destTrackId: vocalBus.id });
        executedActions.push({ action: 'createSend', sourceTrackId: vt.id, destTrackId: vocalBus.id });
      } catch (err) {
        executedActions.push({ action: 'createSend', sourceTrackId: vt.id, destTrackId: vocalBus.id, note: 'Failed: ' + err.message });
      }
    }

    return {
      workflow: 'roughMix',
      summary: 'Quick rough mix: levels set, doubles panned, vocals bussed.',
      requiresConfirmation: true,
      proposedActions: [],
      checklist: [
        'Set Lead Vocal to 0dB',
        'Pan Double L to -0.6, Double R to 0.6',
        'Set Adlibs to -3dB',
        'Create Vocal Bus (if needed)',
        'Route all vocal tracks to Vocal Bus',
        'Note: This is a rough mix for monitoring — not a final mix'
      ],
      expectedOutcome: 'Vocal levels balanced with doubles panned L/R and adlibs tucked. Quick playback-ready mix.',
      executedActions
    };
  }
};
