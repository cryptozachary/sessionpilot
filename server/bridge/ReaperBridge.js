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
  // Sends / Routing
  // ---------------------------------------------------------------------------

  /**
   * Creates a send from one track to another.
   * @param {Object} params
   * @param {string} params.fromTrackId - Source track ID
   * @param {string} params.toTrackId - Destination track ID
   * @param {string} [params.prePost] - Pre/post fader ('pre' or 'post')
   * @param {number} [params.volume] - Send volume (0.0 to 2.0)
   * @param {number} [params.pan] - Send pan (-1.0 to 1.0)
   * @returns {Promise<Object>} BridgeResult with send info
   */
  async createSend({ fromTrackId, toTrackId, prePost, volume, pan }) {
    throw new Error('Not implemented: createSend');
  }

  // ---------------------------------------------------------------------------
  // Track Volume / Pan
  // ---------------------------------------------------------------------------

  /**
   * Sets a track's volume.
   * @param {Object} params
   * @param {string} params.trackId - Track to modify
   * @param {number} params.volume - Volume level (0.0 to 2.0, 1.0 = unity)
   * @returns {Promise<Object>} BridgeResult
   */
  async setTrackVolume({ trackId, volume }) {
    throw new Error('Not implemented: setTrackVolume');
  }

  /**
   * Sets a track's pan position.
   * @param {Object} params
   * @param {string} params.trackId - Track to modify
   * @param {number} params.pan - Pan position (-1.0 left to 1.0 right)
   * @returns {Promise<Object>} BridgeResult
   */
  async setTrackPan({ trackId, pan }) {
    throw new Error('Not implemented: setTrackPan');
  }

  // ---------------------------------------------------------------------------
  // Takes / Items
  // ---------------------------------------------------------------------------

  /**
   * Lists all takes/items on a track.
   * @param {Object} params
   * @param {string} params.trackId - Track to query
   * @returns {Promise<Object>} Array of takes wrapped in BridgeResult
   */
  async listTakes({ trackId }) {
    throw new Error('Not implemented: listTakes');
  }

  /**
   * Sets the active take on a media item.
   * @param {Object} params
   * @param {string} params.trackId - Track containing the item
   * @param {number} params.itemIndex - Item index on the track
   * @param {number} params.takeIndex - Take index to activate
   * @returns {Promise<Object>} BridgeResult
   */
  async setActiveTake({ trackId, itemIndex, takeIndex }) {
    throw new Error('Not implemented: setActiveTake');
  }

  /**
   * Splits a media item at the edit cursor position.
   * @param {Object} params
   * @param {string} params.trackId - Track containing the item
   * @param {number} params.itemIndex - Item index on the track
   * @returns {Promise<Object>} BridgeResult with the two resulting items
   */
  async splitItemAtCursor({ trackId, itemIndex }) {
    throw new Error('Not implemented: splitItemAtCursor');
  }

  // ---------------------------------------------------------------------------
  // Loop / Time Selection
  // ---------------------------------------------------------------------------

  /**
   * Sets the loop points and enables/disables looping.
   * @param {Object} params
   * @param {number} params.start - Loop start position in seconds
   * @param {number} params.end - Loop end position in seconds
   * @param {boolean} params.enabled - Whether looping is enabled
   * @returns {Promise<Object>} BridgeResult with loop config
   */
  async setLoopPoints({ start, end, enabled }) {
    throw new Error('Not implemented: setLoopPoints');
  }

  /**
   * Sets the time selection range.
   * @param {Object} params
   * @param {number} params.start - Selection start in seconds
   * @param {number} params.end - Selection end in seconds
   * @returns {Promise<Object>} BridgeResult with selection info
   */
  async setTimeSelection({ start, end }) {
    throw new Error('Not implemented: setTimeSelection');
  }

  // ---------------------------------------------------------------------------
  // Pre-Roll / Transport Helpers
  // ---------------------------------------------------------------------------

  /**
   * Enables or disables pre-roll with an optional beat count.
   * @param {Object} params
   * @param {boolean} params.enabled - Whether pre-roll is enabled
   * @param {number} [params.beats] - Number of pre-roll beats
   * @returns {Promise<Object>} BridgeResult with pre-roll config
   */
  async enablePreRoll({ enabled, beats }) {
    throw new Error('Not implemented: enablePreRoll');
  }

  // ---------------------------------------------------------------------------
  // System / Info
  // ---------------------------------------------------------------------------

  /**
   * Returns the current audio buffer size and related info.
   * @returns {Promise<Object>} BridgeResult with buffer size, sample rate, latency
   */
  async getBufferSize() {
    throw new Error('Not implemented: getBufferSize');
  }

  /**
   * Returns available disk space for recording.
   * @returns {Promise<Object>} BridgeResult with disk space info
   */
  async getDiskSpace() {
    throw new Error('Not implemented: getDiskSpace');
  }

  // ---------------------------------------------------------------------------
  // Track Metadata
  // ---------------------------------------------------------------------------

  /**
   * Adds a note/comment to a track.
   * @param {Object} params
   * @param {string} params.trackId - Track to annotate
   * @param {string} params.note - Note text to add
   * @returns {Promise<Object>} BridgeResult
   */
  async addTrackNote({ trackId, note }) {
    throw new Error('Not implemented: addTrackNote');
  }

  /**
   * Enables or disables auto-crossfade on a track.
   * @param {Object} params
   * @param {string} params.trackId - Track to modify
   * @param {boolean} params.enabled - Whether auto-crossfade is enabled
   * @returns {Promise<Object>} BridgeResult
   */
  async setAutoFade({ trackId, enabled }) {
    throw new Error('Not implemented: setAutoFade');
  }

  // ---------------------------------------------------------------------------
  // Undo / Redo
  // ---------------------------------------------------------------------------

  async undo() {
    throw new Error('Not implemented: undo');
  }

  async redo() {
    throw new Error('Not implemented: redo');
  }

  // ---------------------------------------------------------------------------
  // FX Management
  // ---------------------------------------------------------------------------

  async getTrackFx({ trackId }) {
    throw new Error('Not implemented: getTrackFx');
  }

  async removeFx({ trackId, fxIndex }) {
    throw new Error('Not implemented: removeFx');
  }

  async toggleFxBypass({ trackId, fxIndex, bypassed }) {
    throw new Error('Not implemented: toggleFxBypass');
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  async renderProject({ outputPath, format, sampleRate, bitDepth, tail } = {}) {
    throw new Error('Not implemented: renderProject');
  }

  async renderStems({ outputPath, format, sampleRate, bitDepth, stemTracks } = {}) {
    throw new Error('Not implemented: renderStems');
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
