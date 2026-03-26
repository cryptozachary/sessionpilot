// SessionPilot for REAPER - Server Entry Point

const express = require('express');
const http = require('http');
const path = require('path');

// Bridge selection - use mock for now
const MockReaperBridge = require('./bridge/MockReaperBridge');
const bridge = new MockReaperBridge();

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
});
