window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.PendingActions = (() => {
  const State = () => window.SessionPilot.State;
  const API = () => window.SessionPilot.API;
  const WS = () => window.SessionPilot.WS;

  function extractActionArgs(action = {}) {
    if (action.args && typeof action.args === 'object') {
      return { ...action.args };
    }

    const args = { ...action };
    delete args.id;
    delete args.type;
    delete args.label;
    delete args.description;
    delete args.riskLevel;
    delete args.requiresConfirmation;
    return args;
  }

  function buildExecutePayload(pending) {
    if (!pending) return null;

    if (pending.context && pending.context.workflow) {
      return {
        workflow: pending.context.workflow,
        args: pending.context.args || {},
        confirmed: true
      };
    }

    if (pending.context && pending.context.actionType) {
      return {
        actionType: pending.context.actionType,
        args: pending.context.args || {},
        confirmed: true
      };
    }

    const [firstAction] = pending.actions || [];
    if (!firstAction || !firstAction.type) return null;

    return {
      actionType: firstAction.type,
      args: extractActionArgs(firstAction),
      confirmed: true
    };
  }

  async function execute(pending, options = {}) {
    const payload = buildExecutePayload(pending);
    if (!payload) {
      throw new Error('No executable pending action');
    }

    const label =
      options.label ||
      (pending && pending.context && (pending.context.workflow || pending.context.actionType)) ||
      (pending && pending.actions && pending.actions[0] && pending.actions[0].label) ||
      payload.workflow ||
      payload.actionType ||
      'Pending action';

    const result = await API().executeAction(payload);
    State().set('pendingActions', []);

    if (window.SessionPilot.ConfirmModal && typeof window.SessionPilot.ConfirmModal.hide === 'function') {
      window.SessionPilot.ConfirmModal.hide();
    }

    if (result.ok !== false) {
      const summary =
        options.successMessage ||
        (result.data && result.data.summary) ||
        result.summary ||
        'Actions executed successfully.';
      State().addChatMessage('assistant', `Done! ${summary}`);
      State().addActionLogEntry({
        label,
        status: 'success',
        type: 'execution'
      });
    } else {
      const errorMessage = options.errorMessage || result.error || 'Unknown error';
      State().addChatMessage('assistant', `Something went wrong: ${errorMessage}`);
      State().addActionLogEntry({
        label,
        status: 'failure',
        type: 'execution'
      });
    }

    WS().refresh();
    return result;
  }

  function cancel(message = 'Okay, cancelled.') {
    if (window.SessionPilot.ConfirmModal && typeof window.SessionPilot.ConfirmModal.hide === 'function') {
      window.SessionPilot.ConfirmModal.hide();
    } else {
      State().set('pendingActions', []);
    }

    State().addChatMessage('assistant', message);
  }

  return {
    extractActionArgs,
    buildExecutePayload,
    execute,
    cancel
  };
})();
