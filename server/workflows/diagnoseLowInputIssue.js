const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'diagnoseLowInputIssue',
  description: 'Diagnose possible causes of low input level in REAPER.',

  async preview(bridge, args = {}) {
    const proposedActions = [
      {
        id: uuidv4(),
        type: 'readTrackState',
        label: 'Inspect track input and gain settings',
        description: 'Read the current state of tracks to check input assignment, arm status, and volume/gain.',
        riskLevel: 'low',
        requiresConfirmation: false,
        args: {}
      },
      {
        id: uuidv4(),
        type: 'generateReport',
        label: 'Generate low-input diagnostic report',
        description: 'Produce a checklist of possible causes and recommendations for low input levels.',
        riskLevel: 'low',
        requiresConfirmation: false,
        args: {}
      }
    ];

    return {
      workflow: 'diagnoseLowInputIssue',
      summary: 'Diagnose possible causes of low input level.',
      requiresConfirmation: false,
      proposedActions,
      checklist: [
        { step: 'Check if there is an input assigned', status: 'unknown' },
        { step: 'Check if the track is armed', status: 'unknown' },
        { step: 'Check track volume/gain level', status: 'unknown' },
        { step: 'Check hardware: mic cable and connections', status: 'unknown' },
        { step: 'Check hardware: phantom power (if condenser mic)', status: 'unknown' },
        { step: 'Check hardware: preamp/interface input gain', status: 'unknown' },
        { step: 'Check monitoring mode: input vs software monitoring', status: 'unknown' }
      ],
      expectedOutcome: 'Checklist of common low-input causes with recommendations.'
    };
  },

  async execute(bridge, args = {}) {
    const tracksResult = await bridge.listTracks();
    const tracks = tracksResult.data || [];
    const selectedTrackResult = await bridge.getSelectedTrack();
    const selectedTrack = selectedTrackResult.data || null;

    const checklist = [];
    const proposedActions = [];

    // Check 1: Is there an input assigned?
    if (selectedTrack) {
      if (!selectedTrack.inputLabel || selectedTrack.inputLabel === 'None') {
        checklist.push({
          step: 'Check if there is an input assigned',
          status: 'fail',
          detail: `"${selectedTrack.name}" has no input assigned. Without an input, no signal will be received. Assign an input from your audio interface.`
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
        detail: 'No track is currently selected. Select the track you are recording to.'
      });
    }

    // Check 2: Is the track armed?
    if (selectedTrack) {
      if (!selectedTrack.isArmed) {
        checklist.push({
          step: 'Check if the track is armed',
          status: 'fail',
          detail: `"${selectedTrack.name}" is not armed for recording. Arm the track to enable input signal flow.`
        });
      } else {
        checklist.push({
          step: 'Check if the track is armed',
          status: 'pass',
          detail: `"${selectedTrack.name}" is armed for recording.`
        });
      }
    } else {
      checklist.push({
        step: 'Check if the track is armed',
        status: 'unknown',
        detail: 'No track is currently selected.'
      });
    }

    // Check 3: Track volume/gain
    if (selectedTrack) {
      const volume = selectedTrack.volume !== undefined ? selectedTrack.volume : null;
      if (volume !== null && volume < 0.1) {
        checklist.push({
          step: 'Check track volume/gain level',
          status: 'fail',
          detail: `"${selectedTrack.name}" volume is very low (${(volume * 100).toFixed(0)}%). Raise the track fader.`
        });
      } else if (volume !== null) {
        checklist.push({
          step: 'Check track volume/gain level',
          status: 'pass',
          detail: `Track volume is at ${(volume * 100).toFixed(0)}%.`
        });
      } else {
        checklist.push({
          step: 'Check track volume/gain level',
          status: 'unknown',
          detail: 'Unable to read track volume. Visually confirm that the track fader is not pulled all the way down.'
        });
      }
    } else {
      checklist.push({
        step: 'Check track volume/gain level',
        status: 'unknown',
        detail: 'No track selected to check volume.'
      });
    }

    // Check 4: Hardware - mic cable
    checklist.push({
      step: 'Check hardware: mic cable and connections',
      status: 'warning',
      detail: 'Verify your mic cable is securely connected at both ends. Try a different cable if available. Ensure you are plugged into the correct input on your interface.'
    });

    // Check 5: Phantom power
    checklist.push({
      step: 'Check hardware: phantom power (if condenser mic)',
      status: 'warning',
      detail: 'If you are using a condenser microphone, make sure 48V phantom power is enabled on your audio interface for that input channel. Dynamic mics do not require phantom power.'
    });

    // Check 6: Preamp / interface input gain
    checklist.push({
      step: 'Check hardware: preamp/interface input gain',
      status: 'warning',
      detail: 'Turn up the input gain knob on your audio interface. Aim for peaks around -12dB to -6dB on the interface meters. Note: SessionPilot cannot measure actual audio levels from your hardware.'
    });

    // Check 7: Monitoring mode
    if (selectedTrack && selectedTrack.monitoringOn) {
      checklist.push({
        step: 'Check monitoring mode: input vs software monitoring',
        status: 'pass',
        detail: 'Software input monitoring is enabled. If your interface also has direct monitoring turned on, you may hear a doubled signal but levels should be present.'
      });
    } else if (selectedTrack && !selectedTrack.monitoringOn) {
      checklist.push({
        step: 'Check monitoring mode: input vs software monitoring',
        status: 'warning',
        detail: 'Software monitoring is off. If your interface direct monitoring is also off, you will not hear input. Enable monitoring on the track or use your interface\'s direct monitor feature.'
      });
    } else {
      checklist.push({
        step: 'Check monitoring mode: input vs software monitoring',
        status: 'unknown',
        detail: 'No track selected. Check that either REAPER input monitoring or your interface direct monitoring is enabled.'
      });
    }

    return {
      workflow: 'diagnoseLowInputIssue',
      summary: 'Diagnose possible causes of low input level.',
      requiresConfirmation: false,
      proposedActions,
      checklist,
      expectedOutcome: 'Checklist of common low-input causes with recommendations.'
    };
  }
};
