const { v4: uuidv4 } = require('uuid');

/**
 * @typedef {Object} TrackSummary
 * @property {string} id - Unique track identifier
 * @property {number} index - Track index in the session
 * @property {string} name - Track name
 * @property {string|null} color - Hex color string or null
 * @property {boolean} isSelected - Whether the track is currently selected
 * @property {boolean} isMuted - Whether the track is muted
 * @property {boolean} isSolo - Whether the track is soloed
 * @property {boolean} isArmed - Whether the track is armed for recording
 * @property {boolean} monitoringOn - Whether input monitoring is enabled
 * @property {string|null} inputLabel - Input routing label
 * @property {string|null} outputLabel - Output routing label
 * @property {number} folderDepth - Folder depth level (0 = top level)
 * @property {string|null} parentTrackId - Parent folder track ID or null
 * @property {string[]} fxNames - Names of FX plugins on the track
 * @property {number} itemCount - Number of media items on the track
 */

/**
 * Creates a TrackSummary object.
 * @param {Partial<TrackSummary>} [overrides={}] - Fields to override defaults
 * @returns {TrackSummary}
 */
function createTrackSummary(overrides = {}) {
  return {
    id: overrides.id || uuidv4(),
    index: overrides.index || 0,
    name: overrides.name || '',
    color: overrides.color || null,
    isSelected: overrides.isSelected || false,
    isMuted: overrides.isMuted || false,
    isSolo: overrides.isSolo || false,
    isArmed: overrides.isArmed || false,
    monitoringOn: overrides.monitoringOn || false,
    inputLabel: overrides.inputLabel || null,
    outputLabel: overrides.outputLabel || null,
    folderDepth: overrides.folderDepth !== undefined ? overrides.folderDepth : 0,
    parentTrackId: overrides.parentTrackId || null,
    fxNames: overrides.fxNames || [],
    itemCount: overrides.itemCount || 0,
    ...overrides
  };
}

/**
 * @typedef {Object} ProjectSummary
 * @property {string} projectName - Name of the REAPER project
 * @property {string} projectPath - File path to the .rpp file
 * @property {number} sampleRate - Sample rate in Hz
 * @property {number} bpm - Tempo in beats per minute
 * @property {string} transportState - Current transport state
 * @property {number} playCursor - Play cursor position in beats
 * @property {string} recordMode - Current record mode
 * @property {number} trackCount - Number of tracks in the session
 * @property {number} markerCount - Number of markers
 * @property {number} regionCount - Number of regions
 */

/**
 * Creates a ProjectSummary object.
 * @param {Partial<ProjectSummary>} [overrides={}] - Fields to override defaults
 * @returns {ProjectSummary}
 */
function createProjectSummary(overrides = {}) {
  return {
    projectName: overrides.projectName || '',
    projectPath: overrides.projectPath || '',
    sampleRate: overrides.sampleRate || 44100,
    bpm: overrides.bpm || 120,
    transportState: overrides.transportState || 'stopped',
    playCursor: overrides.playCursor || 0,
    recordMode: overrides.recordMode || 'normal',
    trackCount: overrides.trackCount || 0,
    markerCount: overrides.markerCount || 0,
    regionCount: overrides.regionCount || 0,
    ...overrides
  };
}

/**
 * @typedef {Object} ProposedAction
 * @property {string} id - Unique action identifier
 * @property {string} type - Action type identifier
 * @property {string} label - Human-readable short label
 * @property {string} description - Detailed description of the action
 * @property {'low'|'medium'|'high'} riskLevel - Risk assessment level
 * @property {boolean} requiresConfirmation - Whether user confirmation is needed
 * @property {Object} args - Arguments for the action
 */

/**
 * Creates a ProposedAction object.
 * @param {Partial<ProposedAction>} [overrides={}] - Fields to override defaults
 * @returns {ProposedAction}
 */
function createProposedAction(overrides = {}) {
  return {
    id: overrides.id || uuidv4(),
    type: overrides.type || '',
    label: overrides.label || '',
    description: overrides.description || '',
    riskLevel: overrides.riskLevel || 'low',
    requiresConfirmation: overrides.requiresConfirmation || false,
    args: overrides.args || {},
    ...overrides
  };
}

/**
 * @typedef {Object} ActionResult
 * @property {boolean} ok - Whether the action succeeded
 * @property {string} actionId - ID of the action that was executed
 * @property {string} type - Action type identifier
 * @property {string} label - Human-readable label
 * @property {*} result - Result data from the action
 * @property {string} timestamp - ISO 8601 timestamp
 */

/**
 * Creates an ActionResult object.
 * @param {Partial<ActionResult>} [overrides={}] - Fields to override defaults
 * @returns {ActionResult}
 */
function createActionResult(overrides = {}) {
  return {
    ok: overrides.ok !== undefined ? overrides.ok : true,
    actionId: overrides.actionId || '',
    type: overrides.type || '',
    label: overrides.label || '',
    result: overrides.result !== undefined ? overrides.result : null,
    timestamp: overrides.timestamp || new Date().toISOString(),
    ...overrides
  };
}

/**
 * @typedef {Object} AssistantResponse
 * @property {string} message - Natural language response message
 * @property {ProposedAction[]} proposedActions - List of proposed actions
 * @property {boolean} requiresConfirmation - Whether any action needs confirmation
 * @property {Object|null} context - Additional context data
 * @property {'advice'|'safe_action'|'needs_confirmation'} actionType - Response category
 */

/**
 * Creates an AssistantResponse object.
 * @param {Partial<AssistantResponse>} [overrides={}] - Fields to override defaults
 * @returns {AssistantResponse}
 */
function createAssistantResponse(overrides = {}) {
  return {
    message: overrides.message || '',
    proposedActions: overrides.proposedActions || [],
    requiresConfirmation: overrides.requiresConfirmation || false,
    context: overrides.context || null,
    actionType: overrides.actionType || 'advice',
    ...overrides
  };
}

/**
 * @typedef {Object} BridgeResultMeta
 * @property {string} bridgeType - Type of bridge used
 * @property {string} requestId - Unique request identifier
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {boolean} dryRun - Whether this was a dry run
 */

/**
 * @typedef {Object} BridgeResult
 * @property {boolean} ok - Whether the operation succeeded
 * @property {*} data - Result data
 * @property {string[]} warnings - Warning messages
 * @property {string[]} errors - Error messages
 * @property {BridgeResultMeta} meta - Metadata about the request
 */

/**
 * Creates a BridgeResult object.
 * @param {Partial<BridgeResult>} [overrides={}] - Fields to override defaults
 * @returns {BridgeResult}
 */
function createBridgeResult(overrides = {}) {
  return {
    ok: overrides.ok !== undefined ? overrides.ok : true,
    data: overrides.data !== undefined ? overrides.data : null,
    warnings: overrides.warnings || [],
    errors: overrides.errors || [],
    meta: {
      bridgeType: (overrides.meta && overrides.meta.bridgeType) || '',
      requestId: (overrides.meta && overrides.meta.requestId) || uuidv4(),
      timestamp: (overrides.meta && overrides.meta.timestamp) || new Date().toISOString(),
      dryRun: (overrides.meta && overrides.meta.dryRun) || false,
      ...(overrides.meta || {})
    },
    ...overrides,
    meta: {
      bridgeType: (overrides.meta && overrides.meta.bridgeType) || '',
      requestId: (overrides.meta && overrides.meta.requestId) || uuidv4(),
      timestamp: (overrides.meta && overrides.meta.timestamp) || new Date().toISOString(),
      dryRun: (overrides.meta && overrides.meta.dryRun) || false,
      ...(overrides.meta || {})
    }
  };
}

/**
 * @typedef {Object} TroubleshootingStep
 * @property {string} label - Step description
 * @property {'pending'|'pass'|'fail'|'warning'} status - Step status
 * @property {string} detail - Additional detail
 */

/**
 * @typedef {Object} TroubleshootingChecklist
 * @property {string} issue - Description of the issue being diagnosed
 * @property {TroubleshootingStep[]} steps - Checklist steps
 */

/**
 * Creates a TroubleshootingChecklist object.
 * @param {Partial<TroubleshootingChecklist>} [overrides={}] - Fields to override defaults
 * @returns {TroubleshootingChecklist}
 */
function createTroubleshootingChecklist(overrides = {}) {
  return {
    issue: overrides.issue || '',
    steps: overrides.steps || [],
    ...overrides
  };
}

/**
 * @typedef {Object} WorkflowResult
 * @property {string} workflow - Workflow identifier
 * @property {string} summary - Human-readable summary of what was done
 * @property {boolean} requiresConfirmation - Whether confirmation is needed to proceed
 * @property {ProposedAction[]} proposedActions - Actions to execute
 * @property {string[]|null} checklist - Optional checklist of steps
 * @property {string|null} expectedOutcome - Description of expected outcome
 */

/**
 * Creates a WorkflowResult object.
 * @param {Partial<WorkflowResult>} [overrides={}] - Fields to override defaults
 * @returns {WorkflowResult}
 */
function createWorkflowResult(overrides = {}) {
  return {
    workflow: overrides.workflow || '',
    summary: overrides.summary || '',
    requiresConfirmation: overrides.requiresConfirmation || false,
    proposedActions: overrides.proposedActions || [],
    checklist: overrides.checklist || null,
    expectedOutcome: overrides.expectedOutcome || null,
    ...overrides
  };
}

module.exports = {
  createTrackSummary,
  createProjectSummary,
  createProposedAction,
  createActionResult,
  createAssistantResponse,
  createBridgeResult,
  createTroubleshootingChecklist,
  createWorkflowResult
};
