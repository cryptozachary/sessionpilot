const {
  createAssistantResponse,
  createProposedAction
} = require('../models');
const aiOrchestrator = require('./aiOrchestrator');
const workflowService = require('./workflowService');
const sessionMemory = require('./sessionMemory');
const { buildSessionContext } = require('./contextBuilder');
const planner = require('./llmPlanner');

function shouldAugmentWithPlanner(matchedIntent, extractedArgs) {
  if (!matchedIntent) {
    return true;
  }

  if (matchedIntent.intent === 'quick_punch_loop' || matchedIntent.intent === 'prepare_punch_in') {
    return !Number.isFinite(extractedArgs.startBar) || !Number.isFinite(extractedArgs.endBar);
  }

  return false;
}

function buildFallbackResponse() {
  return createAssistantResponse({
    message: aiOrchestrator.DEFAULT_FALLBACK_MESSAGE,
    proposedActions: [],
    requiresConfirmation: false,
    actionType: 'advice',
    context: {
      route: 'fallback',
      intent: null
    }
  });
}

function buildContextAwareFallback(contextSnapshot) {
  const suggestions = [];
  const connection = contextSnapshot.connection || {};
  const tracks = contextSnapshot.tracks || [];
  const selectedTrack = contextSnapshot.selectedTrack;
  const sections = contextSnapshot.sections || [];

  if (!connection.connected) {
    return createAssistantResponse({
      message: "It looks like REAPER isn't connected yet. Make sure REAPER is running with the bridge script active, then try again. In the meantime, I can answer general questions about session setup.",
      proposedActions: [],
      requiresConfirmation: false,
      actionType: 'advice',
      context: { route: 'context_fallback', intent: null }
    });
  }

  if (tracks.length === 0) {
    suggestions.push('Your session has no tracks yet. I can **create a vocal track** to get started.');
  } else if (!selectedTrack) {
    suggestions.push(`You have ${tracks.length} tracks but none selected. Select a track in REAPER and I can help with recording, comping, or organizing.`);
  } else {
    const trackName = selectedTrack.name || 'the selected track';
    if (selectedTrack.isArmed) {
      suggestions.push(`"${trackName}" is armed and ready. I can **set up a punch-in**, **start a loop record**, or **run a preflight check**.`);
    } else {
      suggestions.push(`"${trackName}" is selected. I can **arm it for recording**, **rename it**, **set up doubles and adlibs**, or **comp its takes**.`);
    }
  }

  if (sections.length > 0) {
    suggestions.push('I see song sections marked. I can **set up a punch for a specific section** like "punch the chorus".');
  } else if (tracks.length > 0) {
    suggestions.push('No song sections marked yet. I can **mark your song structure** if you tell me where the verse, chorus, and bridge are.');
  }

  const fallbackMessage = suggestions.length > 0
    ? `I didn't quite catch that. Here's what I can help with right now:\n\n${suggestions.join('\n\n')}`
    : aiOrchestrator.DEFAULT_FALLBACK_MESSAGE;

  return createAssistantResponse({
    message: fallbackMessage,
    proposedActions: [],
    requiresConfirmation: false,
    actionType: 'advice',
    context: { route: 'context_fallback', intent: null }
  });
}

function buildDirectActionLabel(actionType, args = {}) {
  switch (actionType) {
    case 'selectTrack':
      return args.trackId ? 'Select track' : 'Select selected track';
    case 'armTrack':
      return 'Arm track';
    case 'disarmTrack':
      return 'Disarm track';
    case 'renameTrack':
      return args.name ? `Rename track to "${args.name}"` : 'Rename track';
    case 'createTrack':
      return args.name ? `Create track "${args.name}"` : 'Create track';
    case 'insertMarker':
      return args.name ? `Insert marker "${args.name}"` : 'Insert marker';
    default:
      return actionType;
  }
}

function buildDirectActionDescription(actionType, args = {}) {
  if (actionType === 'renameTrack' && args.name) {
    return `Rename the target track to "${args.name}".`;
  }
  if (actionType === 'insertMarker' && args.name) {
    return `Insert a marker named "${args.name}".`;
  }
  return `Run ${actionType}.`;
}

async function buildPlannerResponse(bridge, plan) {
  if (!plan) {
    return null;
  }

  if (plan.kind === 'workflow') {
    const preview = await workflowService.previewWorkflow(bridge, plan.workflow, plan.args || {});
    if (!preview.ok) {
      return createAssistantResponse({
        message: `I planned that, but the workflow preview failed: ${preview.error || 'unknown error'}`,
        proposedActions: [],
        requiresConfirmation: false,
        actionType: 'advice',
        context: {
          route: 'planner',
          plannerPlan: plan,
          plannerError: true
        }
      });
    }

    const workflowPreview = preview.data;
    const requiresConfirmation = Boolean(
      workflowPreview.requiresConfirmation ||
      plan.requiresConfirmation ||
      (workflowPreview.proposedActions || []).some((action) => action.requiresConfirmation)
    );

    return createAssistantResponse({
      message: plan.message || workflowPreview.summary,
      proposedActions: workflowPreview.proposedActions || [],
      requiresConfirmation,
      actionType: requiresConfirmation ? 'needs_confirmation' : 'safe_action',
      context: {
        route: 'planner',
        workflow: plan.workflow,
        args: plan.args || {},
        checklist: workflowPreview.checklist || null,
        expectedOutcome: workflowPreview.expectedOutcome || null,
        plannerPlan: plan,
        sectionRef: plan.metadata && plan.metadata.sectionRef ? plan.metadata.sectionRef : null
      }
    });
  }

  if (plan.kind === 'direct_action') {
    const proposedAction = createProposedAction({
      type: plan.actionType,
      label: plan.label || buildDirectActionLabel(plan.actionType, plan.args),
      description: plan.description || buildDirectActionDescription(plan.actionType, plan.args),
      riskLevel: plan.requiresConfirmation ? 'medium' : 'low',
      requiresConfirmation: Boolean(plan.requiresConfirmation),
      args: plan.args || {}
    });

    return createAssistantResponse({
      message: plan.message || proposedAction.label,
      proposedActions: [proposedAction],
      requiresConfirmation: Boolean(plan.requiresConfirmation),
      actionType: plan.requiresConfirmation ? 'needs_confirmation' : 'safe_action',
      context: {
        route: 'planner',
        actionType: plan.actionType,
        args: plan.args || {},
        plannerPlan: plan,
        sectionRef: plan.metadata && plan.metadata.sectionRef ? plan.metadata.sectionRef : null
      }
    });
  }

  return createAssistantResponse({
    message: plan.message || aiOrchestrator.DEFAULT_FALLBACK_MESSAGE,
    proposedActions: [],
    requiresConfirmation: false,
    actionType: 'advice',
    context: {
      route: 'planner',
      plannerPlan: plan
    }
  });
}

module.exports = {
  async processMessage(bridge, message, options = {}) {
    const sessionId = options.sessionId || 'default';
    const contextSnapshot = await buildSessionContext(bridge);
    const memorySnapshot = sessionMemory.getSnapshot(sessionId);
    const matchedIntent = aiOrchestrator.classifyIntent(message);
    const extractedArgs = matchedIntent ? aiOrchestrator.extractArgs(message, matchedIntent.intent) : {};

    let response;
    let plannerResponse = null;

    if (shouldAugmentWithPlanner(matchedIntent, extractedArgs)) {
      const plan = await planner.plan({
        message,
        context: contextSnapshot,
        memory: memorySnapshot
      });
      plannerResponse = await buildPlannerResponse(bridge, plan);
    }

    if (plannerResponse && plannerResponse.context && plannerResponse.context.route === 'planner') {
      response = plannerResponse;
    } else if (matchedIntent) {
      response = await aiOrchestrator.processMessage(bridge, message, { matchedIntent });
    } else {
      response = plannerResponse || buildContextAwareFallback(contextSnapshot);
    }

    response.context = {
      ...(response.context || {}),
      sessionId,
      sessionSummary: {
        projectName: contextSnapshot.session && contextSnapshot.session.projectName
          ? contextSnapshot.session.projectName
          : '',
        selectedTrack: contextSnapshot.selectedTrack && contextSnapshot.selectedTrack.name
          ? contextSnapshot.selectedTrack.name
          : null,
        transportState: contextSnapshot.transport && contextSnapshot.transport.state
          ? contextSnapshot.transport.state
          : (contextSnapshot.session && contextSnapshot.session.transportState) || 'stopped'
      }
    };

    sessionMemory.rememberTurn(sessionId, {
      message,
      response,
      contextSnapshot
    });

    return response;
  }
};
