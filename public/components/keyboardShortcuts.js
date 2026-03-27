window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.KeyboardShortcuts = (() => {
  const State = () => window.SessionPilot.State;
  const API = () => window.SessionPilot.API;

  const SHORTCUTS = [
    { key: ' ',       label: 'Space',  description: 'Play / Pause toggle' },
    { key: 'Escape',  label: 'Esc',    description: 'Stop transport' },
    { key: 'r',       label: 'R',      description: 'Toggle recording' },
    { key: 'Home',    label: 'Home',   description: 'Go to start' },
    { key: 'End',     label: 'End',    description: 'Go to end' }
  ];

  function isInputFocused() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function getTransportState() {
    const session = State().get('session');
    return (session && session.transportState) || 'stopped';
  }

  async function executeTransport(actionType) {
    try {
      const result = await API().executeAction({ actionType, args: {}, confirmed: true });
      if (result.ok !== false) {
        State().addActionLogEntry({ label: actionType, status: 'success', type: 'execution' });
        if (window.SessionPilot.WS) window.SessionPilot.WS.refresh();
      }
    } catch (e) {
      console.error('Keyboard shortcut failed:', e);
    }
  }

  function handleKeydown(e) {
    if (isInputFocused()) return;

    // Don't intercept modified keys (Ctrl+S, etc.)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const state = getTransportState();

    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (state === 'playing') {
          executeTransport('pause');
        } else {
          executeTransport('play');
        }
        break;

      case 'Escape':
        e.preventDefault();
        executeTransport('stop');
        break;

      case 'r':
        e.preventDefault();
        if (state === 'recording') {
          executeTransport('stop');
        } else {
          executeTransport('record');
        }
        break;

      case 'Home':
        e.preventDefault();
        executeTransport('goToStart');
        break;

      case 'End':
        e.preventDefault();
        executeTransport('goToEnd');
        break;

      default:
        return;
    }
  }

  function init() {
    document.addEventListener('keydown', handleKeydown);
  }

  function getShortcuts() {
    return SHORTCUTS;
  }

  return { init, getShortcuts };
})();
