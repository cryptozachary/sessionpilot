window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.ActionCards = (() => {
  const State = () => window.SessionPilot.State;
  const PendingActions = () => window.SessionPilot.PendingActions;

  function render(pending) {
    const container = document.getElementById('action-cards-area');
    if (!container) return;

    // If no pending actions or empty array, clear the area
    if (!pending || !pending.actions || pending.actions.length === 0) {
      container.innerHTML = '';
      return;
    }

    const { actions, context, requiresConfirmation } = pending;

    // Multi-step agent plans get a dedicated numbered-plan renderer with a
    // single "Confirm plan" control instead of the per-card layout below.
    if (actions.length > 1) {
      renderPlan(pending, container);
      return;
    }

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
    if (!pending) return;

    const executeBtn = document.getElementById('action-cards-execute');
    if (executeBtn) {
      executeBtn.disabled = true;
      executeBtn.textContent = 'Executing...';
    }

    try {
      await PendingActions().execute(pending, {
        label: (pending.context && (pending.context.workflow || pending.context.actionType)) || 'Batch execution'
      });
    } catch (e) {
      console.error('Execute all failed:', e);
      State().addChatMessage('assistant', 'Execution failed. Check server connection.');
      State().set('pendingActions', []);
    }
  }

  /**
   * Render a multi-step agent plan as an ordered, numbered list with a
   * single "Confirm plan" control. Confirming executes every step in order
   * via ActionQueue.executePlan (sequential /api/actions/execute calls).
   */
  function renderPlan(pending, container) {
    const { actions } = pending;

    const riskIcons = {
      low: '✓',
      medium: '⚠',
      high: '✗'
    };

    container.innerHTML = `
      <div class="action-cards-container action-plan-container">
        <div class="panel-header">PROPOSED PLAN (${actions.length} STEPS)</div>
        <ol class="action-plan-list">
          ${actions.map((action) => {
            const risk = action.riskLevel || 'low';
            return `
              <li class="action-plan-step">
                <span class="action-plan-step-icon">${riskIcons[risk] || '✓'}</span>
                <span class="action-plan-step-label">${escapeHtml(action.label || action.type || action.action || 'Action')}</span>
                ${action.description ? `<span class="action-plan-step-desc">${escapeHtml(action.description)}</span>` : ''}
                <span class="risk-badge risk-${risk}">${risk}</span>
              </li>
            `;
          }).join('')}
        </ol>
        <div class="action-cards-footer">
          <button class="btn btn-small btn-secondary" id="action-plan-cancel">Cancel</button>
          <button class="btn btn-small btn-primary" id="action-plan-confirm">Confirm plan (${actions.length} steps)</button>
        </div>
      </div>
    `;

    const cancelBtn = document.getElementById('action-plan-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        State().set('pendingActions', []);
      });
    }

    const confirmBtn = document.getElementById('action-plan-confirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => executePlan(pending));
    }
  }

  async function executePlan(pending) {
    if (!pending) return;

    const confirmBtn = document.getElementById('action-plan-confirm');
    const cancelBtn = document.getElementById('action-plan-cancel');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Executing...';
    }
    if (cancelBtn) cancelBtn.disabled = true;

    const totalSteps = pending.actions.length;

    try {
      const result = await window.SessionPilot.ActionQueue.executePlan(pending.actions);
      State().set('pendingActions', []);

      if (result.ok !== false) {
        State().addChatMessage('assistant', `Done! Completed all ${totalSteps} steps of the plan.`);
      } else {
        const failedStep = typeof result.failedAt === 'number' ? result.failedAt + 1 : '?';
        State().addChatMessage(
          'assistant',
          `Plan stopped at step ${failedStep} of ${totalSteps}: ${result.error || 'unknown error'}`
        );
      }

      if (window.SessionPilot.WS && typeof window.SessionPilot.WS().refresh === 'function') {
        window.SessionPilot.WS().refresh();
      }
    } catch (e) {
      console.error('Plan execution failed:', e);
      State().addChatMessage('assistant', 'Plan execution failed. Check server connection.');
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
