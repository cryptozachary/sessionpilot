window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.State = (() => {
  const STORAGE_KEY = 'sessionpilot_state';
  const PERSISTED_KEYS = ['chatMessages', 'actionLog'];
  const MAX_CHAT_PERSIST = 50;
  const MAX_LOG_PERSIST = 30;

  function loadPersistedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  }

  function persistState() {
    try {
      const toSave = {
        chatMessages: state.chatMessages.slice(-MAX_CHAT_PERSIST),
        actionLog: state.actionLog.slice(0, MAX_LOG_PERSIST),
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      // localStorage full or unavailable — silently skip
    }
  }

  const persisted = loadPersistedState();

  const state = {
    session: null,
    tracks: [],
    selectedTrack: null,
    connection: { connected: false, bridgeType: 'unknown' },
    wsStale: false,
    voice: {
      supported: false,
      enabled: false,
      listening: false,
      speaking: false,
      transcript: '',
      error: '',
      speakReplies: true
    },
    chatMessages: Array.isArray(persisted.chatMessages) ? persisted.chatMessages : [],
    actionLog: Array.isArray(persisted.actionLog) ? persisted.actionLog : [],
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
    if (PERSISTED_KEYS.includes(key)) persistState();
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
    persistState();
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
    persistState();
  }

  /**
   * Clear persisted state (e.g. for a new session).
   */
  function clearPersisted() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  return { get, set, on, off, emit, addChatMessage, addActionLogEntry, clearPersisted };
})();
