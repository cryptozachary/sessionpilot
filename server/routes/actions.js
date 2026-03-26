// SessionPilot for REAPER - Action Routes
// Express router for executing and previewing actions.

const workflowService = require('../services/workflowService');
const actionLog = require('../services/actionLog');

// Map of direct action types to bridge method calls
const DIRECT_ACTION_MAP = {
  createTrack:        (bridge, args) => bridge.createTrack(args.name, args.type),
  renameTrack:        (bridge, args) => bridge.renameTrack(args.trackIndex, args.name),
  setTrackColor:      (bridge, args) => bridge.setTrackColor(args.trackIndex, args.color),
  armTrack:           (bridge, args) => bridge.armTrack(args.trackIndex),
  disarmTrack:        (bridge, args) => bridge.disarmTrack(args.trackIndex),
  toggleMonitoring:   (bridge, args) => bridge.toggleMonitoring(args.trackIndex),
  muteTrack:          (bridge, args) => bridge.muteTrack(args.trackIndex),
  soloTrack:          (bridge, args) => bridge.soloTrack(args.trackIndex),
  duplicateTrack:     (bridge, args) => bridge.duplicateTrack(args.trackIndex),
  createFolderTrack:  (bridge, args) => bridge.createFolderTrack(args.name, args.childCount),
  insertMarker:       (bridge, args) => bridge.insertMarker(args.name, args.position, args.color),
  createRegion:       (bridge, args) => bridge.createRegion(args.name, args.start, args.end, args.color),
  loadTrackTemplate:  (bridge, args) => bridge.loadTrackTemplate(args.templateName),
  loadFxChain:        (bridge, args) => bridge.loadFxChain(args.trackIndex, args.chainName)
};

module.exports = function createActionRoutes(bridge) {
  const router = require('express').Router();

  // POST /api/actions/execute - execute a workflow or direct bridge action
  router.post('/api/actions/execute', async (req, res) => {
    try {
      const { workflow, actionType, args = {}, confirmed } = req.body;

      // Workflow execution
      if (workflow) {
        // Check confirmation for workflows that need it
        const wf = workflowService.listWorkflows().find(w => w.name === workflow);
        if (wf && wf.requiresConfirmation && !confirmed) {
          return res.json({ ok: false, error: 'This workflow requires confirmation. Set confirmed=true to proceed.' });
        }

        const result = await workflowService.executeWorkflow(bridge, workflow, args);

        // Broadcast action event if websocket is available
        const broadcast = req.app.get('wsBroadcast');
        if (broadcast) {
          broadcast('action_executed', { workflow, args, result: result.data });
        }

        return res.json(result);
      }

      // Direct action execution
      if (actionType) {
        const handler = DIRECT_ACTION_MAP[actionType];
        if (!handler) {
          return res.json({ ok: false, error: 'Unknown action type: ' + actionType });
        }

        const result = await handler(bridge, args);

        // Log execution
        actionLog.logExecution({
          actionId: actionType + '_' + Date.now(),
          type: actionType,
          label: actionType,
          result,
          ok: result ? result.ok : true,
          timestamp: new Date().toISOString()
        });

        // Broadcast action event if websocket is available
        const broadcast = req.app.get('wsBroadcast');
        if (broadcast) {
          broadcast('action_executed', { actionType, args, result });
        }

        return res.json({ ok: true, data: result });
      }

      return res.json({ ok: false, error: 'Must provide either workflow or actionType' });
    } catch (e) {
      console.error('Action execute error:', e);
      res.json({ ok: false, error: e.message });
    }
  });

  // POST /api/actions/preview - preview a workflow without executing
  router.post('/api/actions/preview', async (req, res) => {
    try {
      const { workflow, args = {} } = req.body;
      if (!workflow) {
        return res.json({ ok: false, error: 'Workflow name is required' });
      }
      const result = await workflowService.previewWorkflow(bridge, workflow, args);
      res.json(result);
    } catch (e) {
      console.error('Action preview error:', e);
      res.json({ ok: false, error: e.message });
    }
  });

  // GET /api/action-log - retrieve action log entries
  router.get('/api/action-log', (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 50;
      const kind = req.query.kind || null;
      const entries = actionLog.getRecent(limit, kind);
      res.json({ ok: true, data: entries });
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });

  return router;
};
