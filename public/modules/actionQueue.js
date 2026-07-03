window.SessionPilot = window.SessionPilot || {};

/**
 * ActionQueue - Sequential action executor.
 * Queues actions and executes them one at a time, preventing overlapping operations.
 * Also supports multi-action sequences ("arm track then hit record").
 */
window.SessionPilot.ActionQueue = (() => {
  const State = () => window.SessionPilot.State;
  const API = () => window.SessionPilot.API;

  const queue = [];
  let processing = false;

  /**
   * Add one or more actions to the queue.
   * @param {Object|Object[]} actions - Action(s) with { actionType, args, label }
   */
  function enqueue(actions) {
    const items = Array.isArray(actions) ? actions : [actions];
    for (const item of items) {
      queue.push(item);
    }
    if (!processing) processNext();
  }

  async function processNext() {
    if (queue.length === 0) {
      processing = false;
      return;
    }

    processing = true;
    const action = queue.shift();

    try {
      const payload = action.workflow
        ? { workflow: action.workflow, args: action.args || {}, confirmed: true }
        : { actionType: action.actionType || action.type, args: action.args || {}, confirmed: true };

      const result = await API().executeAction(payload);

      if (result.ok !== false) {
        State().addActionLogEntry({
          label: action.label || action.actionType || action.type || 'Action',
          status: 'success',
          type: 'execution'
        });
      } else {
        State().addActionLogEntry({
          label: action.label || action.actionType || action.type || 'Action',
          status: 'failure',
          type: 'execution'
        });
        // On failure, optionally clear remaining queue
        if (action.abortOnFail) {
          queue.length = 0;
          processing = false;
          return;
        }
      }
    } catch (e) {
      console.error('ActionQueue execution failed:', e);
      State().addActionLogEntry({
        label: action.label || 'Action',
        status: 'failure',
        type: 'execution'
      });
    }

    // Small delay between queued actions for state propagation
    await new Promise(resolve => setTimeout(resolve, 150));
    processNext();
  }

  function isProcessing() {
    return processing;
  }

  function pending() {
    return queue.length;
  }

  function clear() {
    queue.length = 0;
  }

  /**
   * Execute an ordered plan of actions sequentially, one at a time, awaiting
   * each /api/actions/execute call before starting the next. Used for
   * multi-step agent plans that must be confirmed and run as a single unit
   * (as opposed to enqueue/processNext, which is a separate FIFO queue).
   *
   * @param {Object[]} actions - Ordered actions with { type|actionType, args, label }
   * @param {Object} [options]
   * @param {boolean} [options.abortOnFail=true] - Stop the plan on first failure
   * @returns {Promise<{ok: boolean, results: Array, failedAt?: number, error?: string}>}
   */
  async function executePlan(actions, options = {}) {
    const abortOnFail = options.abortOnFail !== false;
    const items = Array.isArray(actions) ? actions : [actions];
    const results = [];

    for (let i = 0; i < items.length; i++) {
      const action = items[i] || {};
      const actionType = action.actionType || action.type;
      const args = action.args ||
        (window.SessionPilot.PendingActions ? window.SessionPilot.PendingActions.extractActionArgs(action) : {});
      const stepLabel = action.label || actionType || `Step ${i + 1}`;

      try {
        const result = await API().executeAction({ actionType, args, confirmed: true });
        results.push(result);

        State().addActionLogEntry({
          label: stepLabel,
          status: result.ok !== false ? 'success' : 'failure',
          type: 'execution'
        });

        if (result.ok === false && abortOnFail) {
          return { ok: false, results, failedAt: i, error: result.error || 'Step failed' };
        }
      } catch (e) {
        console.error('ActionQueue.executePlan step failed:', e);
        State().addActionLogEntry({
          label: stepLabel,
          status: 'failure',
          type: 'execution'
        });
        return { ok: false, results, failedAt: i, error: e.message };
      }
    }

    return { ok: true, results };
  }

  return { enqueue, isProcessing, pending, clear, executePlan };
})();
