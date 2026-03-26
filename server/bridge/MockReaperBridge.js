const { v4: uuidv4 } = require('uuid');
const ReaperBridge = require('./ReaperBridge');
const { createTrackSummary, createProjectSummary } = require('../models');
const { BRIDGE_TYPES } = require('./bridgeTypes');

/**
 * Simulates a REAPER session with realistic mock state.
 * All methods mutate internal state and return normalized BridgeResult objects.
 */
class MockReaperBridge extends ReaperBridge {
  constructor() {
    super();

    this._connected = true;
    this._projectName = 'Vocal Session - Track 7';
    this._projectPath = '/Users/artist/Projects/Track7/Track7.rpp';
    this._sampleRate = 48000;
    this._bpm = 140;
    this._transportState = 'stopped';
    this._playCursor = 0;
    this._recordMode = 'normal';

    this._tracks = this._initTracks();
    this._markers = this._initMarkers();
    this._regions = this._initRegions();

    this._templates = [
      'Lead Vocal Starter',
      'Vocal Double',
      'Vocal Adlib',
      'Vocal Bus',
      'Backing Vocal'
    ];

    this._fxChains = [
      'Vocal Clean',
      'Vocal Warm',
      'Vocal Effects',
      'Vocal De-Ess',
      'Vocal Comp+EQ'
    ];
  }

  /**
   * Initializes the 8 mock tracks.
   * @returns {Object[]}
   */
  _initTracks() {
    return [
      createTrackSummary({
        id: uuidv4(),
        index: 0,
        name: 'Drums Bus',
        color: '#1abc9c',
        isSelected: false,
        isMuted: false,
        isSolo: false,
        isArmed: false,
        monitoringOn: false,
        inputLabel: null,
        outputLabel: 'Master',
        folderDepth: 1,
        parentTrackId: null,
        fxNames: [],
        itemCount: 0
      }),
      createTrackSummary({
        id: uuidv4(),
        index: 1,
        name: 'Bass DI',
        color: '#3498db',
        isSelected: false,
        isMuted: false,
        isSolo: false,
        isArmed: false,
        monitoringOn: false,
        inputLabel: null,
        outputLabel: 'Master',
        folderDepth: 0,
        parentTrackId: null,
        fxNames: [],
        itemCount: 2
      }),
      createTrackSummary({
        id: uuidv4(),
        index: 2,
        name: 'Guitar L',
        color: '#2ecc71',
        isSelected: false,
        isMuted: false,
        isSolo: false,
        isArmed: false,
        monitoringOn: false,
        inputLabel: null,
        outputLabel: 'Master',
        folderDepth: 0,
        parentTrackId: null,
        fxNames: [],
        itemCount: 3
      }),
      createTrackSummary({
        id: uuidv4(),
        index: 3,
        name: 'Guitar R',
        color: '#2ecc71',
        isSelected: false,
        isMuted: false,
        isSolo: false,
        isArmed: false,
        monitoringOn: false,
        inputLabel: null,
        outputLabel: 'Master',
        folderDepth: 0,
        parentTrackId: null,
        fxNames: [],
        itemCount: 3
      }),
      createTrackSummary({
        id: uuidv4(),
        index: 4,
        name: 'Lead Vocal',
        color: '#e74c3c',
        isSelected: true,
        isMuted: false,
        isSolo: false,
        isArmed: true,
        monitoringOn: true,
        inputLabel: 'Input 1 (Mic)',
        outputLabel: 'Master',
        folderDepth: 0,
        parentTrackId: null,
        fxNames: ['ReaEQ', 'ReaComp', 'ReaDelay'],
        itemCount: 5
      }),
      createTrackSummary({
        id: uuidv4(),
        index: 5,
        name: 'Vocal Double L',
        color: '#e67e22',
        isSelected: false,
        isMuted: false,
        isSolo: false,
        isArmed: false,
        monitoringOn: false,
        inputLabel: null,
        outputLabel: 'Master',
        folderDepth: 0,
        parentTrackId: null,
        fxNames: [],
        itemCount: 2
      }),
      createTrackSummary({
        id: uuidv4(),
        index: 6,
        name: 'Vocal Double R',
        color: '#f39c12',
        isSelected: false,
        isMuted: false,
        isSolo: false,
        isArmed: false,
        monitoringOn: false,
        inputLabel: null,
        outputLabel: 'Master',
        folderDepth: 0,
        parentTrackId: null,
        fxNames: [],
        itemCount: 2
      }),
      createTrackSummary({
        id: uuidv4(),
        index: 7,
        name: 'Adlibs',
        color: '#9b59b6',
        isSelected: false,
        isMuted: false,
        isSolo: false,
        isArmed: false,
        monitoringOn: false,
        inputLabel: null,
        outputLabel: 'Master',
        folderDepth: 0,
        parentTrackId: null,
        fxNames: [],
        itemCount: 4
      })
    ];
  }

  /**
   * Initializes mock markers.
   * @returns {Object[]}
   */
  _initMarkers() {
    return [
      { id: uuidv4(), position: 0, name: 'Intro' },
      { id: uuidv4(), position: 16, name: 'Verse 1' },
      { id: uuidv4(), position: 48, name: 'Chorus' }
    ];
  }

  /**
   * Initializes mock regions.
   * @returns {Object[]}
   */
  _initRegions() {
    return [
      { id: uuidv4(), start: 16, end: 48, name: 'Verse 1' },
      { id: uuidv4(), start: 48, end: 80, name: 'Chorus' }
    ];
  }

  /**
   * Returns a random delay between min and max milliseconds.
   * @param {number} [min=50]
   * @param {number} [max=200]
   * @returns {Promise<void>}
   */
  async _simulateLatency(min = 50, max = 200) {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Finds a track by ID.
   * @param {string} trackId
   * @returns {Object|undefined}
   */
  _findTrack(trackId) {
    return this._tracks.find((t) => t.id === trackId);
  }

  /**
   * Helper to return a "track not found" error result.
   * @param {string} trackId
   * @returns {Object}
   */
  _trackNotFound(trackId) {
    return this._result(false, null, [], [`Track not found: ${trackId}`], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  async getConnectionStatus() {
    await this._simulateLatency();
    return this._result(
      true,
      { connected: this._connected, bridgeType: BRIDGE_TYPES.MOCK },
      [],
      [],
      { bridgeType: BRIDGE_TYPES.MOCK }
    );
  }

  async ping() {
    const start = Date.now();
    await this._simulateLatency(5, 20);
    const latency = Date.now() - start;
    return this._result(true, { latency }, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  async getProjectSummary() {
    await this._simulateLatency();
    const summary = createProjectSummary({
      projectName: this._projectName,
      projectPath: this._projectPath,
      sampleRate: this._sampleRate,
      bpm: this._bpm,
      transportState: this._transportState,
      playCursor: this._playCursor,
      recordMode: this._recordMode,
      trackCount: this._tracks.length,
      markerCount: this._markers.length,
      regionCount: this._regions.length
    });
    return this._result(true, summary, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async listTracks() {
    await this._simulateLatency();
    return this._result(true, [...this._tracks], [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async getSelectedTrack() {
    await this._simulateLatency();
    const selected = this._tracks.find((t) => t.isSelected) || null;
    return this._result(true, selected, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async getMarkersAndRegions() {
    await this._simulateLatency();
    return this._result(
      true,
      { markers: [...this._markers], regions: [...this._regions] },
      [],
      [],
      { bridgeType: BRIDGE_TYPES.MOCK }
    );
  }

  async getTransportState() {
    await this._simulateLatency();
    return this._result(
      true,
      {
        state: this._transportState,
        playCursor: this._playCursor,
        bpm: this._bpm,
        recordMode: this._recordMode
      },
      [],
      [],
      { bridgeType: BRIDGE_TYPES.MOCK }
    );
  }

  // ---------------------------------------------------------------------------
  // Track mutations
  // ---------------------------------------------------------------------------

  async createTrack({ name, color, insertIndex, parentTrackId }) {
    await this._simulateLatency();
    const index =
      insertIndex !== undefined ? insertIndex : this._tracks.length;
    const newTrack = createTrackSummary({
      id: uuidv4(),
      index,
      name: name || 'New Track',
      color: color || null,
      isSelected: false,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      monitoringOn: false,
      inputLabel: null,
      outputLabel: 'Master',
      folderDepth: 0,
      parentTrackId: parentTrackId || null,
      fxNames: [],
      itemCount: 0
    });

    if (index >= this._tracks.length) {
      this._tracks.push(newTrack);
    } else {
      this._tracks.splice(index, 0, newTrack);
    }

    // Re-index tracks
    this._tracks.forEach((t, i) => {
      t.index = i;
    });

    return this._result(true, newTrack, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async renameTrack({ trackId, name }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);

    track.name = name;
    return this._result(true, track, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async setTrackColor({ trackId, color }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);

    track.color = color;
    return this._result(true, track, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async selectTrack({ trackId }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);

    // Deselect all, then select target
    this._tracks.forEach((t) => {
      t.isSelected = false;
    });
    track.isSelected = true;

    return this._result(true, track, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async armTrack({ trackId }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);

    track.isArmed = true;
    return this._result(true, track, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async disarmTrack({ trackId }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);

    track.isArmed = false;
    return this._result(true, track, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async toggleMonitoring({ trackId, enabled }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);

    track.monitoringOn = enabled;
    return this._result(true, track, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async muteTrack({ trackId, enabled }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);

    track.isMuted = enabled;
    return this._result(true, track, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async soloTrack({ trackId, enabled }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);

    track.isSolo = enabled;
    return this._result(true, track, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async duplicateTrack({ trackId, newName }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);

    const duplicate = createTrackSummary({
      ...track,
      id: uuidv4(),
      index: track.index + 1,
      name: newName || `${track.name} (Copy)`,
      isSelected: false,
      isArmed: false
    });

    this._tracks.splice(track.index + 1, 0, duplicate);

    // Re-index tracks
    this._tracks.forEach((t, i) => {
      t.index = i;
    });

    return this._result(true, duplicate, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async createFolderTrack({ name, color }) {
    await this._simulateLatency();
    const newFolder = createTrackSummary({
      id: uuidv4(),
      index: this._tracks.length,
      name: name || 'New Folder',
      color: color || null,
      isSelected: false,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      monitoringOn: false,
      inputLabel: null,
      outputLabel: 'Master',
      folderDepth: 1,
      parentTrackId: null,
      fxNames: [],
      itemCount: 0
    });

    this._tracks.push(newFolder);

    return this._result(true, newFolder, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  // ---------------------------------------------------------------------------
  // Markers
  // ---------------------------------------------------------------------------

  async insertMarker({ position, name }) {
    await this._simulateLatency();
    const marker = { id: uuidv4(), position, name };
    this._markers.push(marker);
    return this._result(true, marker, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async createRegion({ start, end, name }) {
    await this._simulateLatency();
    const region = { id: uuidv4(), start, end, name };
    this._regions.push(region);
    return this._result(true, region, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  // ---------------------------------------------------------------------------
  // Templates / FX
  // ---------------------------------------------------------------------------

  async listAvailableTrackTemplates() {
    await this._simulateLatency();
    return this._result(true, [...this._templates], [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async loadTrackTemplate({ trackId, templateName }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);

    if (!this._templates.includes(templateName)) {
      return this._result(
        false,
        null,
        [],
        [`Template not found: ${templateName}`],
        { bridgeType: BRIDGE_TYPES.MOCK }
      );
    }

    return this._result(
      true,
      { track, templateApplied: templateName },
      [],
      [],
      { bridgeType: BRIDGE_TYPES.MOCK }
    );
  }

  async listAvailableFxChains() {
    await this._simulateLatency();
    return this._result(true, [...this._fxChains], [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async loadFxChain({ trackId, fxChainName }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);

    if (!this._fxChains.includes(fxChainName)) {
      return this._result(
        false,
        null,
        [],
        [`FX chain not found: ${fxChainName}`],
        { bridgeType: BRIDGE_TYPES.MOCK }
      );
    }

    track.fxNames.push(fxChainName);
    return this._result(
      true,
      { track, fxChainApplied: fxChainName },
      [],
      [],
      { bridgeType: BRIDGE_TYPES.MOCK }
    );
  }

  // ---------------------------------------------------------------------------
  // Workflows
  // ---------------------------------------------------------------------------

  async previewWorkflow({ workflow, args }) {
    await this._simulateLatency();
    try {
      const { workflows: workflowHandlers } = require('../workflows');
      if (!workflowHandlers[workflow]) {
        return this._result(
          false,
          null,
          [],
          [`Unknown workflow: ${workflow}`],
          { bridgeType: BRIDGE_TYPES.MOCK }
        );
      }
      const result = await workflowHandlers[workflow].preview(this, args);
      return this._result(true, result, [], [], {
        bridgeType: BRIDGE_TYPES.MOCK,
        dryRun: true
      });
    } catch (err) {
      return this._result(false, null, [], [err.message], {
        bridgeType: BRIDGE_TYPES.MOCK
      });
    }
  }

  async executeWorkflow({ workflow, args, confirmed }) {
    await this._simulateLatency();
    try {
      const { workflows: workflowHandlers } = require('../workflows');
      if (!workflowHandlers[workflow]) {
        return this._result(
          false,
          null,
          [],
          [`Unknown workflow: ${workflow}`],
          { bridgeType: BRIDGE_TYPES.MOCK }
        );
      }
      const result = await workflowHandlers[workflow].execute(this, args, confirmed);
      return this._result(true, result, [], [], {
        bridgeType: BRIDGE_TYPES.MOCK
      });
    } catch (err) {
      return this._result(false, null, [], [err.message], {
        bridgeType: BRIDGE_TYPES.MOCK
      });
    }
  }
}

module.exports = MockReaperBridge;
