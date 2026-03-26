const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'exportBounce',
  description: 'Render stems, bounce mixes, or export the project.',

  async preview(bridge, args = {}) {
    const mode = args.mode || 'mix'; // 'mix', 'stems', or 'all'

    // Gather project info
    let project = {};
    try {
      const projResult = await bridge.getProjectSummary();
      project = projResult.data || {};
    } catch (_e) { /* ok */ }

    let tracks = [];
    try {
      const tracksResult = await bridge.listTracks();
      tracks = tracksResult.data || [];
    } catch (_e) { /* ok */ }

    let diskInfo = {};
    try {
      const diskResult = await bridge.getDiskSpace();
      diskInfo = diskResult.data || {};
    } catch (_e) { /* ok */ }

    const projectName = project.projectName || project.name || 'Untitled';
    const sampleRate = args.sampleRate || project.sampleRate || 48000;
    const bitDepth = args.bitDepth || 24;
    const format = args.format || 'wav';

    const proposedActions = [];
    const checklist = [];

    checklist.push(`Project: "${projectName}"`);
    checklist.push(`Format: ${format.toUpperCase()} ${sampleRate / 1000}kHz / ${bitDepth}-bit`);

    if (mode === 'mix' || mode === 'all') {
      proposedActions.push({
        id: uuidv4(),
        type: 'renderProject',
        label: `Render full mix as ${format.toUpperCase()}`,
        description: `Bounce the full project mix at ${sampleRate / 1000}kHz / ${bitDepth}-bit.`,
        riskLevel: 'high',
        requiresConfirmation: true,
        args: { format, sampleRate, bitDepth }
      });
      checklist.push('Render full mix');
    }

    if (mode === 'stems' || mode === 'all') {
      const stemNames = tracks.map(t => t.name);
      proposedActions.push({
        id: uuidv4(),
        type: 'renderStems',
        label: `Export ${tracks.length} stems as ${format.toUpperCase()}`,
        description: `Render each track as an individual stem file: ${stemNames.slice(0, 5).join(', ')}${tracks.length > 5 ? '...' : ''}.`,
        riskLevel: 'high',
        requiresConfirmation: true,
        args: { format, sampleRate, bitDepth, stemTracks: stemNames }
      });
      checklist.push(`Export ${tracks.length} stems`);
    }

    // Disk space check
    const freeGB = diskInfo.availableGB || diskInfo.freeGB;
    if (freeGB) {
      checklist.push(`Disk space: ${freeGB.toFixed(1)} GB available`);
      if (freeGB < 5) {
        checklist.push('WARNING: Low disk space — consider freeing space before rendering');
      }
    }

    return {
      workflow: 'exportBounce',
      summary: `Export/bounce for "${projectName}". Mode: ${mode}. ${proposedActions.length} render operation(s) planned.`,
      requiresConfirmation: true,
      proposedActions,
      checklist,
      expectedOutcome: mode === 'all'
        ? 'Full mix and individual stems rendered.'
        : mode === 'stems'
          ? `${tracks.length} stem files rendered.`
          : 'Full mix rendered.'
    };
  },

  async execute(bridge, args = {}) {
    const executedActions = [];
    const mode = args.mode || 'mix';

    let project = {};
    try {
      const projResult = await bridge.getProjectSummary();
      project = projResult.data || {};
    } catch (_e) { /* ok */ }

    const sampleRate = args.sampleRate || project.sampleRate || 48000;
    const bitDepth = args.bitDepth || 24;
    const format = args.format || 'wav';

    if (mode === 'mix' || mode === 'all') {
      try {
        const result = await bridge.renderProject({
          outputPath: args.outputPath,
          format,
          sampleRate,
          bitDepth
        });
        executedActions.push({
          action: 'renderProject',
          format,
          sampleRate,
          bitDepth,
          outputPath: result.data?.outputPath || 'unknown',
          fileSizeMB: result.data?.fileSizeMB || null
        });
      } catch (err) {
        executedActions.push({
          action: 'renderProject',
          note: 'Failed: ' + err.message
        });
      }
    }

    if (mode === 'stems' || mode === 'all') {
      let stemTracks = args.stemTracks;
      if (!stemTracks) {
        try {
          const tracksResult = await bridge.listTracks();
          stemTracks = (tracksResult.data || []).map(t => t.name);
        } catch (_e) {
          stemTracks = [];
        }
      }

      try {
        const result = await bridge.renderStems({
          outputPath: args.outputPath,
          format,
          sampleRate,
          bitDepth,
          stemTracks
        });
        executedActions.push({
          action: 'renderStems',
          stemCount: result.data?.stemCount || stemTracks.length,
          format,
          sampleRate,
          bitDepth
        });
      } catch (err) {
        executedActions.push({
          action: 'renderStems',
          note: 'Failed: ' + err.message
        });
      }
    }

    const projectName = project.projectName || project.name || 'Untitled';

    return {
      workflow: 'exportBounce',
      summary: `Export complete for "${projectName}". ${executedActions.length} render operation(s) finished.`,
      requiresConfirmation: false,
      proposedActions: [],
      checklist: executedActions.map(a => `${a.action}: ${a.note || 'done'}`),
      expectedOutcome: 'Project rendered successfully.',
      executedActions
    };
  }
};
