const { v4: uuidv4 } = require('uuid');

// FX suggestions by track type (inferred from name)
const FX_PROFILES = {
  vocal:  { label: 'Vocal Chain',  fx: ['ReaComp', 'ReaEQ', 'ReaDelay'] },
  drum:   { label: 'Drum Chain',   fx: ['ReaComp', 'ReaEQ'] },
  bass:   { label: 'Bass Chain',   fx: ['ReaComp', 'ReaEQ'] },
  guitar: { label: 'Guitar Chain', fx: ['ReaEQ', 'ReaDelay'] },
  keys:   { label: 'Keys Chain',   fx: ['ReaEQ', 'ReaDelay'] }
};

function inferTrackType(trackName) {
  const name = (trackName || '').toLowerCase();
  if (/vocal|vox|lead|double|adlib|harmony|bgv/i.test(name)) return 'vocal';
  if (/drum|kick|snare|hat|tom|oh|room/i.test(name)) return 'drum';
  if (/bass|sub/i.test(name)) return 'bass';
  if (/guitar|gtr|guit/i.test(name)) return 'guitar';
  if (/key|piano|synth|organ|pad/i.test(name)) return 'keys';
  return null;
}

module.exports = {
  name: 'manageFxChain',
  description: 'Review and manage FX plugins on a track — view, suggest, load, bypass, or remove.',

  async preview(bridge, args = {}) {
    let trackId = args.trackId;
    let trackName = 'the selected track';

    if (!trackId) {
      const selResult = await bridge.getSelectedTrack();
      trackId = selResult.data?.id || null;
      trackName = selResult.data?.name || trackName;
    }

    if (!trackId) {
      return {
        workflow: 'manageFxChain',
        summary: 'No track selected. Select a track to manage its FX chain.',
        requiresConfirmation: false,
        proposedActions: [],
        checklist: ['Select a track in REAPER first'],
        expectedOutcome: 'No action taken.'
      };
    }

    // Get current FX
    let currentFx = [];
    try {
      const fxResult = await bridge.getTrackFx({ trackId });
      currentFx = fxResult.data?.fx || [];
    } catch (_e) { /* bridge may not support getTrackFx */ }

    const trackType = inferTrackType(trackName);
    const profile = trackType ? FX_PROFILES[trackType] : null;

    const proposedActions = [];

    // Action: review current FX
    proposedActions.push({
      id: uuidv4(),
      type: 'reviewFx',
      label: `Current FX on "${trackName}": ${currentFx.length === 0 ? 'none' : currentFx.map(f => f.name).join(', ')}`,
      description: currentFx.length === 0
        ? 'No FX loaded on this track.'
        : `${currentFx.length} plugin(s) loaded.`,
      riskLevel: 'low',
      requiresConfirmation: false,
      args: { trackId }
    });

    // Action: suggest FX chain based on track type
    if (profile && currentFx.length === 0) {
      proposedActions.push({
        id: uuidv4(),
        type: 'loadFxChain',
        label: `Load suggested ${profile.label}: ${profile.fx.join(' → ')}`,
        description: `Recommended FX chain for ${trackType} tracks.`,
        riskLevel: 'medium',
        requiresConfirmation: true,
        args: { trackId, fxChainName: profile.label }
      });
    }

    // Action: bypass all FX
    if (currentFx.length > 0) {
      proposedActions.push({
        id: uuidv4(),
        type: 'bypassAllFx',
        label: 'Bypass all FX on this track',
        description: 'Temporarily disable all plugins for A/B comparison.',
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { trackId }
      });
    }

    // Available FX chains
    let availableChains = [];
    try {
      const chainsResult = await bridge.listAvailableFxChains();
      availableChains = chainsResult.data || [];
    } catch (_e) { /* ok */ }

    if (availableChains.length > 0) {
      proposedActions.push({
        id: uuidv4(),
        type: 'loadFxChain',
        label: `Load an FX chain (${availableChains.length} available)`,
        description: `Available: ${availableChains.join(', ')}.`,
        riskLevel: 'medium',
        requiresConfirmation: true,
        args: { trackId }
      });
    }

    const checklist = [
      `Track: "${trackName}"${trackType ? ` (detected: ${trackType})` : ''}`,
      `Current FX: ${currentFx.length === 0 ? 'none' : currentFx.map(f => f.name).join(', ')}`,
      profile ? `Suggested chain: ${profile.fx.join(' → ')}` : 'No auto-suggestion for this track type'
    ];

    return {
      workflow: 'manageFxChain',
      summary: `FX chain management for "${trackName}". ${currentFx.length} plugin(s) loaded.`,
      requiresConfirmation: currentFx.length === 0 && !!profile,
      proposedActions,
      checklist,
      expectedOutcome: 'FX chain reviewed and updated as needed.'
    };
  },

  async execute(bridge, args = {}) {
    const executedActions = [];

    const selectedTrackResult = await bridge.getSelectedTrack();
    const trackId = args.trackId || selectedTrackResult.data?.id;
    const trackName = selectedTrackResult.data?.name || 'Track';

    // Get current FX
    let currentFx = [];
    try {
      const fxResult = await bridge.getTrackFx({ trackId });
      currentFx = fxResult.data?.fx || [];
      executedActions.push({ action: 'getTrackFx', trackId, fxCount: currentFx.length });
    } catch (_e) {
      executedActions.push({ action: 'getTrackFx', trackId, note: 'Could not retrieve FX list' });
    }

    // Load FX chain if requested
    if (args.fxChainName) {
      try {
        await bridge.loadFxChain({ trackId, fxChainName: args.fxChainName });
        executedActions.push({ action: 'loadFxChain', trackId, fxChainName: args.fxChainName });
      } catch (err) {
        executedActions.push({ action: 'loadFxChain', note: 'Failed: ' + err.message });
      }
    } else if (currentFx.length === 0) {
      // Auto-suggest based on track type
      const trackType = inferTrackType(trackName);
      const profile = trackType ? FX_PROFILES[trackType] : null;
      if (profile) {
        try {
          await bridge.loadFxChain({ trackId, fxChainName: profile.label });
          executedActions.push({ action: 'loadSuggestedChain', trackId, chain: profile.label });
        } catch (err) {
          executedActions.push({ action: 'loadSuggestedChain', note: 'Failed: ' + err.message });
        }
      }
    }

    // Bypass specific FX if requested
    if (args.bypassFxIndex !== undefined) {
      try {
        await bridge.toggleFxBypass({ trackId, fxIndex: args.bypassFxIndex, bypassed: true });
        executedActions.push({ action: 'bypassFx', trackId, fxIndex: args.bypassFxIndex });
      } catch (err) {
        executedActions.push({ action: 'bypassFx', note: 'Failed: ' + err.message });
      }
    }

    // Remove specific FX if requested
    if (args.removeFxIndex !== undefined) {
      try {
        await bridge.removeFx({ trackId, fxIndex: args.removeFxIndex });
        executedActions.push({ action: 'removeFx', trackId, fxIndex: args.removeFxIndex });
      } catch (err) {
        executedActions.push({ action: 'removeFx', note: 'Failed: ' + err.message });
      }
    }

    return {
      workflow: 'manageFxChain',
      summary: `FX chain managed for "${trackName}". ${executedActions.length} action(s) performed.`,
      requiresConfirmation: false,
      proposedActions: [],
      checklist: [`Track: "${trackName}"`, `Actions: ${executedActions.length}`],
      expectedOutcome: 'FX chain updated.',
      executedActions
    };
  }
};
