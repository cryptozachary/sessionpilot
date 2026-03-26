// SessionPilot for REAPER - Server Entry Point

const express = require('express');
const http = require('http');
const path = require('path');

// Bridge selection - default to the real JSON queue bridge.
const JsonQueueReaperBridge = require('./bridge/JsonQueueReaperBridge');
const MockReaperBridge = require('./bridge/MockReaperBridge');
const bridgeRoot = process.env.REAPER_BRIDGE_DIR
  ? path.resolve(process.env.REAPER_BRIDGE_DIR)
  : path.join(__dirname, '..', 'reaper_bridge');
const bridge = process.env.USE_MOCK_BRIDGE === '1'
  ? new MockReaperBridge()
  : new JsonQueueReaperBridge({
      commandDir: path.join(bridgeRoot, 'commands'),
      resultDir: path.join(bridgeRoot, 'results'),
      stateFile: path.join(bridgeRoot, 'state.json')
    });

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Routes
app.use(require('./routes/session')(bridge));
app.use(require('./routes/chat')(bridge));
app.use(require('./routes/actions')(bridge));

// WebSocket
const { broadcast } = require('./websocket')(server, bridge);

// Make broadcast available to routes for action notifications
app.set('wsBroadcast', broadcast);

// Fallback to index.html for SPA-like behavior
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SessionPilot for REAPER running at http://localhost:${PORT}`);
  console.log(`Bridge: ${bridge.constructor.name}`);
  if (bridge instanceof JsonQueueReaperBridge) {
    console.log(`Bridge directory: ${bridgeRoot}`);
  }
});
