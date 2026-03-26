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

  // GET /api/health - health check with bridge status and system info
  router.get('/api/health', async (req, res) => {
    try {
      const [connectionResult, sessionResult] = await Promise.allSettled([
        bridge.getConnectionStatus(),
        bridge.getProjectSummary()
      ]);

      const connection = connectionResult.status === 'fulfilled' && connectionResult.value
        ? connectionResult.value.data
        : { connected: false, bridgeType: 'unknown' };

      const session = sessionResult.status === 'fulfilled' && sessionResult.value
        ? sessionResult.value.data
        : null;

      const bridgeType = connection.bridgeType || 'unknown';
      const connected = Boolean(connection.connected);

      const health = {
        status: connected ? 'ok' : 'degraded',
        bridge: {
          type: bridgeType,
          connected,
          stateFileAge: connection.stateFileAge || null
        },
        session: session ? {
          projectName: session.projectName || session.name || '',
          trackCount: session.trackCount || 0,
          bpm: session.bpm || null,
          sampleRate: session.sampleRate || null
        } : null,
        server: {
          uptime: Math.floor(process.uptime()),
          nodeVersion: process.version,
          platform: process.platform
        },
        timestamp: new Date().toISOString()
      };

      if (!connected) {
        health.guidance = bridgeType === 'mock'
          ? 'Running with mock bridge. Set USE_REAL_BRIDGE=1 and start REAPER with the Lua bridge script to connect to a real session.'
          : 'REAPER bridge is not responding. Make sure REAPER is running and the Lua bridge script is active.';
      }

      res.json({ ok: true, data: health });
    } catch (e) {
      res.json({
        ok: false,
        data: {
          status: 'error',
          error: e.message,
          timestamp: new Date().toISOString()
        }
      });
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
