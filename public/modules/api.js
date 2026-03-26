window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.API = (() => {
  const BASE = ''; // same origin

  async function request(method, path, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(BASE + path, opts);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${method} ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  return {
    // Session & project data
    getSession:          () => request('GET', '/api/session'),
    getTracks:           () => request('GET', '/api/tracks'),
    getSelectedTrack:    () => request('GET', '/api/selected-track'),
    getConnectionStatus: () => request('GET', '/api/connection-status'),
    getMarkers:          () => request('GET', '/api/markers'),
    getTransport:        () => request('GET', '/api/transport'),
    getTemplates:        () => request('GET', '/api/templates'),
    getFxChains:         () => request('GET', '/api/fx-chains'),
    getWorkflows:        () => request('GET', '/api/workflows'),
    getHealth:     () => request('GET', '/api/health'),
    getActionLog: (limit = 50) => request('GET', `/api/action-log?limit=${limit}`),

    // Chat
    sendChat: (message, metadata = {}) => request('POST', '/api/chat', { message, ...metadata }),

    // Actions
    executeAction: (payload) => request('POST', '/api/actions/execute', payload),
    previewAction: (workflow, args) => request('POST', '/api/actions/preview', { workflow, args })
  };
})();
