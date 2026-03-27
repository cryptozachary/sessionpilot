const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'roughMix',
  description: 'Create a quick rough mix — set levels, pan doubles, bus vocals, add basic compression.',

  async preview(bridge, args = {}) {
    const leadVolume = Number.isFinite(args.leadVolume) ? args.leadVolume : 1.0;
    const doublePanWidth = Number.isFinite(args.doublePan) ? Math.abs(args.doublePan) : 0.6;
    const adlibVolume = Number.isFinite(args.adlibVolume) ? args.adlibVolume : 0.7;
    const busName = args.busName || 'Vocal Bus';

    const proposedActions = [
      {
        id: uuidv4(),
        type: 'setTrackVolume',
        label: `Set Lead Vocal to ${leadVolume === 1 ? '0dB' : Math.round(leadVolume * 100) + '%'}`,
        description: `Set the lead vocal track volume to ${leadVolume} as the anchor level.`,
        riskLevel: 'medium',
        requiresConfirmation: true,
        args: { trackName: 'Lead Vocal', volume: leadVolume }
      },
      {
        id: uuidv4(),
        type: 'setTrackPan',
        label: `Pan Double L to -${doublePanWidth} (left)`,
        description: 'Pan the left vocal double to the left side of the stereo field.',
        riskLevel: 'medium',
        requiresConfirmation: true,
        args: { trackName: 'Double L', pan: -doublePanWidth }
      },
      {
        id: uuidv4(),
        type: 'setTrackPan',
        label: `Pan Double R to ${doublePanWidth} (right)`,
        description: 'Pan the right vocal double to the right side of the stereo field.',
        riskLevel: 'medium',
        requiresConfirmation: true,
        args: { trackName: 'Double R', pan: doublePanWidth }
      },
      {
        id: uuidv4(),
        type: 'setTrackVolume',
        label: `Set Adlibs to ${adlibVolume === 0.7 ? '-3dB' : Math.round(adlibVolume * 100) + '%'}`,
        description: `Tuck the adlib track to ${Math.round(adlibVolume * 100)}% so it supports without overpowering.`,
        riskLevel: 'medium',
        requiresConfirmation: true,
        args: { trackName: 'Adlibs', volume: adlibVolume }
      },
      {
        id: uuidv4(),
        type: 'createTrack',
        label: `Create "${busName}" if it doesn't exist`,
        description: `Create a vocal bus track named "${busName}" to group all vocal tracks for unified processing.`,
        riskLevel: 'low',
        requiresConfirmation: true,
        args: { name: busName, color: '#9b59b6' }
      },
      {
        id: uuidv4(),
        type: 'createSend',
        label: `Route all vocal tracks to ${busName}`,
        description: `Create sends from Lead Vocal, Double L, Double R, and Adlibs to the ${busName}.`,
        riskLevel: 'low',
        requiresConfirmation: true,
        args: { trackNames: ['Lead Vocal', 'Double L', 'Double R', 'Adlibs'], destTrackName: busName }
      }
    ];

    return {
      workflow: 'roughMix',
      summary: `Quick rough mix: lead at ${Math.round(leadVolume * 100)}%, doubles panned ${Math.round(doublePanWidth * 100)}% L/R, adlibs at ${Math.round(adlibVolume * 100)}%.`,
      requiresConfirmation: true,
      proposedActions,
      checklist: [
        `Set Lead Vocal to ${Math.round(leadVolume * 100)}%`,
        `Pan Double L to -${doublePanWidth}, Double R to ${doublePanWidth}`,
        `Set Adlibs to ${Math.round(adlibVolume * 100)}%`,
        `Create ${busName} (if needed)`,
        `Route all vocal tracks to ${busName}`,
        'Note: This is a rough mix for monitoring — not a final mix'
      ],
      expectedOutcome: `Vocal levels balanced with doubles panned L/R and adlibs tucked. Quick playback-ready mix.`
    };
  },

  async execute(bridge, args = {}) {
    const executedActions = [];
    const tracksResult = await bridge.listTracks();
    const tracks = tracksResult.data || [];

    const leadVolume = Number.isFinite(args.leadVolume) ? args.leadVolume : 1.0;
    const doublePanWidth = Number.isFinite(args.doublePan) ? Math.abs(args.doublePan) : 0.6;
    const adlibVolume = Number.isFinite(args.adlibVolume) ? args.adlibVolume : 0.7;
    const busName = args.busName || 'Vocal Bus';

    // Helper to find track by name (case-insensitive partial match)
    const findTrack = (name) => tracks.find(t =>
      t.name && t.name.toLowerCase().includes(name.toLowerCase())
    );

    // Set lead vocal volume
    const leadVocal = findTrack('Lead Vocal');
    if (leadVocal) {
      await bridge.setTrackVolume({ trackId: leadVocal.id, volume: leadVolume });
      executedActions.push({ action: 'setTrackVolume', trackId: leadVocal.id, name: leadVocal.name, volume: leadVolume });
    }

    // Pan doubles
    const doubleL = findTrack('Double L');
    if (doubleL) {
      await bridge.setTrackPan({ trackId: doubleL.id, pan: -doublePanWidth });
      executedActions.push({ action: 'setTrackPan', trackId: doubleL.id, name: doubleL.name, pan: -doublePanWidth });
    }

    const doubleR = findTrack('Double R');
    if (doubleR) {
      await bridge.setTrackPan({ trackId: doubleR.id, pan: doublePanWidth });
      executedActions.push({ action: 'setTrackPan', trackId: doubleR.id, name: doubleR.name, pan: doublePanWidth });
    }

    // Set adlibs volume
    const adlibs = findTrack('Adlib');
    if (adlibs) {
      await bridge.setTrackVolume({ trackId: adlibs.id, volume: adlibVolume });
      executedActions.push({ action: 'setTrackVolume', trackId: adlibs.id, name: adlibs.name, volume: adlibVolume });
    }

    // Create Vocal Bus if it doesn't exist
    let vocalBus = findTrack(busName);
    if (!vocalBus) {
      const vocalBusResult = await bridge.createTrack({ name: busName, color: '#9b59b6' });
      const vocalBusId = vocalBusResult.data && vocalBusResult.data.id;
      executedActions.push({ action: 'createTrack', trackId: vocalBusId, name: busName });
      vocalBus = { id: vocalBusId, name: busName };
    } else {
      executedActions.push({ action: 'vocalBusExists', trackId: vocalBus.id, name: vocalBus.name });
    }

    // Create sends from vocal tracks to bus
    const vocalTracks = [leadVocal, doubleL, doubleR, adlibs].filter(Boolean);
    for (const vt of vocalTracks) {
      try {
        await bridge.createSend({ fromTrackId: vt.id, toTrackId: vocalBus.id });
        executedActions.push({ action: 'createSend', sourceTrackId: vt.id, destTrackId: vocalBus.id });
      } catch (err) {
        executedActions.push({ action: 'createSend', sourceTrackId: vt.id, destTrackId: vocalBus.id, note: 'Failed: ' + err.message });
      }
    }

    return {
      workflow: 'roughMix',
      summary: `Quick rough mix: lead at ${Math.round(leadVolume * 100)}%, doubles panned ${Math.round(doublePanWidth * 100)}% L/R, adlibs at ${Math.round(adlibVolume * 100)}%.`,
      requiresConfirmation: true,
      proposedActions: [],
      checklist: [
        `Set Lead Vocal to ${Math.round(leadVolume * 100)}%`,
        `Pan doubles to ${Math.round(doublePanWidth * 100)}% L/R`,
        `Set Adlibs to ${Math.round(adlibVolume * 100)}%`,
        `Create ${busName} (if needed)`,
        `Route all vocal tracks to ${busName}`,
        'Note: This is a rough mix for monitoring — not a final mix'
      ],
      expectedOutcome: `Vocal levels balanced with doubles panned L/R and adlibs tucked. Quick playback-ready mix.`,
      executedActions
    };
  }
};
