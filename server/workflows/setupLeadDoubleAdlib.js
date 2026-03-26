const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'setupLeadDoubleAdlib',
  description: 'Create a complete vocal stack: lead, doubles, and adlibs in a folder.',

  async preview(bridge, args = {}) {
    const proposedActions = [
      {
        id: uuidv4(),
        type: 'createFolderTrack',
        label: 'Create "Vocals" folder track',
        description: 'Create a parent folder track named "Vocals" with color #2ecc71.',
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { name: 'Vocals', color: '#2ecc71' }
      },
      {
        id: uuidv4(),
        type: 'createTrack',
        label: 'Create "Lead Vocal" track',
        description: 'Create "Lead Vocal" track inside the Vocals folder with color #e74c3c. Arm for recording and enable monitoring.',
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { name: 'Lead Vocal', color: '#e74c3c', parent: 'Vocals', armed: true, monitoring: true }
      },
      {
        id: uuidv4(),
        type: 'createTrack',
        label: 'Create "Double L" track',
        description: 'Create "Double L" track inside the Vocals folder with color #e67e22.',
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { name: 'Double L', color: '#e67e22', parent: 'Vocals' }
      },
      {
        id: uuidv4(),
        type: 'createTrack',
        label: 'Create "Double R" track',
        description: 'Create "Double R" track inside the Vocals folder with color #f39c12.',
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { name: 'Double R', color: '#f39c12', parent: 'Vocals' }
      },
      {
        id: uuidv4(),
        type: 'createTrack',
        label: 'Create "Adlibs" track',
        description: 'Create "Adlibs" track inside the Vocals folder with color #9b59b6.',
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { name: 'Adlibs', color: '#9b59b6', parent: 'Vocals' }
      }
    ];

    return {
      workflow: 'setupLeadDoubleAdlib',
      summary: 'Set up a complete vocal stack: lead, left double, right double, and adlibs in a folder.',
      requiresConfirmation: true,
      proposedActions,
      checklist: null,
      expectedOutcome: 'Vocal folder with 4 tracks. Lead armed with monitoring.'
    };
  },

  async execute(bridge, args = {}) {
    const folderResult = await bridge.createFolderTrack({ name: 'Vocals', color: '#2ecc71' });
    const folderId = folderResult.data;

    const leadResult = await bridge.createTrack({ name: 'Lead Vocal', color: '#e74c3c', parent: folderId });
    const leadId = leadResult.data;
    await bridge.createTrack({ name: 'Double L', color: '#e67e22', parent: folderId });
    await bridge.createTrack({ name: 'Double R', color: '#f39c12', parent: folderId });
    await bridge.createTrack({ name: 'Adlibs', color: '#9b59b6', parent: folderId });

    await bridge.armTrack(leadId);
    await bridge.toggleMonitoring(leadId, true);

    return {
      workflow: 'setupLeadDoubleAdlib',
      summary: 'Set up a complete vocal stack: lead, left double, right double, and adlibs in a folder.',
      requiresConfirmation: true,
      proposedActions: [],
      checklist: null,
      expectedOutcome: 'Vocal folder with 4 tracks. Lead armed with monitoring.'
    };
  }
};
