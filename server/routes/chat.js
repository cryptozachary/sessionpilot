// SessionPilot for REAPER - Chat Routes
// Express router for AI chat / intent processing.

module.exports = function createChatRoutes(bridge) {
  const router = require('express').Router();
  const orchestrator = require('../services/aiOrchestrator');

  // POST /api/chat - process a user message through the AI orchestrator
  router.post('/api/chat', async (req, res) => {
    try {
      const { message } = req.body;
      if (!message || typeof message !== 'string') {
        return res.json({ ok: false, error: 'Message is required and must be a string' });
      }
      const result = await orchestrator.processMessage(bridge, message);
      res.json({ ok: true, data: result });
    } catch (e) {
      console.error('Chat error:', e);
      res.json({ ok: false, error: 'Failed to process message' });
    }
  });

  return router;
};
