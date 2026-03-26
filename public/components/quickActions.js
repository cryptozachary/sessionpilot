window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.QuickActions = (() => {
  const State = () => window.SessionPilot.State;
  const API = () => window.SessionPilot.API;

  const actions = [
    {
      label: 'New Vocal Track',
      workflow: 'setupLeadVocal',
      args: {},
      needsConfirm: false,
      icon: '\u{1F3A4}'
    },
    {
      label: 'Vocal Stack',
      workflow: 'setupLeadDoubleAdlib',
      args: {},
      needsConfirm: true,
      icon: '\u{1F3B6}'
    },
    {
      label: 'Arm Selected',
      workflow: 'armTrack',
      args: { target: 'selected' },
      needsConfirm: false,
      icon: '\u{1F534}'
    },
    {
      label: 'Monitor On',
      workflow: 'setMonitoring',
      args: { target: 'selected', enabled: true },
      needsConfirm: false,
      icon: '\u{1F50A}'
    },
    {
      label: 'Monitor Off',
      workflow: 'setMonitoring',
      args: { target: 'selected', enabled: false },
      needsConfirm: false,
      icon: '\u{1F507}'
    },
    {
      label: 'Add Marker',
      workflow: 'insertMarker',
      args: {},
      needsConfirm: false,
      icon: '\u{1F4CD}'
    },
    {
      label: 'Color Vocals',
      workflow: 'colorCodeVocals',
      args: {},
      needsConfirm: false,
      icon: '\u{1F3A8}'
    },
    {
      label: 'Organize',
      workflow: 'organizeSessionTracks',
      args: {},
      needsConfirm: true,
      icon: '\u{1F4CB}',
      destructive: true
    }
  ];

  function render() {
    const container = document.getElementById('quick-actions-panel');
    if (!container) return;

    container.innerHTML = `
      <div class="panel-header">QUICK ACTIONS</div>
      <div class="quick-actions-grid">
        ${actions.map((action, i) => `
          <button class="quick-action-btn ${action.destructive ? 'destructive' : ''}"
                  data-action-index="${i}"
                  title="${action.label}">
            ${action.label}
          </button>
        `).join('')}
      </div>
    `;

    // Bind click handlers
    container.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.actionIndex, 10);
        const action = actions[idx];
        if (!action) return;

        await executeQuickAction(action, btn);
      });
    });
  }

  async function executeQuickAction(action, btn) {
    if (action.needsConfirm) {
      // Preview the action and show confirmation modal
      try {
        const preview = await API().previewAction(action.workflow, action.args);
        const proposedActions = preview.proposedActions || (preview.data && preview.data.proposedActions) || [];
        const context = preview.context || (preview.data && preview.data.context) || {
          workflow: action.workflow,
          args: action.args
        };

        if (proposedActions.length > 0) {
          State().set('pendingActions', {
            actions: proposedActions,
            context: { ...context, workflow: action.workflow, args: action.args },
            requiresConfirmation: true
          });
        } else {
          State().addChatMessage('assistant', `**${action.label}** preview returned no actions.`);
        }
      } catch (e) {
        console.error('Preview failed:', e);
        State().addChatMessage('assistant', `Could not preview **${action.label}**. Is the server running?`);
      }
      return;
    }

    // Direct execution for safe actions
    btn.disabled = true;
    btn.textContent = '...';

    try {
      const result = await API().executeAction({
        workflow: action.workflow,
        args: action.args,
        confirmed: true
      });

      if (result.ok !== false) {
        const summary = (result.data && result.data.summary) || result.summary || 'Done.';
        State().addChatMessage('assistant', `**${action.label}** -- ${summary}`);
        State().addActionLogEntry({
          label: action.label,
          status: 'success',
          type: 'execution'
        });
        // Refresh data
        window.SessionPilot.WS.refresh();
      } else {
        State().addChatMessage('assistant', `**${action.label}** failed: ${result.error || 'Unknown error'}`);
        State().addActionLogEntry({
          label: action.label,
          status: 'failure',
          type: 'execution'
        });
      }
    } catch (e) {
      console.error('Quick action failed:', e);
      State().addChatMessage('assistant', `**${action.label}** failed. Check server connection.`);
      State().addActionLogEntry({
        label: action.label,
        status: 'failure',
        type: 'execution'
      });
    } finally {
      btn.disabled = false;
      btn.textContent = action.label;
    }
  }

  function init() {
    render();
  }

  return { init };
})();
