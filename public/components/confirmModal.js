window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.ConfirmModal = (() => {
  const State = () => window.SessionPilot.State;
  const PendingActions = () => window.SessionPilot.PendingActions;

  let currentData = null;

  function show(data) {
    currentData = data;
    const modal = document.getElementById('confirm-modal');
    const body = document.getElementById('modal-body');
    const title = document.getElementById('modal-title');

    if (!modal || !body) return;

    // Set title
    const workflowName = data.context && data.context.workflow
      ? formatWorkflowName(data.context.workflow)
      : 'Actions';
    title.textContent = `Confirm: ${workflowName}`;

    // Build body content
    const expectedOutcome = data.context && data.context.expectedOutcome
      ? `<p class="expected-outcome">${escapeHtml(data.context.expectedOutcome)}</p>`
      : '';

    const actionItems = (data.actions || []).map(a => {
      const risk = a.riskLevel || 'low';
      return `
        <div class="confirm-action-item">
          <span class="risk-badge risk-${risk}">${risk}</span>
          <span class="action-label">${escapeHtml(a.label || a.action || 'Action')}</span>
          <span class="action-desc">${escapeHtml(a.description || '')}</span>
        </div>
      `;
    }).join('');

    body.innerHTML = `
      ${expectedOutcome}
      <div class="action-list">
        ${actionItems}
      </div>
    `;

    modal.classList.remove('hidden');
  }

  function hide() {
    const modal = document.getElementById('confirm-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
    currentData = null;
    State().set('pendingActions', []);
  }

  async function confirm() {
    const pending = currentData || State().get('pendingActions');
    if (!pending) {
      hide();
      return;
    }

    // Disable confirm button during execution
    const confirmBtn = document.getElementById('modal-confirm');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Executing...';
    }

    try {
      await PendingActions().execute(pending, {
        label: (pending.context && (pending.context.workflow || pending.context.actionType)) || 'Confirmed execution'
      });
    } catch (e) {
      console.error('Confirm execute failed:', e);
      State().addChatMessage('assistant', 'Execution failed. Check server connection.');
      hide();
    } finally {
      // Reset button state
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Execute';
      }
    }
  }

  function formatWorkflowName(name) {
    // Convert camelCase to Title Case with spaces
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .trim();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function init() {
    const cancelBtn = document.getElementById('modal-cancel');
    const confirmBtn = document.getElementById('modal-confirm');
    const overlay = document.getElementById('confirm-modal');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', hide);
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', confirm);
    }

    // Close on overlay click (not on modal content click)
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          hide();
        }
      });
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('confirm-modal');
        if (modal && !modal.classList.contains('hidden')) {
          hide();
        }
      }
    });
  }

  return { init, show, hide, confirm };
})();
