/**
 * Risk levels for actions performed on the REAPER session.
 */
const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
};

/**
 * Transport states for the REAPER playback engine.
 */
const TRANSPORT_STATES = {
  STOPPED: 'stopped',
  PLAYING: 'playing',
  RECORDING: 'recording',
  PAUSED: 'paused'
};

/**
 * Available bridge implementation types.
 */
const BRIDGE_TYPES = {
  MOCK: 'mock',
  JSON_QUEUE: 'json_queue',
  WEBSOCKET: 'websocket',
  HTTP: 'http'
};

/**
 * Named workflow identifiers.
 */
const WORKFLOW_NAMES = {
  SETUP_LEAD_VOCAL: 'setupLeadVocal',
  SETUP_LEAD_DOUBLE_ADLIB: 'setupLeadDoubleAdlib',
  PREPARE_PUNCH_IN: 'preparePunchIn',
  ORGANIZE_SESSION_TRACKS: 'organizeSessionTracks',
  COLOR_CODE_VOCALS: 'colorCodeVocals',
  DIAGNOSE_MONITORING_ISSUE: 'diagnoseMonitoringIssue',
  DIAGNOSE_LOW_INPUT_ISSUE: 'diagnoseLowInputIssue',
  SETUP_HEADPHONE_MIX: 'setupHeadphoneMix',
  COMP_TAKES: 'compTakes',
  ROUGH_MIX: 'roughMix',
  MARK_SONG_STRUCTURE: 'markSongStructure',
  SESSION_NOTES: 'sessionNotes',
  PREFLIGHT_CHECK: 'preflightCheck',
  QUICK_PUNCH_LOOP: 'quickPunchLoop',
  MANAGE_FX_CHAIN: 'manageFxChain',
  BATCH_RECORDING: 'batchRecording',
  EXPORT_BOUNCE: 'exportBounce'
};

/**
 * Confirmation policy mapping action types to their risk levels.
 * Actions at MEDIUM or HIGH risk require user confirmation before execution.
 */
const CONFIRMATION_POLICY = {
  // Read-only operations - no confirmation needed
  getProjectSummary: RISK_LEVELS.LOW,
  listTracks: RISK_LEVELS.LOW,
  getSelectedTrack: RISK_LEVELS.LOW,
  getMarkersAndRegions: RISK_LEVELS.LOW,
  getTransportState: RISK_LEVELS.LOW,
  ping: RISK_LEVELS.LOW,

  // Safe mutations - low risk, no confirmation
  selectTrack: RISK_LEVELS.LOW,
  renameTrack: RISK_LEVELS.LOW,
  setTrackColor: RISK_LEVELS.LOW,
  muteTrack: RISK_LEVELS.LOW,
  soloTrack: RISK_LEVELS.LOW,
  insertMarker: RISK_LEVELS.LOW,

  // Moderate mutations - medium risk, confirmation required
  createTrack: RISK_LEVELS.MEDIUM,
  armTrack: RISK_LEVELS.MEDIUM,
  disarmTrack: RISK_LEVELS.MEDIUM,
  toggleMonitoring: RISK_LEVELS.MEDIUM,
  duplicateTrack: RISK_LEVELS.MEDIUM,
  createFolderTrack: RISK_LEVELS.MEDIUM,
  createRegion: RISK_LEVELS.MEDIUM,
  loadTrackTemplate: RISK_LEVELS.MEDIUM,
  loadFxChain: RISK_LEVELS.MEDIUM,

  // Sends / routing
  createSend: RISK_LEVELS.MEDIUM,

  // Volume / pan
  setTrackVolume: RISK_LEVELS.LOW,
  setTrackPan: RISK_LEVELS.LOW,

  // Takes / items
  setActiveTake: RISK_LEVELS.MEDIUM,
  splitItemAtCursor: RISK_LEVELS.MEDIUM,

  // Loop / time selection
  setLoopPoints: RISK_LEVELS.LOW,

  // Transport controls
  play: RISK_LEVELS.LOW,
  stop: RISK_LEVELS.LOW,
  pause: RISK_LEVELS.LOW,
  record: RISK_LEVELS.MEDIUM,
  goToPosition: RISK_LEVELS.LOW,
  goToStart: RISK_LEVELS.LOW,
  goToEnd: RISK_LEVELS.LOW,

  // Undo / redo
  undo: RISK_LEVELS.LOW,
  redo: RISK_LEVELS.LOW,

  // FX management
  getTrackFx: RISK_LEVELS.LOW,
  removeFx: RISK_LEVELS.MEDIUM,
  toggleFxBypass: RISK_LEVELS.LOW,

  // Rendering
  renderProject: RISK_LEVELS.HIGH,
  renderStems: RISK_LEVELS.HIGH,

  // Workflow operations - high risk, always require confirmation
  executeWorkflow: RISK_LEVELS.HIGH,
  previewWorkflow: RISK_LEVELS.LOW
};

/**
 * Standard track colors for vocal session organization.
 */
const TRACK_COLORS = {
  LEAD_VOCAL: '#e74c3c',
  DOUBLE_LEFT: '#e67e22',
  DOUBLE_RIGHT: '#f39c12',
  ADLIB: '#9b59b6',
  BUS: '#3498db',
  FOLDER: '#2ecc71',
  INSTRUMENT: '#1abc9c'
};

/**
 * Default timeout for bridge commands in milliseconds.
 */
const COMMAND_TIMEOUT_MS = 5000;

module.exports = {
  RISK_LEVELS,
  TRANSPORT_STATES,
  BRIDGE_TYPES,
  WORKFLOW_NAMES,
  CONFIRMATION_POLICY,
  TRACK_COLORS,
  COMMAND_TIMEOUT_MS
};
