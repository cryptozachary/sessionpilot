// SessionPilot for REAPER - Session Routes
// Express router for session state and REAPER data queries.

const workflowService = require('../services/workflowService');

module.exports = function createSessionRoutes(bridge) {
  const router = require('express').Router();

  // GET /api/session - project summary
  router.get('/api/session', async (req, res) => {
    try {
      const result = await bridge.getProjectSummary();
      res.json(result);
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });

  // GET /api/tracks - all tracks
  router.get('/api/tracks', async (req, res) => {
    try {
      const result = await bridge.listTracks();
      res.json(result);
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });

  // GET /api/selected-track - currently selected track
  router.get('/api/selected-track', async (req, res) => {
    try {
      const result = await bridge.getSelectedTrack();
      res.json(result);
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });

  // GET /api/connection-status - bridge connection status
  router.get('/api/connection-status', async (req, res) => {
    try {
      const result = await bridge.getConnectionStatus();
      res.json(result);
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });

  // GET /api/markers - markers and regions
  router.get('/api/markers', async (req, res) => {
    try {
      const result = await bridge.getMarkersAndRegions();
      res.json(result);
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });

  // GET /api/transport - transport state (play, stop, record, position)
  router.get('/api/transport', async (req, res) => {
    try {
      const result = await bridge.getTransportState();
      res.json(result);
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });

  // GET /api/templates - available track templates
  router.get('/api/templates', async (req, res) => {
    try {
      const result = await bridge.listAvailableTrackTemplates();
      res.json(result);
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });

  // GET /api/fx-chains - available FX chains
  router.get('/api/fx-chains', async (req, res) => {
    try {
      const result = await bridge.listAvailableFxChains();
      res.json(result);
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });

  // GET /api/workflows - available workflows
  router.get('/api/workflows', (req, res) => {
    try {
      const result = workflowService.listWorkflows();
      res.json({ ok: true, data: result });
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });

  return router;
};
