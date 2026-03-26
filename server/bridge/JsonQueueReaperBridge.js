const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ReaperBridge = require('./ReaperBridge');
const { BRIDGE_TYPES, COMMAND_TIMEOUT_MS } = require('./bridgeTypes');

/**
 * File-based JSON command/result bridge for real REAPER integration.
 *
 * Communication flow:
 *   1. This bridge writes a command JSON file into `commandDir`.
 *   2. A REAPER Lua script polls `commandDir`, executes the command, and
 *      writes a result JSON file into `resultDir`.
 *   3. This bridge polls `resultDir` for the matching result (by requestId).
 *
 * REAPER also periodically writes a state snapshot to `stateFile`, which
 * read-only methods can use for fast lookups without a round-trip command.
 */
class JsonQueueReaperBridge extends ReaperBridge {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.commandDir='./reaper_bridge/commands']
   * @param {string} [opts.resultDir='./reaper_bridge/results']
   * @param {string} [opts.stateFile='./reaper_bridge/state.json']
   * @param {number} [opts.timeoutMs=5000]
   */
  constructor(opts = {}) {
    super();
    this._commandDir = opts.commandDir || './reaper_bridge/commands';
    this._resultDir = opts.resultDir || './reaper_bridge/results';
    this._stateFile = opts.stateFile || './reaper_bridge/state.json';
    this._timeoutMs = opts.timeoutMs || COMMAND_TIMEOUT_MS;
    this._dirsEnsured = false;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Creates commandDir and resultDir if they do not already exist.
   */
  async _ensureDirs() {
    if (this._dirsEnsured) return;
    try {
      await fs.mkdir(this._commandDir, { recursive: true });
      await fs.mkdir(this._resultDir, { recursive: true });
      this._dirsEnsured = true;
    } catch (err) {
      // Ignore errors if dirs already exist
      if (err.code !== 'EEXIST') throw err;
    }
  }

  /**
   * Sends a command to REAPER by writing a JSON file and polling for a result.
   * @param {string} command - The command name
   * @param {Object} [args={}] - Command arguments
   * @returns {Promise<Object>} The parsed result object
   */
  async _sendCommand(command, args = {}) {
    await this._ensureDirs();
    const requestId = uuidv4();
    const commandPayload = {
      requestId,
      command,
      args,
      timestamp: new Date().toISOString()
    };

    const commandFile = path.join(this._commandDir, `${requestId}.json`);
    const resultFile = path.join(this._resultDir, `${requestId}.json`);

    try {
      await fs.writeFile(commandFile, JSON.stringify(commandPayload, null, 2));
    } catch (err) {
      return this._result(
        false,
        null,
        [],
        [`Failed to write command file: ${err.message}`],
        { bridgeType: BRIDGE_TYPES.JSON_QUEUE, requestId }
      );
    }

    // Poll for result file
    const pollIntervalMs = 100;
    const deadline = Date.now() + this._timeoutMs;

    while (Date.now() < deadline) {
      try {
        const raw = await fs.readFile(resultFile, 'utf-8');
        const result = JSON.parse(raw);

        // Clean up files
        await fs.unlink(commandFile).catch(() => {});
        await fs.unlink(resultFile).catch(() => {});

        return this._result(
          result.ok !== undefined ? result.ok : true,
          result.data !== undefined ? result.data : result,
          result.warnings || [],
          result.errors || [],
          {
            bridgeType: BRIDGE_TYPES.JSON_QUEUE,
            requestId
          }
        );
      } catch (err) {
        // File doesn't exist yet - keep polling
        if (err.code === 'ENOENT') {
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
          continue;
        }
        // Unexpected read/parse error
        return this._result(
          false,
          null,
          [],
          [`Failed to read result file: ${err.message}`],
          { bridgeType: BRIDGE_TYPES.JSON_QUEUE, requestId }
        );
      }
    }

    // Timed out - clean up command file
    await fs.unlink(commandFile).catch(() => {});
    return this._result(
      false,
      null,
      [],
      [`Command timed out after ${this._timeoutMs}ms: ${command}`],
      { bridgeType: BRIDGE_TYPES.JSON_QUEUE, requestId }
    );
  }

  /**
   * Reads the state snapshot file that REAPER Lua bridge writes periodically.
   * @returns {Promise<Object|null>} Parsed state or null on failure
   */
  async _readStateSnapshot() {
    try {
      const raw = await fs.readFile(this._stateFile, 'utf-8');
      return this._normalizeStateSnapshot(JSON.parse(raw));
    } catch (err) {
      return null;
    }
  }

  /**
   * Normalizes state snapshots from either the flat or nested Lua format.
   * @param {Object} state
   * @returns {Object|null}
   */
  _normalizeStateSnapshot(state) {
    if (!state || typeof state !== 'object') return null;

    const projectSummary = state.projectSummary || state;
    const markersAndRegions = state.markersAndRegions || {};
    const tracks = Array.isArray(state.tracks) ? state.tracks : [];
    const markers = Array.isArray(state.markers)
      ? state.markers
      : Array.isArray(markersAndRegions.markers)
        ? markersAndRegions.markers
        : [];
    const regions = Array.isArray(state.regions)
      ? state.regions
      : Array.isArray(markersAndRegions.regions)
        ? markersAndRegions.regions
        : [];
    const selectedTrack =
      state.selectedTrack !== undefined
        ? state.selectedTrack
        : tracks.find((track) => track && track.isSelected) || null;

    return {
      connected: state.connected !== undefined ? state.connected : true,
      projectName: projectSummary.projectName || '',
      projectPath: projectSummary.projectPath || '',
      sampleRate: projectSummary.sampleRate || 44100,
      bpm: projectSummary.bpm || 120,
      transportState: projectSummary.transportState || state.transportState || 'stopped',
      playCursor: projectSummary.playCursor || state.playCursor || 0,
      playCursorBar:
        projectSummary.playCursorBar !== undefined
          ? projectSummary.playCursorBar
          : state.playCursorBar !== undefined
            ? state.playCursorBar
            : null,
      recordMode: projectSummary.recordMode || state.recordMode || 'normal',
      trackCount:
        projectSummary.trackCount !== undefined
          ? projectSummary.trackCount
          : tracks.length,
      markerCount:
        projectSummary.markerCount !== undefined
          ? projectSummary.markerCount
          : markers.length,
      regionCount:
        projectSummary.regionCount !== undefined
          ? projectSummary.regionCount
          : regions.length,
      tracks,
      selectedTrack,
      markers,
      regions,
      timestamp: state.timestamp || state.lastUpdated || null
    };
  }

  /**
   * Checks whether the state snapshot is fresh (updated within maxAgeMs).
   * @param {Object} state - The state object (must have a `timestamp` field)
   * @param {number} [maxAgeMs=5000] - Maximum age in milliseconds
   * @returns {boolean}
   */
  _isStateFresh(state, maxAgeMs = 5000) {
    if (!state || !state.timestamp) return false;
    const age = Date.now() - new Date(state.timestamp).getTime();
    return age < maxAgeMs;
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  async getConnectionStatus() {
    try {
      const stat = await fs.stat(this._stateFile);
      const ageMs = Date.now() - stat.mtimeMs;
      const connected = ageMs < 10000;
      return this._result(
        true,
        {
          connected,
          bridgeType: BRIDGE_TYPES.JSON_QUEUE,
          stateFileAge: Math.round(ageMs)
        },
        connected ? [] : ['State file is stale; REAPER may not be running'],
        [],
        { bridgeType: BRIDGE_TYPES.JSON_QUEUE }
      );
    } catch (err) {
      return this._result(
        true,
        { connected: false, bridgeType: BRIDGE_TYPES.JSON_QUEUE },
        [],
        ['State file not found; REAPER bridge is not running'],
        { bridgeType: BRIDGE_TYPES.JSON_QUEUE }
      );
    }
  }

  async ping() {
    const start = Date.now();
    const result = await this._sendCommand('ping');
    const latency = Date.now() - start;
    if (result.ok) {
      result.data = { ...result.data, latency };
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  async getProjectSummary() {
    const state = await this._readStateSnapshot();
    if (state && this._isStateFresh(state)) {
      return this._result(
        true,
        {
          projectName: state.projectName || '',
          projectPath: state.projectPath || '',
          sampleRate: state.sampleRate || 44100,
          bpm: state.bpm || 120,
          transportState: state.transportState || 'stopped',
          playCursor: state.playCursor || 0,
          playCursorBar: state.playCursorBar !== undefined ? state.playCursorBar : null,
          recordMode: state.recordMode || 'normal',
          trackCount: state.trackCount || 0,
          markerCount: state.markerCount || 0,
          regionCount: state.regionCount || 0
        },
        [],
        [],
        { bridgeType: BRIDGE_TYPES.JSON_QUEUE }
      );
    }
    return this._sendCommand('getProjectSummary');
  }

  async listTracks() {
    const state = await this._readStateSnapshot();
    if (state && this._isStateFresh(state) && state.tracks) {
      return this._result(true, state.tracks, [], [], {
        bridgeType: BRIDGE_TYPES.JSON_QUEUE
      });
    }
    return this._sendCommand('listTracks');
  }

  async getSelectedTrack() {
    const state = await this._readStateSnapshot();
    if (state && this._isStateFresh(state) && state.tracks) {
      const selected = state.selectedTrack || state.tracks.find((t) => t.isSelected) || null;
      return this._result(true, selected, [], [], {
        bridgeType: BRIDGE_TYPES.JSON_QUEUE
      });
    }
    return this._sendCommand('getSelectedTrack');
  }

  async getMarkersAndRegions() {
    const state = await this._readStateSnapshot();
    if (state && this._isStateFresh(state)) {
      return this._result(
        true,
        {
          markers: state.markers || [],
          regions: state.regions || []
        },
        [],
        [],
        { bridgeType: BRIDGE_TYPES.JSON_QUEUE }
      );
    }
    return this._sendCommand('getMarkersAndRegions');
  }

  async getTransportState() {
    const state = await this._readStateSnapshot();
    if (state && this._isStateFresh(state)) {
      return this._result(
        true,
        {
          state: state.transportState || 'stopped',
          playCursor: state.playCursor || 0,
          playCursorBar: state.playCursorBar !== undefined ? state.playCursorBar : null,
          bpm: state.bpm || 120,
          recordMode: state.recordMode || 'normal'
        },
        [],
        [],
        { bridgeType: BRIDGE_TYPES.JSON_QUEUE }
      );
    }
    return this._sendCommand('getTransportState');
  }

  // ---------------------------------------------------------------------------
  // Track mutations
  // ---------------------------------------------------------------------------

  async createTrack({ name, color, insertIndex, parentTrackId }) {
    return this._sendCommand('createTrack', {
      name,
      color,
      insertIndex,
      parentTrackId
    });
  }

  async renameTrack({ trackId, name }) {
    return this._sendCommand('renameTrack', { trackId, name });
  }

  async setTrackColor({ trackId, color }) {
    return this._sendCommand('setTrackColor', { trackId, color });
  }

  async selectTrack({ trackId }) {
    return this._sendCommand('selectTrack', { trackId });
  }

  async armTrack({ trackId }) {
    return this._sendCommand('armTrack', { trackId });
  }

  async disarmTrack({ trackId }) {
    return this._sendCommand('disarmTrack', { trackId });
  }

  async toggleMonitoring({ trackId, enabled }) {
    return this._sendCommand('toggleMonitoring', { trackId, enabled });
  }

  async muteTrack({ trackId, enabled }) {
    return this._sendCommand('muteTrack', { trackId, enabled });
  }

  async soloTrack({ trackId, enabled }) {
    return this._sendCommand('soloTrack', { trackId, enabled });
  }

  async duplicateTrack({ trackId, newName }) {
    return this._sendCommand('duplicateTrack', { trackId, name: newName });
  }

  async createFolderTrack({ name, color }) {
    return this._sendCommand('createFolderTrack', { name, color });
  }

  // ---------------------------------------------------------------------------
  // Markers
  // ---------------------------------------------------------------------------

  async insertMarker({ position, name, bar }) {
    return this._sendCommand('insertMarker', { position, name, bar });
  }

  async createRegion({ start, end, name, startBar, endBar }) {
    return this._sendCommand('createRegion', { start, end, name, startBar, endBar });
  }

  // ---------------------------------------------------------------------------
  // Sends / Routing
  // ---------------------------------------------------------------------------

  async createSend(params = {}) {
    return this._sendCommand('createSend', {
      fromTrackId: params.fromTrackId || params.sourceTrackId,
      toTrackId: params.toTrackId || params.destTrackId,
      prePost: params.prePost,
      volume: params.volume,
      pan: params.pan
    });
  }

  // ---------------------------------------------------------------------------
  // Track Volume / Pan
  // ---------------------------------------------------------------------------

  async setTrackVolume({ trackId, volume }) {
    return this._sendCommand('setTrackVolume', { trackId, volume });
  }

  async setTrackPan({ trackId, pan }) {
    return this._sendCommand('setTrackPan', { trackId, pan });
  }

  // ---------------------------------------------------------------------------
  // Takes / Items
  // ---------------------------------------------------------------------------

  async listTakes({ trackId }) {
    const result = await this._sendCommand('listTakes', { trackId });
    if (!result.ok || !result.data || !Array.isArray(result.data.items)) {
      return result;
    }

    const takes = [];
    result.data.items.forEach((item) => {
      (item.takes || []).forEach((take) => {
        takes.push({
          ...take,
          itemIndex: item.itemIndex
        });
      });
    });

    result.data = {
      ...result.data,
      takes
    };
    return result;
  }

  async setActiveTake({ trackId, itemIndex = 0, takeIndex }) {
    return this._sendCommand('setActiveTake', { trackId, itemIndex, takeIndex });
  }

  async splitItemAtCursor({ trackId, itemIndex = 0 }) {
    return this._sendCommand('splitItemAtCursor', { trackId, itemIndex });
  }

  // ---------------------------------------------------------------------------
  // Loop / Time Selection
  // ---------------------------------------------------------------------------

  async setLoopPoints(params = {}) {
    return this._sendCommand('setLoopPoints', {
      start: params.start !== undefined ? params.start : params.startBar,
      end: params.end !== undefined ? params.end : params.endBar,
      enabled: params.enabled !== undefined ? params.enabled : true,
      startBar: params.startBar,
      endBar: params.endBar
    });
  }

  async setTimeSelection(params = {}) {
    return this._sendCommand('setTimeSelection', {
      start: params.start !== undefined ? params.start : params.startBar,
      end: params.end !== undefined ? params.end : params.endBar,
      startBar: params.startBar,
      endBar: params.endBar
    });
  }

  // ---------------------------------------------------------------------------
  // Transport Controls
  // ---------------------------------------------------------------------------

  async play() {
    return this._sendCommand('play');
  }

  async stop() {
    return this._sendCommand('stop');
  }

  async pause() {
    return this._sendCommand('pause');
  }

  async record() {
    return this._sendCommand('record');
  }

  async goToPosition({ position, bar } = {}) {
    return this._sendCommand('goToPosition', { position, bar });
  }

  async goToStart() {
    return this._sendCommand('goToStart');
  }

  async goToEnd() {
    return this._sendCommand('goToEnd');
  }

  // ---------------------------------------------------------------------------
  // Pre-Roll / Transport Helpers
  // ---------------------------------------------------------------------------

  async enablePreRoll({ enabled = true, beats }) {
    return this._sendCommand('enablePreRoll', { enabled, beats });
  }

  // ---------------------------------------------------------------------------
  // System / Info
  // ---------------------------------------------------------------------------

  async getBufferSize() {
    return this._sendCommand('getBufferSize');
  }

  async getDiskSpace() {
    return this._sendCommand('getDiskSpace');
  }

  // ---------------------------------------------------------------------------
  // Track Metadata
  // ---------------------------------------------------------------------------

  async addTrackNote({ trackId, note }) {
    return this._sendCommand('addTrackNote', { trackId, note });
  }

  async setAutoFade({ trackId, enabled }) {
    return this._sendCommand('setAutoFade', { trackId, enabled });
  }

  // ---------------------------------------------------------------------------
  // Templates / FX
  // ---------------------------------------------------------------------------

  async listAvailableTrackTemplates() {
    return this._sendCommand('listAvailableTrackTemplates');
  }

  async loadTrackTemplate({ trackId, templateName }) {
    return this._sendCommand('loadTrackTemplate', { trackId, templateName });
  }

  async listAvailableFxChains() {
    return this._sendCommand('listAvailableFxChains');
  }

  async loadFxChain({ trackId, fxChainName }) {
    return this._sendCommand('loadFxChain', { trackId, fxChainName });
  }

  // ---------------------------------------------------------------------------
  // FX Management
  // ---------------------------------------------------------------------------

  async getTrackFx({ trackId }) {
    return this._sendCommand('getTrackFx', { trackId });
  }

  async removeFx({ trackId, fxIndex }) {
    return this._sendCommand('removeFx', { trackId, fxIndex });
  }

  async toggleFxBypass({ trackId, fxIndex, bypassed }) {
    return this._sendCommand('toggleFxBypass', { trackId, fxIndex, bypassed });
  }

  // ---------------------------------------------------------------------------
  // Undo / Redo
  // ---------------------------------------------------------------------------

  async undo() {
    return this._sendCommand('undo');
  }

  async redo() {
    return this._sendCommand('redo');
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  async renderProject(args = {}) {
    return this._sendCommand('renderProject', args);
  }

  async renderStems(args = {}) {
    return this._sendCommand('renderStems', args);
  }

  // ---------------------------------------------------------------------------
  // Workflows
  // ---------------------------------------------------------------------------

  async previewWorkflow({ workflow, args }) {
    try {
      const { workflows: workflowHandlers } = require('../workflows');
      if (!workflowHandlers[workflow]) {
        return this._result(
          false,
          null,
          [],
          [`Unknown workflow: ${workflow}`],
          { bridgeType: BRIDGE_TYPES.JSON_QUEUE }
        );
      }
      const result = await workflowHandlers[workflow].preview(this, args);
      return this._result(true, result, [], [], {
        bridgeType: BRIDGE_TYPES.JSON_QUEUE,
        dryRun: true
      });
    } catch (err) {
      return this._result(false, null, [], [err.message], {
        bridgeType: BRIDGE_TYPES.JSON_QUEUE
      });
    }
  }

  async executeWorkflow({ workflow, args, confirmed }) {
    try {
      const { workflows: workflowHandlers } = require('../workflows');
      if (!workflowHandlers[workflow]) {
        return this._result(
          false,
          null,
          [],
          [`Unknown workflow: ${workflow}`],
          { bridgeType: BRIDGE_TYPES.JSON_QUEUE }
        );
      }
      const result = await workflowHandlers[workflow].execute(
        this,
        args,
        confirmed
      );
      return this._result(true, result, [], [], {
        bridgeType: BRIDGE_TYPES.JSON_QUEUE
      });
    } catch (err) {
      return this._result(false, null, [], [err.message], {
        bridgeType: BRIDGE_TYPES.JSON_QUEUE
      });
    }
  }
}

module.exports = JsonQueueReaperBridge;
