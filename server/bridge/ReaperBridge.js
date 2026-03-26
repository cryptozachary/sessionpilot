const { createBridgeResult } = require('../models');

/**
 * Abstract base class defining the REAPER bridge contract.
 *
 * All concrete bridge implementations (Mock, JsonQueue, WebSocket, HTTP)
 * must extend this class and implement every method. Calling an unimplemented
 * method will throw a "Not implemented" error.
 */
class ReaperBridge {
  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  /**
   * Returns the current connection status of the bridge.
   * @returns {Promise<Object>} Connection status info
   */
  async getConnectionStatus() {
    throw new Error('Not implemented: getConnectionStatus');
  }

  /**
   * Pings the REAPER instance to check responsiveness.
   * @returns {Promise<Object>} Ping result with latency
   */
  async ping() {
    throw new Error('Not implemented: ping');
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  /**
   * Returns a summary of the current REAPER project.
   * @returns {Promise<Object>} ProjectSummary wrapped in BridgeResult
   */
  async getProjectSummary() {
    throw new Error('Not implemented: getProjectSummary');
  }

  /**
   * Lists all tracks in the current session.
   * @returns {Promise<Object>} Array of TrackSummary wrapped in BridgeResult
   */
  async listTracks() {
    throw new Error('Not implemented: listTracks');
  }

  /**
   * Returns the currently selected track.
   * @returns {Promise<Object>} TrackSummary or null wrapped in BridgeResult
   */
  async getSelectedTrack() {
    throw new Error('Not implemented: getSelectedTrack');
  }

  /**
   * Returns all markers and regions in the project.
   * @returns {Promise<Object>} Markers and regions wrapped in BridgeResult
   */
  async getMarkersAndRegions() {
    throw new Error('Not implemented: getMarkersAndRegions');
  }

  /**
   * Returns the current transport state (playing, stopped, recording, paused).
   * @returns {Promise<Object>} Transport state wrapped in BridgeResult
   */
  async getTransportState() {
    throw new Error('Not implemented: getTransportState');
  }

  // ---------------------------------------------------------------------------
  // Track mutations
  // ---------------------------------------------------------------------------

  /**
   * Creates a new track in the session.
   * @param {Object} params
   * @param {string} params.name - Track name
   * @param {string} [params.color] - Hex color
   * @param {number} [params.insertIndex] - Position to insert at
   * @param {string} [params.parentTrackId] - Parent folder track ID
   * @returns {Promise<Object>} Created TrackSummary wrapped in BridgeResult
   */
  async createTrack({ name, color, insertIndex, parentTrackId }) {
    throw new Error('Not implemented: createTrack');
  }

  /**
   * Renames a track.
   * @param {Object} params
   * @param {string} params.trackId - Track to rename
   * @param {string} params.name - New name
   * @returns {Promise<Object>} BridgeResult
   */
  async renameTrack({ trackId, name }) {
    throw new Error('Not implemented: renameTrack');
  }

  /**
   * Sets the color of a track.
   * @param {Object} params
   * @param {string} params.trackId - Track to recolor
   * @param {string} params.color - Hex color string
   * @returns {Promise<Object>} BridgeResult
   */
  async setTrackColor({ trackId, color }) {
    throw new Error('Not implemented: setTrackColor');
  }

  /**
   * Selects a track.
   * @param {Object} params
   * @param {string} params.trackId - Track to select
   * @returns {Promise<Object>} BridgeResult
   */
  async selectTrack({ trackId }) {
    throw new Error('Not implemented: selectTrack');
  }

  /**
   * Arms a track for recording.
   * @param {Object} params
   * @param {string} params.trackId - Track to arm
   * @returns {Promise<Object>} BridgeResult
   */
  async armTrack({ trackId }) {
    throw new Error('Not implemented: armTrack');
  }

  /**
   * Disarms a track.
   * @param {Object} params
   * @param {string} params.trackId - Track to disarm
   * @returns {Promise<Object>} BridgeResult
   */
  async disarmTrack({ trackId }) {
    throw new Error('Not implemented: disarmTrack');
  }

  /**
   * Toggles input monitoring on a track.
   * @param {Object} params
   * @param {string} params.trackId - Track to modify
   * @param {boolean} params.enabled - Monitoring on/off
   * @returns {Promise<Object>} BridgeResult
   */
  async toggleMonitoring({ trackId, enabled }) {
    throw new Error('Not implemented: toggleMonitoring');
  }

  /**
   * Mutes or unmutes a track.
   * @param {Object} params
   * @param {string} params.trackId - Track to modify
   * @param {boolean} params.enabled - Mute on/off
   * @returns {Promise<Object>} BridgeResult
   */
  async muteTrack({ trackId, enabled }) {
    throw new Error('Not implemented: muteTrack');
  }

  /**
   * Solos or unsolos a track.
   * @param {Object} params
   * @param {string} params.trackId - Track to modify
   * @param {boolean} params.enabled - Solo on/off
   * @returns {Promise<Object>} BridgeResult
   */
  async soloTrack({ trackId, enabled }) {
    throw new Error('Not implemented: soloTrack');
  }

  /**
   * Duplicates a track with a new name.
   * @param {Object} params
   * @param {string} params.trackId - Track to duplicate
   * @param {string} params.newName - Name for the duplicate
   * @returns {Promise<Object>} BridgeResult with new TrackSummary
   */
  async duplicateTrack({ trackId, newName }) {
    throw new Error('Not implemented: duplicateTrack');
  }

  /**
   * Creates a new folder track.
   * @param {Object} params
   * @param {string} params.name - Folder track name
   * @param {string} [params.color] - Hex color
   * @returns {Promise<Object>} BridgeResult with new TrackSummary
   */
  async createFolderTrack({ name, color }) {
    throw new Error('Not implemented: createFolderTrack');
  }

  // ---------------------------------------------------------------------------
  // Markers
  // ---------------------------------------------------------------------------

  /**
   * Inserts a marker at the specified position.
   * @param {Object} params
   * @param {number} params.position - Position in beats
   * @param {string} params.name - Marker name
   * @returns {Promise<Object>} BridgeResult
   */
  async insertMarker({ position, name }) {
    throw new Error('Not implemented: insertMarker');
  }

  /**
   * Creates a region between two positions.
   * @param {Object} params
   * @param {number} params.start - Start position in beats
   * @param {number} params.end - End position in beats
   * @param {string} params.name - Region name
   * @returns {Promise<Object>} BridgeResult
   */
  async createRegion({ start, end, name }) {
    throw new Error('Not implemented: createRegion');
  }

  // ---------------------------------------------------------------------------
  // Templates / FX
  // ---------------------------------------------------------------------------

  /**
   * Lists all available track templates.
   * @returns {Promise<Object>} Array of template names wrapped in BridgeResult
   */
  async listAvailableTrackTemplates() {
    throw new Error('Not implemented: listAvailableTrackTemplates');
  }

  /**
   * Loads a track template onto a track.
   * @param {Object} params
   * @param {string} params.trackId - Target track
   * @param {string} params.templateName - Template to load
   * @returns {Promise<Object>} BridgeResult
   */
  async loadTrackTemplate({ trackId, templateName }) {
    throw new Error('Not implemented: loadTrackTemplate');
  }

  /**
   * Lists all available FX chains.
   * @returns {Promise<Object>} Array of FX chain names wrapped in BridgeResult
   */
  async listAvailableFxChains() {
    throw new Error('Not implemented: listAvailableFxChains');
  }

  /**
   * Loads an FX chain onto a track.
   * @param {Object} params
   * @param {string} params.trackId - Target track
   * @param {string} params.fxChainName - FX chain to load
   * @returns {Promise<Object>} BridgeResult
   */
  async loadFxChain({ trackId, fxChainName }) {
    throw new Error('Not implemented: loadFxChain');
  }

  // ---------------------------------------------------------------------------
  // Workflows
  // ---------------------------------------------------------------------------

  /**
   * Previews a workflow without executing it. Returns the proposed actions.
   * @param {Object} params
   * @param {string} params.workflow - Workflow name
   * @param {Object} params.args - Workflow arguments
   * @returns {Promise<Object>} WorkflowResult wrapped in BridgeResult
   */
  async previewWorkflow({ workflow, args }) {
    throw new Error('Not implemented: previewWorkflow');
  }

  /**
   * Executes a workflow. Must be confirmed if required.
   * @param {Object} params
   * @param {string} params.workflow - Workflow name
   * @param {Object} params.args - Workflow arguments
   * @param {boolean} params.confirmed - Whether the user has confirmed
   * @returns {Promise<Object>} WorkflowResult wrapped in BridgeResult
   */
  async executeWorkflow({ workflow, args, confirmed }) {
    throw new Error('Not implemented: executeWorkflow');
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Creates a normalized BridgeResult object.
   * @param {boolean} ok - Whether the operation succeeded
   * @param {*} data - Result data
   * @param {string[]} [warnings=[]] - Warning messages
   * @param {string[]} [errors=[]] - Error messages
   * @param {Object} [meta={}] - Additional metadata
   * @returns {Object} BridgeResult
   */
  _result(ok, data, warnings = [], errors = [], meta = {}) {
    return createBridgeResult({
      ok,
      data,
      warnings,
      errors,
      meta: {
        bridgeType: meta.bridgeType || '',
        requestId: meta.requestId || undefined,
        timestamp: meta.timestamp || new Date().toISOString(),
        dryRun: meta.dryRun || false,
        ...meta
      }
    });
  }
}

module.exports = ReaperBridge;
