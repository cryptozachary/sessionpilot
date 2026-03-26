window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.ConnectionStatus = (() => {
  const State = () => window.SessionPilot.State;
  const API = () => window.SessionPilot.API;

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

    const isPlaying = transportState === 'playing';
    const isRecording = transportState === 'recording';
    const isPaused = transportState === 'paused';

    container.innerHTML = `
      <div class="transport-display">
        <div class="transport-controls">
          <button class="transport-btn transport-btn-goto-start" title="Go to start" data-action="goToStart">\u23EE</button>
          <button class="transport-btn transport-btn-stop ${!isPlaying && !isRecording && !isPaused ? 'active' : ''}" title="Stop" data-action="stop">\u23F9</button>
          <button class="transport-btn transport-btn-play ${isPlaying ? 'active' : ''}" title="Play" data-action="play">\u25B6</button>
          <button class="transport-btn transport-btn-pause ${isPaused ? 'active' : ''}" title="Pause" data-action="pause">\u23F8</button>
          <button class="transport-btn transport-btn-record ${isRecording ? 'active' : ''}" title="Record" data-action="record">\u23FA</button>
        </div>
        <span class="transport-bpm">${bpm} BPM</span>
        <span class="transport-state ${transportState}">${transportState}</span>
        ${projectName ? `<span class="transport-project" title="${projectName}">${projectName}</span>` : ''}
      </div>
    `;

    bindTransportButtons(container);
  }

  function bindTransportButtons(container) {
    container.querySelectorAll('.transport-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        if (!action) return;

        btn.disabled = true;
        try {
          const result = await API().executeAction({
            actionType: action,
            args: {},
            confirmed: true
          });
          if (result.ok !== false) {
            // Transport state will be updated via WebSocket push
            State().addActionLogEntry({
              label: btn.title,
              status: 'success',
              type: 'execution'
            });
          }
        } catch (e) {
          console.error('Transport control failed:', e);
        } finally {
          btn.disabled = false;
        }
      });
    });
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
