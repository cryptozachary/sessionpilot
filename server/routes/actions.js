// SessionPilot for REAPER - Action Routes
// Express router for executing and previewing actions.

const workflowService = require('../services/workflowService');
const actionLog = require('../services/actionLog');

// Actions/workflows that should be blocked while transport is recording
const BLOCKED_WHILE_RECORDING = new Set([
  'organizeSessionTracks', 'renderProject', 'renderStems', 'exportBounce',
  'batchRecording', 'roughMix'
]);
const BLOCKED_ACTION_TYPES_WHILE_RECORDING = new Set([
  'renderProject', 'renderStems'
]);

async function resolveTrackId(bridge, args = {}) {
  if (args.trackId) return args.trackId;
  if (args.trackIndex !== undefined && args.trackIndex !== null) {
    try {
      const tracks = await bridge.listTracks();
      const track = (tracks.data || []).find((item) => item.index === args.trackIndex);
      if (track && track.id) return track.id;
    } catch (err) {
      // Fall back to the JSON queue bridge track ID convention.
    }
    return `track_${args.trackIndex}`;
  }
  if (args.target === 'selected') {
    const selected = await bridge.getSelectedTrack();
    return selected.data && selected.data.id;
  }
  return null;
}

// Map of direct action types to bridge method calls
const DIRECT_ACTION_MAP = {
  createTrack: async (bridge, args) =>
    bridge.createTrack({
      name: args.name,
      color: args.color,
      insertIndex: args.insertIndex,
      parentTrackId: args.parentTrackId
    }),
  renameTrack: async (bridge, args) =>
    bridge.renameTrack({
      trackId: await resolveTrackId(bridge, args),
      name: args.name
    }),
  setTrackColor: async (bridge, args) =>
    bridge.setTrackColor({
      trackId: await resolveTrackId(bridge, args),
      color: args.color
    }),
  selectTrack: async (bridge, args) =>
    bridge.selectTrack({ trackId: await resolveTrackId(bridge, args) }),
  armTrack: async (bridge, args) =>
    bridge.armTrack({ trackId: await resolveTrackId(bridge, args) }),
  disarmTrack: async (bridge, args) =>
    bridge.disarmTrack({ trackId: await resolveTrackId(bridge, args) }),
  toggleMonitoring: async (bridge, args) =>
    bridge.toggleMonitoring({
      trackId: await resolveTrackId(bridge, args),
      enabled: args.enabled !== false
    }),
  muteTrack: async (bridge, args) =>
    bridge.muteTrack({
      trackId: await resolveTrackId(bridge, args),
      enabled: args.enabled !== false
    }),
  soloTrack: async (bridge, args) =>
    bridge.soloTrack({
      trackId: await resolveTrackId(bridge, args),
      enabled: args.enabled !== false
    }),
  duplicateTrack: async (bridge, args) =>
    bridge.duplicateTrack({
      trackId: await resolveTrackId(bridge, args),
      newName: args.newName
    }),
  createFolderTrack: async (bridge, args) =>
    bridge.createFolderTrack({ name: args.name, color: args.color }),
  insertMarker: async (bridge, args) =>
    bridge.insertMarker({
      name: args.name,
      position: args.position,
      bar: args.bar
    }),
  createRegion: async (bridge, args) =>
    bridge.createRegion({
      name: args.name,
      start: args.start,
      end: args.end,
      startBar: args.startBar,
      endBar: args.endBar
    }),
  loadTrackTemplate: async (bridge, args) =>
    bridge.loadTrackTemplate({
      trackId: await resolveTrackId(bridge, args),
      templateName: args.templateName
    }),
  loadFxChain: async (bridge, args) =>
    bridge.loadFxChain({
      trackId: await resolveTrackId(bridge, args),
      fxChainName: args.fxChainName || args.chainName
    }),
  play: async (bridge) => bridge.play(),
  stop: async (bridge) => bridge.stop(),
  pause: async (bridge) => bridge.pause(),
  record: async (bridge) => bridge.record(),
  goToPosition: async (bridge, args) => bridge.goToPosition({ position: args.position, bar: args.bar }),
  goToStart: async (bridge) => bridge.goToStart(),
  goToEnd: async (bridge) => bridge.goToEnd(),
  goToMarker: async (bridge, args) => bridge.goToMarker({ name: args.name }),
  setTrackVolume: async (bridge, args) =>
    bridge.setTrackVolume({ trackId: await resolveTrackId(bridge, args), volume: args.volume }),
  setTrackPan: async (bridge, args) =>
    bridge.setTrackPan({ trackId: await resolveTrackId(bridge, args), pan: args.pan }),
  undo: async (bridge) => bridge.undo(),
  redo: async (bridge) => bridge.redo(),
  getTrackFx: async (bridge, args) =>
    bridge.getTrackFx({ trackId: await resolveTrackId(bridge, args) }),
  removeFx: async (bridge, args) =>
    bridge.removeFx({
      trackId: await resolveTrackId(bridge, args),
      fxIndex: args.fxIndex
    }),
  toggleFxBypass: async (bridge, args) =>
    bridge.toggleFxBypass({
      trackId: await resolveTrackId(bridge, args),
      fxIndex: args.fxIndex,
      bypassed: args.bypassed !== false
    }),
  renderProject: async (bridge, args) => bridge.renderProject(args),
  renderStems: async (bridge, args) => bridge.renderStems(args)
};

module.exports = function createActionRoutes(bridge) {
  const router = require('express').Router();

  // POST /api/actions/execute - execute a workflow or direct bridge action
  router.post('/api/actions/execute', async (req, res) => {
    try {
      const { workflow, actionType, args = {}, confirmed } = req.body;

      // Transport-aware gating: block destructive ops while recording
      try {
        const transport = await bridge.getTransportState();
        const isRecording = transport.ok && transport.data && transport.data.state === 'recording';
        if (isRecording) {
          if (workflow && BLOCKED_WHILE_RECORDING.has(workflow)) {
            return res.json({ ok: false, error: `Cannot run "${workflow}" while recording. Stop recording first.` });
          }
          if (actionType && BLOCKED_ACTION_TYPES_WHILE_RECORDING.has(actionType)) {
            return res.json({ ok: false, error: `Cannot run "${actionType}" while recording. Stop recording first.` });
          }
        }
      } catch (_e) { /* non-fatal: proceed if transport check fails */ }

      // Workflow execution
      if (workflow) {
        // Check confirmation for workflows that need it
        const wf = workflowService.listWorkflows().find(w => w.name === workflow);
        if (wf && wf.requiresConfirmation && !confirmed) {
          return res.json({ ok: false, error: 'This workflow requires confirmation. Set confirmed=true to proceed.' });
        }

        const broadcast = req.app.get('wsBroadcast');
        const onProgress = broadcast
          ? (progress) => broadcast('workflow_progress', progress)
          : undefined;

        const result = await workflowService.executeWorkflow(bridge, workflow, args, { onProgress });

        // Broadcast action event if websocket is available
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

        return res.json(result);
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
