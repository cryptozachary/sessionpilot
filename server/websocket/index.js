// SessionPilot for REAPER - WebSocket Server
// Broadcasts session state updates, peak meters, and action events to connected clients.

const WebSocket = require('ws');
const fs = require('fs');
const healthCheck = require('../services/sessionHealthCheck');

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

  /**
   * Broadcast full session state to all clients.
   */
  async function broadcastSessionState() {
    if (wss.clients.size === 0) return;
    try {
      const [session, tracks, selected, transport] = await Promise.all([
        bridge.getProjectSummary(),
        bridge.listTracks(),
        bridge.getSelectedTrack(),
        bridge.getTransportState()
      ]);
      const tracksData = (tracks.data || []);
      const transportData = transport.data || { state: 'stopped' };
      const armedTracks = tracksData.filter(t => t.isArmed || t.armed);

      broadcast('session_update', {
        session: session.data,
        tracks: tracksData,
        selectedTrack: selected.data
      });

      // Run health check and broadcast warnings every cycle
      const snapshot = {
        tracks: tracksData,
        transport: transportData,
        recording: {
          armedTracks: armedTracks.map(t => ({ id: t.id, name: t.name })),
          armedTrackCount: armedTracks.length
        }
      };
      const { warnings } = healthCheck.analyzeSession(snapshot);
      broadcast('health_warnings', { warnings });
    } catch (e) {
      broadcast('error', { message: 'Failed to poll session state' });
    }
  }

  // Poll and broadcast session state (fallback interval)
  const pollInterval = setInterval(broadcastSessionState, 2000);

  // File-watch based state push for JsonQueueReaperBridge (much faster than polling)
  let fileWatcher = null;
  let watchDebounceTimer = null;
  if (bridge._stateFile) {
    try {
      fileWatcher = fs.watch(bridge._stateFile, { persistent: false }, (eventType) => {
        if (eventType === 'change') {
          if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
          watchDebounceTimer = setTimeout(broadcastSessionState, 100);
        }
      });
      fileWatcher.on('error', () => {
        // Non-fatal: fall back to interval polling
      });
    } catch (e) {
      // fs.watch not available or file doesn't exist yet — fall back to polling
    }
  }

  // Peak meter broadcast — faster interval for level meters
  const peakPollInterval = setInterval(async () => {
    if (wss.clients.size === 0) return;
    try {
      if (typeof bridge.getTrackPeaks === 'function') {
        const peaks = await bridge.getTrackPeaks();
        if (peaks.ok && peaks.data) {
          broadcast('peak_update', peaks.data);
        }
      }
    } catch (e) {
      // Non-critical — skip this cycle
    }
  }, 250);

  // Heartbeat: ping every 15 seconds, terminate stale connections after 30s
  const HEARTBEAT_INTERVAL = 15000;
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach(client => {
      if (client.isAlive === false) {
        console.log('Terminating stale WebSocket client');
        return client.terminate();
      }
      client.isAlive = false;
      client.ping();
    });
  }, HEARTBEAT_INTERVAL);

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Send initial state immediately
    sendStateTo(ws);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'refresh') {
          // Trigger immediate state push to this client
          sendStateTo(ws);
        } else if (msg.type === 'ping') {
          // Application-level ping for browsers that don't expose WebSocket pong
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          }
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
    clearInterval(peakPollInterval);
    clearInterval(heartbeatInterval);
    if (fileWatcher) fileWatcher.close();
  });

  return { broadcast, wss };
};
