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

  async executeWorkflow(bridge, workflowName, args = {}, options = {}) {
    const wf = getWorkflow(workflowName);
    if (!wf) return { ok: false, error: 'Unknown workflow: ' + workflowName };

    // Emit start progress
    if (options.onProgress) {
      const preview = await wf.preview(bridge, args);
      const totalSteps = preview.proposedActions ? preview.proposedActions.length : 0;
      options.onProgress({ workflow: workflowName, phase: 'start', totalSteps, step: 0 });
    }

    const result = await wf.execute(bridge, args);

    // Log each executed action and emit step progress
    if (result.executedActions) {
      const total = result.executedActions.length;
      result.executedActions.forEach((a, i) => {
        actionLog.logExecution(a);
        if (options.onProgress) {
          options.onProgress({
            workflow: workflowName,
            phase: 'step',
            step: i + 1,
            totalSteps: total,
            label: a.label || a.action || 'Step ' + (i + 1)
          });
        }
      });
    }

    // Emit completion
    if (options.onProgress) {
      options.onProgress({ workflow: workflowName, phase: 'done' });
    }

    return { ok: true, data: result };
  },

  listWorkflows() {
    return listWorkflows();
  }
};
