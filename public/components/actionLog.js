window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.ActionLog = (() => {
  const State = () => window.SessionPilot.State;
  const API = () => window.SessionPilot.API;

  let refreshInterval = null;

  function render(log) {
    const container = document.getElementById('action-log-panel');
    if (!container) return;

    const entries = log || [];

    if (entries.length === 0) {
      container.innerHTML = `
        <div class="panel-header">ACTION LOG</div>
        <div class="action-log-empty">No actions yet</div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="panel-header">ACTION LOG (${entries.length})</div>
      <div class="action-log-list">
        ${entries.slice(0, 50).map(entry => {
          const statusIcon = entry.status === 'success' ? '\u2713' : '\u2717';
          const statusClass = entry.status === 'success' ? 'success' : 'failure';
          const typeClass = entry.type === 'execution' ? 'execution' : 'proposal';
          const timeAgo = formatTimeAgo(entry.timestamp);

          return `
            <div class="action-log-entry">
              <div class="action-log-status ${statusClass}">${statusIcon}</div>
              <div class="action-log-body">
                <div class="action-log-label">${escapeHtml(entry.label || 'Action')}</div>
              </div>
              <span class="action-log-type-badge ${typeClass}">${entry.type || 'exec'}</span>
              <span class="action-log-time">${timeAgo}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 5) return 'now';
    if (diffSec < 60) return `${diffSec}s ago`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;

    return `${Math.floor(diffHr / 24)}d ago`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function fetchLog() {
    try {
      const result = await API().getActionLog(50);
      if (result.data) {
        State().set('actionLog', result.data);
      }
    } catch (e) {
      // Silently fail on periodic refresh
    }
  }

  function init() {
    State().on('actionLog', render);
    render(State().get('actionLog'));

    // Periodic refresh every 5 seconds
    refreshInterval = setInterval(fetchLog, 5000);

    // Also re-render periodically to update relative timestamps
    setInterval(() => {
      render(State().get('actionLog'));
    }, 10000);
  }

  return { init };
})();
