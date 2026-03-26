// SessionPilot for REAPER - Workflow Service
// Orchestrates workflow preview and execution through the bridge.

const { getWorkflow, listWorkflows } = require('../workflows');
const actionLog = require('./actionLog');

module.exports = {
  async previewWorkflow(bridge, workflowName, args = {}) {
    const wf = getWorkflow(workflowName);
    if (!wf) return { ok: false, error: 'Unknown workflow: ' + workflowName };
    const result = await wf.preview(bridge, args);
    actionLog.logProposal({ actions: result.proposedActions, source: workflowName });
    return { ok: true, data: result };
  },

  async executeWorkflow(bridge, workflowName, args = {}) {
    const wf = getWorkflow(workflowName);
    if (!wf) return { ok: false, error: 'Unknown workflow: ' + workflowName };
    const result = await wf.execute(bridge, args);
    // Log each executed action
    if (result.executedActions) {
      result.executedActions.forEach(a => actionLog.logExecution(a));
    }
    return { ok: true, data: result };
  },

  listWorkflows() {
    return listWorkflows();
  }
};
