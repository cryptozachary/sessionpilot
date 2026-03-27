window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.WS = (() => {
  let ws = null;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let pingTimer = null;
  let lastPong = 0;
  const PING_INTERVAL = 10000;   // Send ping every 10s
  const STALE_THRESHOLD = 25000; // Consider stale after 25s without pong

  const State = () => window.SessionPilot.State;

  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}`;

    try {
      ws = new WebSocket(url);
    } catch (e) {
      console.error('WebSocket creation failed:', e);
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttempts = 0;
      lastPong = Date.now();
      State().set('connection', { connected: true, bridgeType: 'websocket' });
      State().set('wsStale', false);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      startHeartbeat();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (e) {
        console.warn('Failed to parse WebSocket message:', e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      stopHeartbeat();
      State().set('connection', { connected: false, bridgeType: 'unknown' });
      State().set('wsStale', true);
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.warn('WebSocket error:', err);
    };
  }

  function startHeartbeat() {
    stopHeartbeat();
    pingTimer = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      // Check if stale
      if (Date.now() - lastPong > STALE_THRESHOLD) {
        console.warn('WebSocket connection stale — no pong received');
        State().set('wsStale', true);
        ws.close();
        return;
      }
      // Send application-level ping
      ws.send(JSON.stringify({ type: 'ping' }));
    }, PING_INTERVAL);
  }

  function stopHeartbeat() {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectAttempts++;
    // Exponential backoff: 3s, 6s, 12s ... max 30s
    const delay = Math.min(3000 * Math.pow(2, reconnectAttempts - 1), 30000);
    console.log(`Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts})`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function handleMessage(msg) {
    // Any message from server counts as a pong
    lastPong = Date.now();
    State().set('wsStale', false);

    switch (msg.type) {
      case 'pong':
        // Handled above
        break;

      case 'initial_state':
      case 'session_update':
        if (msg.data.session) State().set('session', msg.data.session);
        if (msg.data.tracks) State().set('tracks', msg.data.tracks);
        if (msg.data.selectedTrack !== undefined) State().set('selectedTrack', msg.data.selectedTrack);
        if (msg.data.connection) State().set('connection', msg.data.connection);
        break;

      case 'track_update':
        if (msg.data.tracks) State().set('tracks', msg.data.tracks);
        if (msg.data.selectedTrack !== undefined) State().set('selectedTrack', msg.data.selectedTrack);
        break;

      case 'transport_update':
        if (msg.data.session) State().set('session', msg.data.session);
        break;

      case 'workflow_progress':
        State().set('workflowProgress', msg.data);
        break;

      case 'peak_update':
        // Use emit (not set) to avoid localStorage persistence for volatile peak data
        State().emit('peakUpdate', msg.data);
        break;

      case 'action_executed':
        // Clear progress and add to action log
        State().set('workflowProgress', null);
        if (msg.data) {
          State().addActionLogEntry({
            label: msg.data.label || 'Action executed',
            status: msg.data.status || 'success',
            type: 'execution'
          });
        }
        refresh();
        break;

      default:
        console.log('Unknown WS message type:', msg.type);
    }
  }

  function send(type, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, data }));
    }
  }

  function refresh() {
    send('refresh', {});
  }

  return { connect, send, refresh };
})();
