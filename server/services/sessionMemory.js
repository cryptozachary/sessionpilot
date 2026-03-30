const { randomUUID } = require('crypto');

function simplifyTrack(track) {
  if (!track || typeof track !== 'object') return null;
  return {
    id: track.id || null,
    index: track.index,
    name: track.name || '',
    isSelected: Boolean(track.isSelected)
  };
}

function truncateText(value, maxLength = 220) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3)}...`;
}

function cloneValue(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function derivePlanFromResponse(response = {}) {
  const context = response.context || {};
  const plannerPlan = context.plannerPlan;

  if (plannerPlan && (plannerPlan.kind === 'workflow' || plannerPlan.kind === 'direct_action')) {
    return {
      kind: plannerPlan.kind,
      workflow: plannerPlan.workflow || null,
      actionType: plannerPlan.actionType || null,
      args: cloneValue(plannerPlan.args || {}),
      requiresConfirmation: Boolean(response.requiresConfirmation || plannerPlan.requiresConfirmation),
      source: context.route || 'planner',
      sectionRef: cloneValue(plannerPlan.metadata && plannerPlan.metadata.sectionRef)
    };
  }

  if (context.workflow) {
    return {
      kind: 'workflow',
      workflow: context.workflow,
      actionType: null,
      args: cloneValue(context.args || {}),
      requiresConfirmation: Boolean(response.requiresConfirmation),
      source: context.route || 'rule_based',
      sectionRef: cloneValue(context.sectionRef || null)
    };
  }

  if (context.actionType) {
    return {
      kind: 'direct_action',
      workflow: null,
      actionType: context.actionType,
      args: cloneValue(context.args || {}),
      requiresConfirmation: Boolean(response.requiresConfirmation),
      source: context.route || 'rule_based',
      sectionRef: cloneValue(context.sectionRef || null)
    };
  }

  return null;
}

class SessionMemoryStore {
  constructor() {
    this.sessions = new Map();
    this.maxSessions = 100;
    this.maxTurns = 12;
    this.ttlMs = 6 * 60 * 60 * 1000;
  }

  createSessionId() {
    return randomUUID();
  }

  getSnapshot(sessionId) {
    const session = this._ensureSession(sessionId);
    return {
      sessionId,
      updatedAt: session.updatedAt,
      recentTurns: session.recentTurns.map((turn) => ({ ...turn })),
      lastIntent: session.lastIntent || null,
      lastPlan: session.lastPlan ? cloneValue(session.lastPlan) : null,
      lastTrack: session.lastTrack ? { ...session.lastTrack } : null,
      lastSection: session.lastSection ? cloneValue(session.lastSection) : null,
      intake: session.intake ? cloneValue(session.intake) : null
    };
  }

  getIntake(sessionId) {
    const session = this._ensureSession(sessionId);
    return session.intake ? cloneValue(session.intake) : null;
  }

  updateIntake(sessionId, intakeState) {
    const session = this._ensureSession(sessionId);
    session.intake = cloneValue(intakeState);
    session.updatedAt = new Date().toISOString();
  }

  rememberTurn(sessionId, payload = {}) {
    const session = this._ensureSession(sessionId);
    const now = new Date().toISOString();
    const response = payload.response || {};
    const responseContext = response.context || {};
    const lastPlan = derivePlanFromResponse(response);
    const selectedTrack = simplifyTrack(payload.contextSnapshot && payload.contextSnapshot.selectedTrack);

    session.recentTurns.unshift({
      timestamp: now,
      user: truncateText(payload.message || ''),
      assistant: truncateText(response.message || ''),
      route: responseContext.route || 'unknown'
    });
    session.recentTurns = session.recentTurns.slice(0, this.maxTurns);

    if (responseContext.intent) {
      session.lastIntent = responseContext.intent;
    }

    if (selectedTrack) {
      session.lastTrack = selectedTrack;
    }

    if (lastPlan) {
      session.lastPlan = lastPlan;
      if (lastPlan.sectionRef) {
        session.lastSection = cloneValue(lastPlan.sectionRef);
      }
    }

    session.updatedAt = now;
    this._prune();
  }

  _ensureSession(sessionId) {
    this._prune();

    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        recentTurns: [],
        lastIntent: null,
        lastPlan: null,
        lastTrack: null,
        lastSection: null,
        intake: null,
        updatedAt: new Date().toISOString()
      });
    }

    return this.sessions.get(sessionId);
  }

  _prune() {
    const now = Date.now();

    for (const [sessionId, session] of this.sessions.entries()) {
      const updatedAt = new Date(session.updatedAt).getTime();
      if (!updatedAt || now - updatedAt > this.ttlMs) {
        this.sessions.delete(sessionId);
      }
    }

    if (this.sessions.size <= this.maxSessions) {
      return;
    }

    const ordered = Array.from(this.sessions.entries()).sort((a, b) => {
      return new Date(a[1].updatedAt).getTime() - new Date(b[1].updatedAt).getTime();
    });

    while (ordered.length > this.maxSessions) {
      const [sessionId] = ordered.shift();
      this.sessions.delete(sessionId);
    }
  }
}

module.exports = new SessionMemoryStore();
