// SessionPilot for REAPER - Chat Routes
// Express router for structured chat orchestration.

const sessionMemory = require('../services/sessionMemory');

const SESSION_COOKIE_NAME = 'sessionpilot.sid';

function parseCookies(headerValue) {
  return String(headerValue || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) return acc;
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (key) acc[key] = value;
      return acc;
    }, {});
}

function getOrCreateSessionId(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE_NAME]) {
    return cookies[SESSION_COOKIE_NAME];
  }

  const sessionId = sessionMemory.createSessionId();
  res.append(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
  );
  return sessionId;
}

module.exports = function createChatRoutes(bridge) {
  const router = require('express').Router();
  const orchestrator = require('../services/chatOrchestrator');

  // POST /api/chat - process a user message through the AI orchestrator
  router.post('/api/chat', async (req, res) => {
    try {
      const { message } = req.body;
      if (!message || typeof message !== 'string') {
        return res.json({ ok: false, error: 'Message is required and must be a string' });
      }
      const sessionId = getOrCreateSessionId(req, res);
      const result = await orchestrator.processMessage(bridge, message, {
        sessionId,
        source: req.body && req.body.source ? req.body.source : 'text'
      });
      res.json({ ok: true, data: result });
    } catch (e) {
      console.error('Chat error:', e);
      res.json({ ok: false, error: 'Failed to process message' });
    }
  });

  return router;
};
