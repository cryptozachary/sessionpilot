const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'setupLeadVocal',
  description: 'Create and configure a lead vocal track, armed and ready to record.',

  async preview(bridge, args = {}) {
    const proposedActions = [
      {
        id: uuidv4(),
        type: 'createTrack',
        label: 'Create Lead Vocal track',
        description: 'Create a new track named "Lead Vocal" with color #e74c3c.',
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { name: 'Lead Vocal', color: '#e74c3c' }
      },
      {
        id: uuidv4(),
        type: 'armTrack',
        label: 'Arm the track for recording',
        description: 'Arm the Lead Vocal track so it is ready to receive input.',
        riskLevel: 'low',
        requiresConfirmation: false,
        args: {}
      },
      {
        id: uuidv4(),
        type: 'toggleMonitoring',
        label: 'Enable input monitoring',
        description: 'Turn on input monitoring so the vocalist can hear themselves.',
        riskLevel: 'low',
        requiresConfirmation: false,
        args: {}
      }
    ];

    if (args.loadTemplate) {
      proposedActions.push({
        id: uuidv4(),
        type: 'loadTrackTemplate',
        label: 'Load "Lead Vocal Starter" template',
        description: 'Apply the Lead Vocal Starter track template with preconfigured FX chain.',
        riskLevel: 'medium',
        requiresConfirmation: false,
        args: { templateName: 'Lead Vocal Starter' }
      });
    }

    return {
      workflow: 'setupLeadVocal',
      summary: 'Set up a lead vocal track, armed and ready to record.',
      requiresConfirmation: false,
      proposedActions,
      checklist: null,
      expectedOutcome: 'One armed lead vocal track with monitoring enabled'
    };
  },

  async execute(bridge, args = {}) {
    const trackResult = await bridge.createTrack({ name: 'Lead Vocal', color: '#e74c3c' });
    const trackId = trackResult.data;
    await bridge.armTrack(trackId);
    await bridge.toggleMonitoring(trackId, true);

    if (args.loadTemplate) {
      await bridge.loadTrackTemplate(trackId, 'Lead Vocal Starter');
    }

    return {
      workflow: 'setupLeadVocal',
      summary: 'Set up a lead vocal track, armed and ready to record.',
      requiresConfirmation: false,
      proposedActions: [],
      checklist: null,
      expectedOutcome: 'One armed lead vocal track with monitoring enabled'
    };
  }
};
