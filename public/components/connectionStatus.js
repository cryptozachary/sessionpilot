window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.ConnectionStatus = (() => {
  const State = () => window.SessionPilot.State;

  function renderConnection(connection) {
    const container = document.getElementById('connection-status');
    if (!container) return;

    const connected = connection && connection.connected;
    const statusClass = connected ? 'connected' : 'disconnected';
    const statusText = connected ? 'REAPER Connected' : 'Disconnected';
    const bridgeType = connected && connection.bridgeType
      ? `<span class="bridge-type">(${connection.bridgeType})</span>`
      : '';

    container.innerHTML = `
      <div class="connection-indicator ${statusClass}">
        <span class="status-dot"></span>
        <span class="status-text">${statusText}</span>
        ${bridgeType}
      </div>
    `;
  }

  function renderTransport(session) {
    const container = document.getElementById('transport-display');
    if (!container) return;

    if (!session) {
      container.innerHTML = '';
      return;
    }

    const bpm = session.bpm || '---';
    const transportState = session.transportState || 'stopped';
    const projectName = session.projectName || '';

    container.innerHTML = `
      <div class="transport-display">
        <span class="transport-bpm">${bpm} BPM</span>
        <span class="transport-state ${transportState}">${transportState}</span>
        ${projectName ? `<span class="transport-project" title="${projectName}">${projectName}</span>` : ''}
      </div>
    `;
  }

  function init() {
    State().on('connection', renderConnection);
    State().on('session', renderTransport);

    // Render initial state
    renderConnection(State().get('connection'));
    renderTransport(State().get('session'));
  }

  return { init, renderConnection, renderTransport };
})();
