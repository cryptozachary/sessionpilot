window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.State = (() => {
  const state = {
    session: null,
    tracks: [],
    selectedTrack: null,
    connection: { connected: false, bridgeType: 'unknown' },
    voice: {
      supported: false,
      enabled: false,
      listening: false,
      speaking: false,
      transcript: '',
      error: '',
      speakReplies: true
    },
    chatMessages: [],
    actionLog: [],
    pendingActions: [],
    workflows: []
  };

  const listeners = {};

  function get(key) {
    return key ? state[key] : { ...state };
  }

  function set(key, value) {
    state[key] = value;
    emit(key, value);
  }

  function on(key, fn) {
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(fn);
  }

  function off(key, fn) {
    if (listeners[key]) {
      listeners[key] = listeners[key].filter(f => f !== fn);
    }
  }

  function emit(key, value) {
    (listeners[key] || []).forEach(fn => fn(value));
    (listeners['*'] || []).forEach(fn => fn(key, value));
  }

  /**
   * Convenience: add a chat message to state and notify listeners.
   */
  function addChatMessage(role, content, extra = {}) {
    const msg = {
      role,
      content,
      timestamp: new Date().toISOString(),
      ...extra
    };
    state.chatMessages.push(msg);
    emit('chatMessages', state.chatMessages);
    return msg;
  }

  /**
   * Convenience: add an entry to the action log.
   */
  function addActionLogEntry(entry) {
    state.actionLog.unshift({
      timestamp: new Date().toISOString(),
      ...entry
    });
    // Keep log to a reasonable size
    if (state.actionLog.length > 100) {
      state.actionLog = state.actionLog.slice(0, 100);
    }
    emit('actionLog', state.actionLog);
  }

  return { get, set, on, off, emit, addChatMessage, addActionLogEntry };
})();
