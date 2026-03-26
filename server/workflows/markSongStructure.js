const { v4: uuidv4 } = require('uuid');

const DEFAULT_SECTIONS = [
  { name: 'Intro', startBar: 1 },
  { name: 'Verse 1', startBar: 9 },
  { name: 'Chorus', startBar: 25 },
  { name: 'Verse 2', startBar: 41 },
  { name: 'Chorus 2', startBar: 57 },
  { name: 'Bridge', startBar: 73 },
  { name: 'Outro', startBar: 81 }
];

const SECTION_COLORS = {
  intro: '#95a5a6',
  outro: '#95a5a6',
  verse: '#3498db',
  chorus: '#e74c3c',
  bridge: '#2ecc71'
};

function getSectionColor(name) {
  const lower = name.toLowerCase();
  if (lower.includes('intro')) return SECTION_COLORS.intro;
  if (lower.includes('outro')) return SECTION_COLORS.outro;
  if (lower.includes('verse')) return SECTION_COLORS.verse;
  if (lower.includes('chorus')) return SECTION_COLORS.chorus;
  if (lower.includes('bridge')) return SECTION_COLORS.bridge;
  return '#95a5a6';
}

function barToTime(bar, bpm) {
  return (bar - 1) * (4 * 60 / bpm);
}

module.exports = {
  name: 'markSongStructure',
  description: 'Drop markers and regions for song sections from a description.',

  async preview(bridge, args = {}) {
    const sections = args.sections || DEFAULT_SECTIONS;

    const proposedActions = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const nextSection = sections[i + 1];
      const color = getSectionColor(section.name);

      proposedActions.push({
        id: uuidv4(),
        type: 'insertMarker',
        label: `Insert marker: "${section.name}" at bar ${section.startBar}`,
        description: `Place a marker at bar ${section.startBar} for the ${section.name} section.`,
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { name: section.name, bar: section.startBar }
      });

      if (nextSection) {
        proposedActions.push({
          id: uuidv4(),
          type: 'createRegion',
          label: `Create region: "${section.name}" (bars ${section.startBar}-${nextSection.startBar})`,
          description: `Create a color-coded region for ${section.name} spanning bars ${section.startBar} to ${nextSection.startBar}.`,
          riskLevel: 'low',
          requiresConfirmation: false,
          args: { name: section.name, startBar: section.startBar, endBar: nextSection.startBar, color }
        });
      }
    }

    return {
      workflow: 'markSongStructure',
      summary: `Mark song structure with markers and regions for ${sections.length} sections.`,
      requiresConfirmation: false,
      proposedActions,
      checklist: sections.map(s => `Mark "${s.name}" at bar ${s.startBar}`),
      expectedOutcome: 'Song sections marked with color-coded regions for easy navigation.'
    };
  },

  async execute(bridge, args = {}) {
    const executedActions = [];
    const sections = args.sections || DEFAULT_SECTIONS;

    // Get BPM from project to convert bars to time
    let bpm = 120;
    try {
      const projectResult = await bridge.getProjectSummary();
      const project = projectResult.data || {};
      if (project && project.bpm) {
        bpm = project.bpm;
      }
    } catch (err) {
      // Fall back to 120 BPM
    }

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const nextSection = sections[i + 1];
      const color = getSectionColor(section.name);
      const startTime = barToTime(section.startBar, bpm);

      // Insert marker
      try {
        await bridge.insertMarker({ name: section.name, position: startTime });
        executedActions.push({ action: 'insertMarker', name: section.name, bar: section.startBar, position: startTime });
      } catch (err) {
        executedActions.push({ action: 'insertMarker', name: section.name, bar: section.startBar, note: 'Failed: ' + err.message });
      }

      // Create region spanning to next section
      if (nextSection) {
        const endTime = barToTime(nextSection.startBar, bpm);
        try {
          await bridge.createRegion({ name: section.name, start: startTime, end: endTime, color });
          executedActions.push({ action: 'createRegion', name: section.name, startBar: section.startBar, endBar: nextSection.startBar, color });
        } catch (err) {
          executedActions.push({ action: 'createRegion', name: section.name, note: 'Failed: ' + err.message });
        }
      }
    }

    return {
      workflow: 'markSongStructure',
      summary: `Mark song structure with markers and regions for ${sections.length} sections.`,
      requiresConfirmation: false,
      proposedActions: [],
      checklist: sections.map(s => `Mark "${s.name}" at bar ${s.startBar}`),
      expectedOutcome: 'Song sections marked with color-coded regions for easy navigation.',
      executedActions
    };
  }
};
