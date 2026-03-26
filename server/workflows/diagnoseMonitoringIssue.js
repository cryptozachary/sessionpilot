const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'diagnoseMonitoringIssue',
  description: 'Diagnose why you cannot hear your input through REAPER.',

  async preview(bridge, args = {}) {
    const proposedActions = [
      {
        id: uuidv4(),
        type: 'readTrackState',
        label: 'Inspect track arm and monitoring states',
        description: 'Read the current state of all tracks to check arm and monitoring status.',
        riskLevel: 'low',
        requiresConfirmation: false,
        args: {}
      },
      {
        id: uuidv4(),
        type: 'readTrackState',
        label: 'Check selected track configuration',
        description: 'Examine the selected track for input assignment, mute, solo, and routing.',
        riskLevel: 'low',
        requiresConfirmation: false,
        args: {}
      },
      {
        id: uuidv4(),
        type: 'generateReport',
        label: 'Generate diagnostic report',
        description: 'Produce a checklist of findings and suggestions based on track state.',
        riskLevel: 'low',
        requiresConfirmation: false,
        args: {}
      }
    ];

    return {
      workflow: 'diagnoseMonitoringIssue',
      summary: 'Diagnose why you can\'t hear your input through REAPER.',
      requiresConfirmation: false,
      proposedActions,
      checklist: [
        { step: 'Check if any track is armed', status: 'unknown' },
        { step: 'Check if monitoring is enabled on armed tracks', status: 'unknown' },
        { step: 'Check if the track is muted or soloed elsewhere', status: 'unknown' },
        { step: 'Check if there is an input assigned', status: 'unknown' },
        { step: 'Check for potential routing issues', status: 'unknown' }
      ],
      expectedOutcome: 'Diagnostic report with specific fixes for your monitoring setup.'
    };
  },

  async execute(bridge, args = {}) {
    const tracksResult = await bridge.listTracks();
    const tracks = tracksResult.data || [];
    const selectedTrackResult = await bridge.getSelectedTrack();
    const selectedTrack = selectedTrackResult.data || null;

    const checklist = [];
    const proposedActions = [];

    // Check 1: Is any track armed?
    const armedTracks = tracks.filter(t => t.isArmed);
    if (armedTracks.length === 0) {
      checklist.push({
        step: 'Check if any track is armed',
        status: 'fail',
        detail: 'No tracks are currently armed for recording. You need to arm a track to hear input.'
      });
    } else {
      checklist.push({
        step: 'Check if any track is armed',
        status: 'pass',
        detail: `${armedTracks.length} track(s) armed: ${armedTracks.map(t => t.name).join(', ')}.`
      });
    }

    // Check 2: Is monitoring enabled on armed tracks?
    const armedWithMonitoring = armedTracks.filter(t => t.monitoringOn);
    const armedWithoutMonitoring = armedTracks.filter(t => !t.monitoringOn);
    if (armedTracks.length > 0 && armedWithMonitoring.length === 0) {
      checklist.push({
        step: 'Check if monitoring is enabled on armed tracks',
        status: 'fail',
        detail: 'None of the armed tracks have monitoring enabled. Enable input monitoring to hear yourself.'
      });
    } else if (armedWithoutMonitoring.length > 0) {
      checklist.push({
        step: 'Check if monitoring is enabled on armed tracks',
        status: 'warning',
        detail: `Monitoring is off on: ${armedWithoutMonitoring.map(t => t.name).join(', ')}.`
      });
    } else if (armedTracks.length > 0) {
      checklist.push({
        step: 'Check if monitoring is enabled on armed tracks',
        status: 'pass',
        detail: 'Monitoring is enabled on all armed tracks.'
      });
    } else {
      checklist.push({
        step: 'Check if monitoring is enabled on armed tracks',
        status: 'unknown',
        detail: 'No armed tracks to check.'
      });
    }

    // Check 3: Is the selected track muted or soloed elsewhere?
    if (selectedTrack) {
      if (selectedTrack.isMuted) {
        checklist.push({
          step: 'Check if the track is muted',
          status: 'fail',
          detail: `"${selectedTrack.name}" is muted. Unmute it to hear the input.`
        });
      } else {
        checklist.push({
          step: 'Check if the track is muted',
          status: 'pass',
          detail: `"${selectedTrack.name}" is not muted.`
        });
      }

      const soloedTracks = tracks.filter(t => t.isSolo && t.id !== selectedTrack.id);
      if (soloedTracks.length > 0) {
        checklist.push({
          step: 'Check if another track is soloed',
          status: 'warning',
          detail: `Other tracks are soloed: ${soloedTracks.map(t => t.name).join(', ')}. This may silence your input track.`
        });
      } else {
        checklist.push({
          step: 'Check if another track is soloed',
          status: 'pass',
          detail: 'No other tracks are soloed.'
        });
      }
    } else {
      checklist.push({
        step: 'Check if the track is muted or soloed elsewhere',
        status: 'unknown',
        detail: 'No track is currently selected.'
      });
    }

    // Check 4: Is there an input assigned?
    if (selectedTrack) {
      if (!selectedTrack.inputLabel || selectedTrack.inputLabel === 'None') {
        checklist.push({
          step: 'Check if there is an input assigned',
          status: 'fail',
          detail: `"${selectedTrack.name}" has no input assigned. Assign an input from your audio interface.`
        });
      } else {
        checklist.push({
          step: 'Check if there is an input assigned',
          status: 'pass',
          detail: `Input assigned: ${selectedTrack.inputLabel}.`
        });
      }
    } else {
      checklist.push({
        step: 'Check if there is an input assigned',
        status: 'unknown',
        detail: 'No track is currently selected to check input assignment.'
      });
    }

    // Check 5: Routing
    checklist.push({
      step: 'Check for potential routing issues',
      status: 'warning',
      detail: 'Verify that the track output is routed to your master/monitor bus and that your audio interface output is configured correctly in REAPER preferences.'
    });

    // If monitoring is off on the selected armed track, propose turning it on
    if (selectedTrack && selectedTrack.isArmed && !selectedTrack.monitoringOn) {
      proposedActions.push({
        id: uuidv4(),
        type: 'toggleMonitoring',
        label: `Enable monitoring on "${selectedTrack.name}"`,
        description: `Turn on input monitoring for "${selectedTrack.name}" so you can hear yourself.`,
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { trackId: selectedTrack.id }
      });
    }

    return {
      workflow: 'diagnoseMonitoringIssue',
      summary: 'Diagnose why you can\'t hear your input through REAPER.',
      requiresConfirmation: false,
      proposedActions,
      checklist,
      expectedOutcome: 'Diagnostic report with specific fixes for your monitoring setup.'
    };
  }
};
