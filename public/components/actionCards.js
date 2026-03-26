window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.ActionCards = (() => {
  const State = () => window.SessionPilot.State;
  const API = () => window.SessionPilot.API;

  function render(pending) {
    const container = document.getElementById('action-cards-area');
    if (!container) return;

    // If no pending actions or empty array, clear the area
    if (!pending || !pending.actions || pending.actions.length === 0) {
      container.innerHTML = '';
      return;
    }

    const { actions, context, requiresConfirmation } = pending;

    const riskIcons = {
      low: '\u2713',
      medium: '\u26A0',
      high: '\u2717'
    };

    container.innerHTML = `
      <div class="action-cards-container">
        <div class="panel-header">PROPOSED ACTIONS (${actions.length})</div>
        <div class="action-cards-list">
          ${actions.map((action, i) => {
            const risk = action.riskLevel || 'low';
            return `
              <div class="action-card" data-index="${i}">
                <div class="action-card-icon">${riskIcons[risk] || '\u2713'}</div>
                <div class="action-card-body">
                  <div class="action-card-label">${escapeHtml(action.label || action.action || 'Action')}</div>
                  <div class="action-card-desc">${escapeHtml(action.description || '')}</div>
                </div>
                <div class="action-card-meta">
                  <span class="risk-badge risk-${risk}">${risk}</span>
                  ${requiresConfirmation ? '<span class="risk-badge risk-medium" style="font-size:8px;">CONFIRM</span>' : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="action-cards-footer">
          <button class="btn btn-small btn-secondary" id="action-cards-dismiss">Dismiss</button>
          ${requiresConfirmation
            ? '<button class="btn btn-small btn-primary" id="action-cards-review">Review &amp; Confirm</button>'
            : '<button class="btn btn-small btn-success" id="action-cards-execute">Execute All</button>'
          }
        </div>
      </div>
    `;

    // Bind dismiss
    const dismissBtn = document.getElementById('action-cards-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        State().set('pendingActions', []);
      });
    }

    // Bind review/confirm
    const reviewBtn = document.getElementById('action-cards-review');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', () => {
        window.SessionPilot.ConfirmModal.show(pending);
      });
    }

    // Bind direct execute
    const executeBtn = document.getElementById('action-cards-execute');
    if (executeBtn) {
      executeBtn.addEventListener('click', () => executeAll(pending));
    }
  }

  async function executeAll(pending) {
    if (!pending || !pending.context) return;

    const executeBtn = document.getElementById('action-cards-execute');
    if (executeBtn) {
      executeBtn.disabled = true;
      executeBtn.textContent = 'Executing...';
    }

    try {
      const result = await API().executeAction({
        workflow: pending.context.workflow,
        args: pending.context.args,
        confirmed: true
      });

      // Clear pending
      State().set('pendingActions', []);

      if (result.ok !== false) {
        const summary = (result.data && result.data.summary) || result.summary || 'Actions executed successfully.';
        State().addChatMessage('assistant', `Done! ${summary}`);
        State().addActionLogEntry({
          label: pending.context.workflow || 'Batch execution',
          status: 'success',
          type: 'execution'
        });
      } else {
        State().addChatMessage('assistant', `Something went wrong: ${result.error || 'Unknown error'}`);
        State().addActionLogEntry({
          label: pending.context.workflow || 'Batch execution',
          status: 'failure',
          type: 'execution'
        });
      }

      // Refresh state
      window.SessionPilot.WS.refresh();
    } catch (e) {
      console.error('Execute all failed:', e);
      State().addChatMessage('assistant', 'Execution failed. Check server connection.');
      State().set('pendingActions', []);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function init() {
    State().on('pendingActions', render);
    render(State().get('pendingActions'));
  }

  return { init };
})();
