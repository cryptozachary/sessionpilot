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
    this._sends = [];

    // Project-level loop / time-selection / pre-roll state
    this._loopEnabled = false;
    this._loopStart = 0;
    this._loopEnd = 0;
    this._timeSelStart = 0;
    this._timeSelEnd = 0;
    this._preRollEnabled = false;
    this._preRollBeats = 4;

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
        itemCount: 0,
        volume: 1.0,
        pan: 0.0,
        notes: [],
        takes: []
      }),
      createTrackSummary({
        id: uuidv4(),
        index: 1,
        name: 'Bass Synth',
        color: '#16a085',
        isSelected: false,
        isMuted: false,
        isSolo: false,
        isArmed: false,
        monitoringOn: false,
        inputLabel: null,
        outputLabel: 'Master',
        folderDepth: 0,
        parentTrackId: null,
        fxNames: ['ReaSynth'],
        itemCount: 2,
        volume: 1.0,
        pan: 0.0,
        notes: [],
        takes: [],
        trackType: 'instrument',
        midiInput: 'All Channels',
        instrumentPlugin: 'ReaSynth'
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
        itemCount: 3,
        volume: 1.0,
        pan: 0.0,
        notes: [],
        takes: []
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
        itemCount: 3,
        volume: 1.0,
        pan: 0.0,
        notes: [],
        takes: []
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
        itemCount: 5,
        volume: 1.0,
        pan: 0.0,
        notes: [],
        takes: [
          { index: 0, name: 'Take 1', length: 45.2, isActive: true },
          { index: 1, name: 'Take 2', length: 44.8, isActive: false },
          { index: 2, name: 'Take 3', length: 46.1, isActive: false }
        ]
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
        itemCount: 2,
        volume: 1.0,
        pan: 0.0,
        notes: [],
        takes: []
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
        itemCount: 2,
        volume: 1.0,
        pan: 0.0,
        notes: [],
        takes: []
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
        itemCount: 4,
        volume: 1.0,
        pan: 0.0,
        notes: [],
        takes: []
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

  async moveTrackToFolder({ trackId, folderId }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);
    const folder = this._findTrack(folderId);
    if (!folder) return this._trackNotFound(folderId);

    track.parentTrackId = folderId;
    return this._result(true, { trackId, folderId, trackName: track.name, folderName: folder.name }, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  // ---------------------------------------------------------------------------
  // Sends / Routing
  // ---------------------------------------------------------------------------

  async createSend({ fromTrackId, toTrackId, prePost, volume, pan }) {
    await this._simulateLatency();
    const fromTrack = this._findTrack(fromTrackId);
    if (!fromTrack) return this._trackNotFound(fromTrackId);
    const toTrack = this._findTrack(toTrackId);
    if (!toTrack) return this._trackNotFound(toTrackId);

    const send = {
      id: uuidv4(),
      fromTrackId,
      toTrackId,
      prePost: prePost || 'post',
      volume: volume !== undefined ? volume : 1.0,
      pan: pan !== undefined ? pan : 0.0
    };
    this._sends.push(send);

    return this._result(true, send, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  // ---------------------------------------------------------------------------
  // Track Volume / Pan
  // ---------------------------------------------------------------------------

  async setTrackVolume({ trackId, volume }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);

    track.volume = volume;
    return this._result(true, { trackId, volume: track.volume }, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async setTrackPan({ trackId, pan }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);

    track.pan = pan;
    return this._result(true, { trackId, pan: track.pan }, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  // ---------------------------------------------------------------------------
  // Takes / Items
  // ---------------------------------------------------------------------------

  async listTakes({ trackId }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);

    return this._result(true, { trackId, takes: [...track.takes] }, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async setActiveTake({ trackId, itemIndex, takeIndex }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);

    if (!track.takes || track.takes.length === 0) {
      return this._result(false, null, [], ['No takes on this track'], {
        bridgeType: BRIDGE_TYPES.MOCK
      });
    }

    if (takeIndex < 0 || takeIndex >= track.takes.length) {
      return this._result(false, null, [], [`Take index ${takeIndex} out of range`], {
        bridgeType: BRIDGE_TYPES.MOCK
      });
    }

    // Deactivate all, then activate the target
    track.takes.forEach((t) => { t.isActive = false; });
    track.takes[takeIndex].isActive = true;

    return this._result(
      true,
      { trackId, itemIndex, activeTakeIndex: takeIndex, take: track.takes[takeIndex] },
      [],
      [],
      { bridgeType: BRIDGE_TYPES.MOCK }
    );
  }

  async splitItemAtCursor({ trackId, itemIndex }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);

    // Mock a split: return two items based on cursor position
    const cursorPos = this._playCursor || 0;
    const leftItem = {
      itemIndex,
      start: 0,
      length: cursorPos > 0 ? cursorPos : 10.0,
      name: `${track.name} (L)`
    };
    const rightItem = {
      itemIndex: itemIndex + 1,
      start: leftItem.length,
      length: 20.0,
      name: `${track.name} (R)`
    };

    // Increment the track item count
    track.itemCount = (track.itemCount || 0) + 1;

    return this._result(
      true,
      { trackId, splitPosition: leftItem.length, leftItem, rightItem },
      [],
      [],
      { bridgeType: BRIDGE_TYPES.MOCK }
    );
  }

  // ---------------------------------------------------------------------------
  // Loop / Time Selection
  // ---------------------------------------------------------------------------

  async setLoopPoints({ start, end: loopEnd, enabled }) {
    await this._simulateLatency();

    this._loopStart = start;
    this._loopEnd = loopEnd;
    this._loopEnabled = enabled;

    return this._result(
      true,
      { loopStart: this._loopStart, loopEnd: this._loopEnd, loopEnabled: this._loopEnabled },
      [],
      [],
      { bridgeType: BRIDGE_TYPES.MOCK }
    );
  }

  async setTimeSelection({ start, end: selEnd }) {
    await this._simulateLatency();

    this._timeSelStart = start;
    this._timeSelEnd = selEnd;

    return this._result(
      true,
      { timeSelStart: this._timeSelStart, timeSelEnd: this._timeSelEnd },
      [],
      [],
      { bridgeType: BRIDGE_TYPES.MOCK }
    );
  }

  // ---------------------------------------------------------------------------
  // Transport Controls
  // ---------------------------------------------------------------------------

  async play() {
    await this._simulateLatency();
    this._transportState = 'playing';
    return this._result(true, {
      state: this._transportState,
      playCursor: this._playCursor
    }, [], [], { bridgeType: BRIDGE_TYPES.MOCK });
  }

  async stop() {
    await this._simulateLatency();
    this._transportState = 'stopped';
    return this._result(true, {
      state: this._transportState,
      playCursor: this._playCursor
    }, [], [], { bridgeType: BRIDGE_TYPES.MOCK });
  }

  async pause() {
    await this._simulateLatency();
    this._transportState = 'paused';
    return this._result(true, {
      state: this._transportState,
      playCursor: this._playCursor
    }, [], [], { bridgeType: BRIDGE_TYPES.MOCK });
  }

  async record() {
    await this._simulateLatency();
    this._transportState = 'recording';
    return this._result(true, {
      state: this._transportState,
      playCursor: this._playCursor,
      recordMode: this._recordMode
    }, [], [], { bridgeType: BRIDGE_TYPES.MOCK });
  }

  async goToPosition({ position, bar } = {}) {
    await this._simulateLatency();
    if (bar !== undefined) {
      // Convert bar to seconds: (bar * 4 beats) / bpm * 60
      this._playCursor = ((bar - 1) * 4 / this._bpm) * 60;
    } else if (position !== undefined) {
      this._playCursor = position;
    }
    return this._result(true, {
      playCursor: this._playCursor,
      bar: bar || null
    }, [], [], { bridgeType: BRIDGE_TYPES.MOCK });
  }

  async goToStart() {
    await this._simulateLatency();
    this._playCursor = 0;
    return this._result(true, {
      playCursor: 0,
      description: 'Cursor moved to project start'
    }, [], [], { bridgeType: BRIDGE_TYPES.MOCK });
  }

  async goToEnd() {
    await this._simulateLatency();
    // Mock end position
    this._playCursor = 210.5;
    return this._result(true, {
      playCursor: this._playCursor,
      description: 'Cursor moved to project end'
    }, [], [], { bridgeType: BRIDGE_TYPES.MOCK });
  }

  // ---------------------------------------------------------------------------
  // Pre-Roll / Transport Helpers
  // ---------------------------------------------------------------------------

  async enablePreRoll({ enabled, beats }) {
    await this._simulateLatency();

    this._preRollEnabled = enabled;
    if (beats !== undefined) {
      this._preRollBeats = beats;
    }

    return this._result(
      true,
      { preRollEnabled: this._preRollEnabled, preRollBeats: this._preRollBeats },
      [],
      [],
      { bridgeType: BRIDGE_TYPES.MOCK }
    );
  }

  // ---------------------------------------------------------------------------
  // System / Info
  // ---------------------------------------------------------------------------

  async getBufferSize() {
    await this._simulateLatency();
    return this._result(
      true,
      { bufferSize: 256, sampleRate: 48000, estimatedLatency: 5.3 },
      [],
      [],
      { bridgeType: BRIDGE_TYPES.MOCK }
    );
  }

  async getDiskSpace() {
    await this._simulateLatency();
    return this._result(
      true,
      {
        availableGB: 142.7,
        recordingPath: '/Users/artist/Projects',
        estimatedMinutesAt48k: 3200
      },
      [],
      [],
      { bridgeType: BRIDGE_TYPES.MOCK }
    );
  }

  // ---------------------------------------------------------------------------
  // Track Metadata
  // ---------------------------------------------------------------------------

  async addTrackNote({ trackId, note }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);

    if (!track.notes) {
      track.notes = [];
    }
    track.notes.push(note);

    return this._result(
      true,
      { trackId, note, allNotes: [...track.notes] },
      [],
      [],
      { bridgeType: BRIDGE_TYPES.MOCK }
    );
  }

  async setAutoFade({ trackId, enabled }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);

    track.autoFade = enabled;

    return this._result(
      true,
      { trackId, autoFade: track.autoFade },
      [],
      [],
      { bridgeType: BRIDGE_TYPES.MOCK }
    );
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

  async goToMarker({ name }) {
    await this._simulateLatency();
    const searchName = (name || '').toLowerCase();
    const marker = this._markers.find(m => (m.name || '').toLowerCase().includes(searchName));
    if (!marker) {
      // Also check regions
      const region = this._regions.find(r => (r.name || '').toLowerCase().includes(searchName));
      if (!region) {
        return this._result(false, null, [], [`No marker or region found matching "${name}"`], {
          bridgeType: BRIDGE_TYPES.MOCK
        });
      }
      this._playCursor = region.start;
      return this._result(true, { position: region.start, name: region.name, type: 'region' }, [], [], {
        bridgeType: BRIDGE_TYPES.MOCK
      });
    }
    this._playCursor = marker.position;
    return this._result(true, { position: marker.position, name: marker.name, type: 'marker' }, [], [], {
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
  // Undo / Redo
  // ---------------------------------------------------------------------------

  async undo() {
    await this._simulateLatency();
    return this._result(true, { undone: true, description: 'Undo: mock action reversed' }, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async redo() {
    await this._simulateLatency();
    return this._result(true, { redone: true, description: 'Redo: mock action restored' }, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  // ---------------------------------------------------------------------------
  // FX Management
  // ---------------------------------------------------------------------------

  async getTrackFx({ trackId }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);
    const fxList = (track.fxNames || []).map((name, i) => ({
      index: i,
      name,
      bypassed: false,
      presetName: 'Default'
    }));
    return this._result(true, { trackId, fx: fxList }, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async removeFx({ trackId, fxIndex }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);
    if (!track.fxNames || fxIndex < 0 || fxIndex >= track.fxNames.length) {
      return this._result(false, null, [], [`FX index ${fxIndex} out of range`], {
        bridgeType: BRIDGE_TYPES.MOCK
      });
    }
    const removed = track.fxNames.splice(fxIndex, 1)[0];
    return this._result(true, { trackId, removedFx: removed, fxIndex }, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async toggleFxBypass({ trackId, fxIndex, bypassed }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);
    return this._result(true, { trackId, fxIndex, bypassed: bypassed !== false }, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  async getFxParameters({ trackId, fxIndex }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);
    const idx = fxIndex || 0;
    if (!track.fxNames || idx >= track.fxNames.length) {
      return this._result(false, null, [], ['FX index out of range'], { bridgeType: BRIDGE_TYPES.MOCK });
    }
    const fxName = track.fxNames[idx];
    const mockParams = this._getMockFxParams(fxName);
    return this._result(true, {
      trackId, fxIndex: idx, fxName, paramCount: mockParams.length, params: mockParams
    }, [], [], { bridgeType: BRIDGE_TYPES.MOCK });
  }

  _getMockFxParams(fxName) {
    const presets = {
      'ReaEQ': [
        { index: 0, name: 'Band 1 Freq', value: 0.3, minValue: 0, maxValue: 1, formattedValue: '300 Hz' },
        { index: 1, name: 'Band 1 Gain', value: 0.5, minValue: 0, maxValue: 1, formattedValue: '0.0 dB' },
        { index: 2, name: 'Band 1 Q', value: 0.5, minValue: 0, maxValue: 1, formattedValue: '1.0' },
        { index: 3, name: 'Band 2 Freq', value: 0.6, minValue: 0, maxValue: 1, formattedValue: '2.0 kHz' },
        { index: 4, name: 'Band 2 Gain', value: 0.5, minValue: 0, maxValue: 1, formattedValue: '0.0 dB' },
        { index: 5, name: 'Band 2 Q', value: 0.5, minValue: 0, maxValue: 1, formattedValue: '1.0' }
      ],
      'ReaComp': [
        { index: 0, name: 'Threshold', value: 0.7, minValue: 0, maxValue: 1, formattedValue: '-12.0 dB' },
        { index: 1, name: 'Ratio', value: 0.3, minValue: 0, maxValue: 1, formattedValue: '4:1' },
        { index: 2, name: 'Attack', value: 0.2, minValue: 0, maxValue: 1, formattedValue: '5 ms' },
        { index: 3, name: 'Release', value: 0.4, minValue: 0, maxValue: 1, formattedValue: '100 ms' },
        { index: 4, name: 'Makeup', value: 0.5, minValue: 0, maxValue: 1, formattedValue: '0.0 dB' }
      ],
      'ReaDelay': [
        { index: 0, name: 'Delay', value: 0.35, minValue: 0, maxValue: 1, formattedValue: '250 ms' },
        { index: 1, name: 'Feedback', value: 0.3, minValue: 0, maxValue: 1, formattedValue: '30%' },
        { index: 2, name: 'Mix', value: 0.25, minValue: 0, maxValue: 1, formattedValue: '25%' }
      ]
    };
    return presets[fxName] || [
      { index: 0, name: 'Parameter 1', value: 0.5, minValue: 0, maxValue: 1, formattedValue: '50%' },
      { index: 1, name: 'Parameter 2', value: 0.5, minValue: 0, maxValue: 1, formattedValue: '50%' }
    ];
  }

  async setFxParameter({ trackId, fxIndex, paramIndex, value }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);
    return this._result(true, {
      trackId, fxIndex, paramIndex, value,
      paramName: `Param ${paramIndex}`,
      formattedValue: `${Math.round(value * 100)}%`
    }, [], [], { bridgeType: BRIDGE_TYPES.MOCK });
  }

  async setFxPreset({ trackId, fxIndex, presetName }) {
    await this._simulateLatency();
    const track = this._findTrack(trackId);
    if (!track) return this._trackNotFound(trackId);
    return this._result(true, { trackId, fxIndex, preset: presetName }, [], [], {
      bridgeType: BRIDGE_TYPES.MOCK
    });
  }

  // ---------------------------------------------------------------------------
  // MIDI / Instrument Tracks
  // ---------------------------------------------------------------------------

  async createMidiTrack({ name, color, insertIndex, midiChannel, instrument }) {
    await this._simulateLatency();
    const index = insertIndex !== undefined ? insertIndex : this._tracks.length;
    const trackType = instrument ? 'instrument' : 'midi';
    const newTrack = createTrackSummary({
      id: uuidv4(),
      index,
      name: name || (instrument ? 'Instrument' : 'MIDI Track'),
      color: color || '#16a085',
      isSelected: false,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      monitoringOn: false,
      inputLabel: null,
      outputLabel: 'Master',
      folderDepth: 0,
      parentTrackId: null,
      fxNames: instrument ? [instrument] : [],
      itemCount: 0,
      trackType,
      midiInput: midiChannel ? `Channel ${midiChannel}` : 'All Channels',
      instrumentPlugin: instrument || null
    });

    if (index >= this._tracks.length) {
      this._tracks.push(newTrack);
    } else {
      this._tracks.splice(index, 0, newTrack);
    }
    this._tracks.forEach((t, i) => { t.index = i; });
    return this._result(true, newTrack, [], [], { bridgeType: BRIDGE_TYPES.MOCK });
  }

  // ---------------------------------------------------------------------------
  // MIDI Composition
  // ---------------------------------------------------------------------------

  async insertMidiNotes({ trackId, notes, startPositionQN, lengthQN, itemName }) {
    await this._simulateLatency();
    const track = trackId ? this._findTrack(trackId) : this._tracks.find(t => t.isSelected);
    if (!track) return this._trackNotFound(trackId || 'selected');

    const noteCount = (notes || []).length;
    const totalDurationQN = lengthQN || (notes || []).reduce((max, n) => {
      return Math.max(max, (n.startQN || 0) + (n.durationQN || 1));
    }, 0);

    track.itemCount = (track.itemCount || 0) + 1;

    return this._result(true, {
      trackId: track.id,
      noteCount,
      startPosition: (startPositionQN || 0) * 0.5,
      lengthSeconds: totalDurationQN * 0.5,
      itemName: itemName || '',
      notes: (notes || []).map(n => ({
        pitch: n.pitch,
        velocity: n.velocity || 96,
        channel: n.channel || 0,
        startQN: n.startQN || 0,
        durationQN: n.durationQN || 1
      }))
    }, [], [], { bridgeType: BRIDGE_TYPES.MOCK });
  }

  async createMidiItem({ trackId, startPositionQN, lengthQN, itemName }) {
    await this._simulateLatency();
    const track = trackId ? this._findTrack(trackId) : this._tracks.find(t => t.isSelected);
    if (!track) return this._trackNotFound(trackId || 'selected');
    track.itemCount = (track.itemCount || 0) + 1;
    return this._result(true, {
      trackId: track.id,
      startPosition: (startPositionQN || 0) * 0.5,
      lengthSeconds: (lengthQN || 4) * 0.5,
      itemName: itemName || ''
    }, [], [], { bridgeType: BRIDGE_TYPES.MOCK });
  }

  // ---------------------------------------------------------------------------
  // Peak Meters
  // ---------------------------------------------------------------------------

  async getTrackPeaks() {
    const isActive = this._transportState === 'playing' || this._transportState === 'recording';
    const peaks = this._tracks.map(t => ({
      trackIndex: t.index,
      peakL: isActive ? Math.random() * 0.7 + 0.05 : 0,
      peakR: isActive ? Math.random() * 0.7 + 0.05 : 0
    }));
    return this._result(true, { peaks }, [], [], { bridgeType: BRIDGE_TYPES.MOCK });
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  async renderProject({ outputPath, format, sampleRate, bitDepth } = {}) {
    await this._simulateLatency(300, 800);
    return this._result(true, {
      rendered: true,
      outputPath: outputPath || '/Projects/Renders/Mix.wav',
      format: format || 'wav',
      sampleRate: sampleRate || 48000,
      bitDepth: bitDepth || 24,
      durationSeconds: 210.5,
      fileSizeMB: 62.3
    }, [], [], { bridgeType: BRIDGE_TYPES.MOCK });
  }

  async renderStems({ outputPath, format, sampleRate, bitDepth, stemTracks } = {}) {
    await this._simulateLatency(300, 800);
    const trackNames = stemTracks || this._tracks.map(t => t.name);
    const stems = trackNames.map(name => ({
      trackName: name,
      outputFile: `${outputPath || '/Projects/Stems'}/${name.replace(/\s+/g, '_')}.${format || 'wav'}`,
      durationSeconds: 210.5
    }));
    return this._result(true, {
      rendered: true,
      stemCount: stems.length,
      stems,
      format: format || 'wav',
      sampleRate: sampleRate || 48000,
      bitDepth: bitDepth || 24
    }, [], [], { bridgeType: BRIDGE_TYPES.MOCK });
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
