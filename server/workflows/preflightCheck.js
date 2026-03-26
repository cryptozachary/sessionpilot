const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'preflightCheck',
  description: 'Pre-session checklist verifying everything is ready to record.',

  async preview(bridge, args = {}) {
    // Preview and execute are essentially the same for this diagnostic workflow
    return await this.execute(bridge, args);
  },

  async execute(bridge, args = {}) {
    const executedActions = [];
    const checklist = [];
    const proposedActions = [];

    let passCount = 0;
    let warnCount = 0;
    let failCount = 0;

    // Gather project data
    let project = {};
    try {
      const projectResult = await bridge.getProjectSummary();
      project = projectResult.data || {};
      executedActions.push({ action: 'getProjectSummary', status: 'ok' });
    } catch (err) {
      executedActions.push({ action: 'getProjectSummary', status: 'error', note: err.message });
    }

    let bufferInfo = {};
    try {
      const bufferResult = await bridge.getBufferSize();
      bufferInfo = bufferResult.data || {};
      executedActions.push({ action: 'getBufferSize', status: 'ok' });
    } catch (err) {
      executedActions.push({ action: 'getBufferSize', status: 'error', note: err.message });
    }

    let diskInfo = {};
    try {
      const diskResult = await bridge.getDiskSpace();
      diskInfo = diskResult.data || {};
      executedActions.push({ action: 'getDiskSpace', status: 'ok' });
    } catch (err) {
      executedActions.push({ action: 'getDiskSpace', status: 'error', note: err.message });
    }

    let tracks = [];
    try {
      const tracksResult = await bridge.listTracks();
      tracks = tracksResult.data || [];
      executedActions.push({ action: 'listTracks', status: 'ok', trackCount: tracks.length });
    } catch (err) {
      executedActions.push({ action: 'listTracks', status: 'error', note: err.message });
    }

    let selectedTrack = null;
    try {
      const selectedTrackResult = await bridge.getSelectedTrack();
      selectedTrack = selectedTrackResult.data || null;
      executedActions.push({ action: 'getSelectedTrack', status: 'ok' });
    } catch (err) {
      executedActions.push({ action: 'getSelectedTrack', status: 'error', note: err.message });
    }

    // Check 1: Sample rate
    const sampleRate = project.sampleRate;
    if (sampleRate === 44100 || sampleRate === 48000) {
      checklist.push({ step: 'Sample rate', status: 'pass', detail: `Sample rate is ${sampleRate} Hz.` });
      passCount++;
    } else if (sampleRate) {
      checklist.push({ step: 'Sample rate', status: 'warning', detail: `Sample rate is ${sampleRate} Hz. Standard rates are 44100 or 48000 Hz.` });
      warnCount++;
    } else {
      checklist.push({ step: 'Sample rate', status: 'warning', detail: 'Could not determine sample rate.' });
      warnCount++;
    }

    // Check 2: Buffer size
    const bufferSize = bufferInfo.bufferSize || bufferInfo.size;
    if (bufferSize && bufferSize <= 256) {
      checklist.push({ step: 'Buffer size', status: 'pass', detail: `Buffer size is ${bufferSize} samples. Low latency.` });
      passCount++;
    } else if (bufferSize && bufferSize <= 512) {
      checklist.push({ step: 'Buffer size', status: 'warning', detail: `Buffer size is ${bufferSize} samples. Consider lowering to 256 or below for less latency.` });
      warnCount++;
    } else if (bufferSize && bufferSize > 512) {
      checklist.push({ step: 'Buffer size', status: 'fail', detail: `Buffer size is ${bufferSize} samples. Too high for comfortable recording — lower to 256 or below.` });
      failCount++;
    } else {
      checklist.push({ step: 'Buffer size', status: 'warning', detail: 'Could not determine buffer size.' });
      warnCount++;
    }

    // Check 3: Disk space
    const diskSpaceGB = diskInfo.availableGB || diskInfo.freeGB;
    if (diskSpaceGB && diskSpaceGB > 10) {
      checklist.push({ step: 'Disk space', status: 'pass', detail: `${diskSpaceGB.toFixed(1)} GB available. Plenty of space.` });
      passCount++;
    } else if (diskSpaceGB && diskSpaceGB >= 5) {
      checklist.push({ step: 'Disk space', status: 'warning', detail: `${diskSpaceGB.toFixed(1)} GB available. Getting low — consider freeing up space.` });
      warnCount++;
    } else if (diskSpaceGB && diskSpaceGB < 5) {
      checklist.push({ step: 'Disk space', status: 'fail', detail: `${diskSpaceGB.toFixed(1)} GB available. Critically low — free up disk space before recording.` });
      failCount++;
    } else {
      checklist.push({ step: 'Disk space', status: 'warning', detail: 'Could not determine available disk space.' });
      warnCount++;
    }

    // Check 4: Armed tracks
    const armedTracks = tracks.filter(t => t.isArmed);
    if (armedTracks.length > 0) {
      checklist.push({ step: 'Armed tracks', status: 'pass', detail: `${armedTracks.length} track(s) armed: ${armedTracks.map(t => t.name).join(', ')}.` });
      passCount++;
    } else {
      checklist.push({ step: 'Armed tracks', status: 'fail', detail: 'No tracks are armed for recording. Arm a track before hitting record.' });
      failCount++;

      // Propose arming the selected track
      if (selectedTrack) {
        proposedActions.push({
          id: uuidv4(),
          type: 'armTrack',
          label: `Arm "${selectedTrack.name}" for recording`,
          description: `Arm the selected track "${selectedTrack.name}" so it is ready to receive input.`,
          riskLevel: 'low',
          requiresConfirmation: false,
          args: { trackId: selectedTrack.id }
        });
      }
    }

    // Check 5: Input assignment on armed tracks
    if (armedTracks.length > 0) {
      const armedWithInput = armedTracks.filter(t => t.inputLabel && t.inputLabel !== 'None');
      if (armedWithInput.length === armedTracks.length) {
        checklist.push({ step: 'Input assignment', status: 'pass', detail: `All armed tracks have inputs assigned.` });
        passCount++;
      } else {
        const noInput = armedTracks.filter(t => !t.inputLabel || t.inputLabel === 'None');
        checklist.push({ step: 'Input assignment', status: 'fail', detail: `Armed track(s) missing input: ${noInput.map(t => t.name).join(', ')}. Assign an input from your audio interface.` });
        failCount++;
      }
    } else if (selectedTrack) {
      if (selectedTrack.inputLabel && selectedTrack.inputLabel !== 'None') {
        checklist.push({ step: 'Input assignment', status: 'pass', detail: `Selected track input: ${selectedTrack.inputLabel}.` });
        passCount++;
      } else {
        checklist.push({ step: 'Input assignment', status: 'fail', detail: `Selected track "${selectedTrack.name}" has no input assigned.` });
        failCount++;
      }
    } else {
      checklist.push({ step: 'Input assignment', status: 'warning', detail: 'No armed or selected track to check input assignment.' });
      warnCount++;
    }

    // Check 6: Monitoring on armed tracks
    if (armedTracks.length > 0) {
      const armedWithMonitoring = armedTracks.filter(t => t.monitoringOn);
      if (armedWithMonitoring.length === armedTracks.length) {
        checklist.push({ step: 'Monitoring', status: 'pass', detail: 'Monitoring enabled on all armed tracks.' });
        passCount++;
      } else {
        const noMonitoring = armedTracks.filter(t => !t.monitoringOn);
        checklist.push({ step: 'Monitoring', status: 'warning', detail: `Monitoring off on: ${noMonitoring.map(t => t.name).join(', ')}. The artist may not hear themselves.` });
        warnCount++;

        // Propose turning on monitoring
        for (const track of noMonitoring) {
          proposedActions.push({
            id: uuidv4(),
            type: 'toggleMonitoring',
            label: `Enable monitoring on "${track.name}"`,
            description: `Turn on input monitoring for "${track.name}" so the artist can hear themselves.`,
            riskLevel: 'low',
            requiresConfirmation: false,
            args: { trackId: track.id }
          });
        }
      }
    } else {
      checklist.push({ step: 'Monitoring', status: 'warning', detail: 'No armed tracks to check monitoring status.' });
      warnCount++;
    }

    // Check 7: Estimated recording time
    if (diskSpaceGB && sampleRate) {
      // Estimate: mono 24-bit audio at given sample rate
      // bytes per second = sampleRate * 3 (24-bit = 3 bytes per sample)
      const bytesPerSecond = sampleRate * 3;
      const availableBytes = diskSpaceGB * 1024 * 1024 * 1024;
      const availableSeconds = availableBytes / bytesPerSecond;
      const availableMinutes = Math.floor(availableSeconds / 60);
      checklist.push({ step: 'Estimated recording time', status: 'info', detail: `~${availableMinutes} minutes of mono 24-bit audio at ${sampleRate} Hz.` });
    } else {
      checklist.push({ step: 'Estimated recording time', status: 'info', detail: 'Could not estimate — missing sample rate or disk space data.' });
    }

    return {
      workflow: 'preflightCheck',
      summary: `Pre-flight check: ${passCount} passed, ${warnCount} warnings, ${failCount} issues.`,
      requiresConfirmation: false,
      proposedActions,
      checklist,
      expectedOutcome: 'Session readiness report with actionable recommendations.',
      executedActions
    };
  }
};
