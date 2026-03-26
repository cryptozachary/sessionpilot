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
  DIAGNOSE_LOW_INPUT_ISSUE: 'diagnoseLowInputIssue'
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
