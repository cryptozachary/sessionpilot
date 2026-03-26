const { v4: uuidv4 } = require('uuid');

const COLOR_MAP = {
  lead: '#e74c3c',
  doubleLeft: '#e67e22',
  doubleRight: '#f39c12',
  adlib: '#9b59b6',
  folder: '#2ecc71'
};

function classifyVocalTrack(name) {
  const lower = name.toLowerCase();
  if (lower.includes('double') && (lower.includes('l') || lower.includes('left'))) return 'doubleLeft';
  if (lower.includes('double') && (lower.includes('r') || lower.includes('right'))) return 'doubleRight';
  if (lower.includes('double')) return 'doubleLeft';
  if (lower.includes('adlib')) return 'adlib';
  if (lower.includes('lead') || lower.includes('main vocal') || lower.includes('lead vocal')) return 'lead';
  if (lower.includes('vocal') || lower.includes('vox')) return 'lead';
  return null;
}

function isFolderOrBus(name) {
  const lower = name.toLowerCase();
  return lower.includes('bus') || lower.includes('folder') || lower === 'vocals' || lower === 'vox bus';
}

module.exports = {
  name: 'colorCodeVocals',
  description: 'Color-code vocal tracks for easy visual identification by role.',

  async preview(bridge, args = {}) {
    const tracks = await bridge.listTracks();
    const proposedActions = [];

    for (const track of tracks) {
      if (isFolderOrBus(track.name)) {
        proposedActions.push({
          id: uuidv4(),
          type: 'setTrackColor',
          label: `Color "${track.name}" as vocal bus/folder`,
          description: `Set "${track.name}" to green (${COLOR_MAP.folder}).`,
          riskLevel: 'low',
          requiresConfirmation: false,
          args: { trackId: track.id, color: COLOR_MAP.folder }
        });
        continue;
      }

      const role = classifyVocalTrack(track.name);
      if (!role) continue;

      const color = COLOR_MAP[role];
      const roleLabels = {
        lead: 'lead vocal (red)',
        doubleLeft: 'double left (orange)',
        doubleRight: 'double right (yellow-orange)',
        adlib: 'adlib (purple)'
      };

      proposedActions.push({
        id: uuidv4(),
        type: 'setTrackColor',
        label: `Color "${track.name}" as ${roleLabels[role]}`,
        description: `Set "${track.name}" color to ${color}.`,
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { trackId: track.id, color }
      });
    }

    return {
      workflow: 'colorCodeVocals',
      summary: 'Color-code vocal tracks for easy visual identification.',
      requiresConfirmation: false,
      proposedActions,
      checklist: null,
      expectedOutcome: 'Vocal tracks color-coded by role: lead (red), doubles (orange/yellow), adlibs (purple).'
    };
  },

  async execute(bridge, args = {}) {
    const tracks = await bridge.listTracks();
    const colored = [];

    for (const track of tracks) {
      if (isFolderOrBus(track.name)) {
        await bridge.setTrackColor(track.id, COLOR_MAP.folder);
        colored.push({ name: track.name, color: COLOR_MAP.folder });
        continue;
      }

      const role = classifyVocalTrack(track.name);
      if (!role) continue;

      const color = COLOR_MAP[role];
      await bridge.setTrackColor(track.id, color);
      colored.push({ name: track.name, color });
    }

    return {
      workflow: 'colorCodeVocals',
      summary: 'Color-code vocal tracks for easy visual identification.',
      requiresConfirmation: false,
      proposedActions: [],
      checklist: null,
      expectedOutcome: 'Vocal tracks color-coded by role: lead (red), doubles (orange/yellow), adlibs (purple).'
    };
  }
};
