const { v4: uuidv4 } = require('uuid');

const VOCAL_KEYWORDS = ['vocal', 'vox', 'double', 'adlib', 'adlibs', 'lead vocal', 'harmony', 'bg vox', 'backing vocal'];
const VOCAL_COLOR = '#2ecc71';
const INSTRUMENT_COLOR = '#3498db';

function isVocalTrack(trackName) {
  const lower = trackName.toLowerCase();
  return VOCAL_KEYWORDS.some(keyword => lower.includes(keyword));
}

function isInstrumentTrack(trackName) {
  return !isVocalTrack(trackName);
}

module.exports = {
  name: 'organizeSessionTracks',
  description: 'Organize session tracks into labeled, color-coded folders by type.',

  async preview(bridge, args = {}) {
    const tracksResult = await bridge.listTracks();
    const tracks = tracksResult.data || [];
    const vocalTracks = tracks.filter(t => isVocalTrack(t.name));
    const instrumentTracks = tracks.filter(t => isInstrumentTrack(t.name));

    const proposedActions = [];

    if (vocalTracks.length > 0) {
      proposedActions.push({
        id: uuidv4(),
        type: 'createFolderTrack',
        label: 'Create "Vocals" folder',
        description: `Create a "Vocals" folder track to group ${vocalTracks.length} vocal track(s).`,
        riskLevel: 'medium',
        requiresConfirmation: true,
        args: { name: 'Vocals', color: VOCAL_COLOR }
      });

      for (const track of vocalTracks) {
        proposedActions.push({
          id: uuidv4(),
          type: 'moveTrackToFolder',
          label: `Move "${track.name}" into Vocals folder`,
          description: `Move "${track.name}" under the Vocals folder track.`,
          riskLevel: 'medium',
          requiresConfirmation: true,
          args: { trackId: track.id, folderName: 'Vocals' }
        });

        proposedActions.push({
          id: uuidv4(),
          type: 'setTrackColor',
          label: `Color-code "${track.name}"`,
          description: `Set "${track.name}" color to vocal green (${VOCAL_COLOR}).`,
          riskLevel: 'low',
          requiresConfirmation: false,
          args: { trackId: track.id, color: VOCAL_COLOR }
        });
      }
    }

    if (instrumentTracks.length > 0) {
      proposedActions.push({
        id: uuidv4(),
        type: 'createFolderTrack',
        label: 'Create "Instruments" folder',
        description: `Create an "Instruments" folder track to group ${instrumentTracks.length} instrument track(s).`,
        riskLevel: 'medium',
        requiresConfirmation: true,
        args: { name: 'Instruments', color: INSTRUMENT_COLOR }
      });

      for (const track of instrumentTracks) {
        proposedActions.push({
          id: uuidv4(),
          type: 'moveTrackToFolder',
          label: `Move "${track.name}" into Instruments folder`,
          description: `Move "${track.name}" under the Instruments folder track.`,
          riskLevel: 'medium',
          requiresConfirmation: true,
          args: { trackId: track.id, folderName: 'Instruments' }
        });

        proposedActions.push({
          id: uuidv4(),
          type: 'setTrackColor',
          label: `Color-code "${track.name}"`,
          description: `Set "${track.name}" color to instrument blue (${INSTRUMENT_COLOR}).`,
          riskLevel: 'low',
          requiresConfirmation: false,
          args: { trackId: track.id, color: INSTRUMENT_COLOR }
        });
      }
    }

    return {
      workflow: 'organizeSessionTracks',
      summary: 'Organize session tracks into labeled, color-coded folders.',
      requiresConfirmation: true,
      proposedActions,
      checklist: null,
      expectedOutcome: 'Tracks organized into vocal and instrument folders with consistent colors.'
    };
  },

  async execute(bridge, args = {}) {
    const tracksResult = await bridge.listTracks();
    const tracks = tracksResult.data || [];
    // Capture NAMES up front. Track ids are positional ("track_N") and every
    // moveTrackToFolder reorders tracks, invalidating the ids of tracks not yet
    // moved — so we re-resolve identity by name before each move.
    const vocalNames = tracks.filter(t => isVocalTrack(t.name)).map(t => t.name);
    const instrumentNames = tracks.filter(t => isInstrumentTrack(t.name)).map(t => t.name);

    async function groupInto(folderName, color, names) {
      if (names.length === 0) return;
      await bridge.createFolderTrack({ name: folderName, color });
      for (const name of names) {
        const list = (await bridge.listTracks()).data || [];
        const folder = list.find(t => t.name === folderName && t.trackType === 'folder');
        const track = list.find(t => t.name === name && t.trackType !== 'folder');
        if (!folder || !track) continue;
        // Colour first (no reorder), then nest (reorders — do it last per track).
        await bridge.setTrackColor({ trackId: track.id, color });
        await bridge.moveTrackToFolder({ trackId: track.id, folderId: folder.id });
      }
    }

    await groupInto('Vocals', VOCAL_COLOR, vocalNames);
    await groupInto('Instruments', INSTRUMENT_COLOR, instrumentNames);

    return {
      workflow: 'organizeSessionTracks',
      summary: 'Organize session tracks into labeled, color-coded folders.',
      requiresConfirmation: true,
      proposedActions: [],
      checklist: null,
      expectedOutcome: 'Tracks organized into vocal and instrument folders with consistent colors.'
    };
  }
};
