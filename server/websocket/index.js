// SessionPilot for REAPER - WebSocket Server
// Broadcasts session state updates and action events to connected clients.

const WebSocket = require('ws');

module.exports = function setupWebSocket(server, bridge) {
  const wss = new WebSocket.Server({ server });

  /**
   * Broadcast a message to all connected clients.
   */
  function broadcast(type, data) {
    const msg = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  /**
   * Fetch and send current session state to a specific client.
   */
  async function sendStateTo(ws) {
    try {
      const [session, tracks, selected, connection] = await Promise.all([
        bridge.getProjectSummary(),
        bridge.listTracks(),
        bridge.getSelectedTrack(),
        bridge.getConnectionStatus()
      ]);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'initial_state',
          data: {
            session: session.data,
            tracks: tracks.data,
            selectedTrack: selected.data,
            connection: connection.data
          },
          timestamp: new Date().toISOString()
        }));
      }
    } catch (e) {
      console.error('WebSocket initial state error:', e);
    }
  }

  // Poll and broadcast session state every 2 seconds
  const pollInterval = setInterval(async () => {
    if (wss.clients.size === 0) return; // No clients, skip polling
    try {
      const [session, tracks, selected] = await Promise.all([
        bridge.getProjectSummary(),
        bridge.listTracks(),
        bridge.getSelectedTrack()
      ]);
      broadcast('session_update', {
        session: session.data,
        tracks: tracks.data,
        selectedTrack: selected.data
      });
    } catch (e) {
      broadcast('error', { message: 'Failed to poll session state' });
    }
  }, 2000);

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    // Send initial state immediately
    sendStateTo(ws);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'refresh') {
          // Trigger immediate state push to this client
          sendStateTo(ws);
        }
      } catch (e) {
        // Ignore invalid messages
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  // Clean up on server close
  wss.on('close', () => {
    clearInterval(pollInterval);
  });

  return { broadcast, wss };
};
