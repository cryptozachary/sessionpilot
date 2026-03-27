const { listWorkflows } = require('../workflows');

const PLAN_KINDS = {
  NONE: 'none',
  WORKFLOW: 'workflow',
  DIRECT_ACTION: 'direct_action',
  CLARIFICATION: 'clarification',
  ADVICE: 'advice'
};

const DIRECT_ACTION_TYPES = new Set([
  'createTrack',
  'renameTrack',
  'setTrackColor',
  'selectTrack',
  'armTrack',
  'disarmTrack',
  'toggleMonitoring',
  'muteTrack',
  'soloTrack',
  'duplicateTrack',
  'createFolderTrack',
  'insertMarker',
  'createRegion',
  'loadTrackTemplate',
  'loadFxChain',
  'play',
  'stop',
  'pause',
  'record',
  'goToPosition',
  'goToStart',
  'goToEnd',
  'goToMarker',
  'setTrackVolume',
  'setTrackPan',
  'undo',
  'redo',
  'getTrackFx',
  'removeFx',
  'toggleFxBypass',
  'renderProject',
  'renderStems'
]);

const KNOWN_WORKFLOWS = new Set(listWorkflows().map((workflow) => workflow.name));

function normalizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value;
}

function normalizePlan(plan = {}) {
  return {
    kind: typeof plan.kind === 'string' ? plan.kind : PLAN_KINDS.NONE,
    workflow: typeof plan.workflow === 'string' ? plan.workflow : '',
    actionType: typeof plan.actionType === 'string' ? plan.actionType : '',
    args: normalizeObject(plan.args),
    message: typeof plan.message === 'string' ? plan.message.trim() : '',
    label: typeof plan.label === 'string' ? plan.label.trim() : '',
    description: typeof plan.description === 'string' ? plan.description.trim() : '',
    confidence: Number.isFinite(plan.confidence) ? plan.confidence : 0.5,
    requiresConfirmation: Boolean(plan.requiresConfirmation),
    metadata: normalizeObject(plan.metadata)
  };
}

function validatePlan(plan) {
  const normalized = normalizePlan(plan);
  const errors = [];

  if (!Object.values(PLAN_KINDS).includes(normalized.kind)) {
    errors.push(`Unknown plan kind: ${normalized.kind}`);
  }

  if (normalized.kind === PLAN_KINDS.WORKFLOW && !KNOWN_WORKFLOWS.has(normalized.workflow)) {
    errors.push(`Unknown workflow: ${normalized.workflow}`);
  }

  if (normalized.kind === PLAN_KINDS.DIRECT_ACTION && !DIRECT_ACTION_TYPES.has(normalized.actionType)) {
    errors.push(`Unknown direct action type: ${normalized.actionType}`);
  }

  if (
    (normalized.kind === PLAN_KINDS.CLARIFICATION || normalized.kind === PLAN_KINDS.ADVICE) &&
    !normalized.message
  ) {
    errors.push(`Plan kind "${normalized.kind}" requires a message`);
  }

  return {
    ok: errors.length === 0,
    data: normalized,
    errors
  };
}

module.exports = {
  PLAN_KINDS,
  DIRECT_ACTION_TYPES,
  validatePlan
};
