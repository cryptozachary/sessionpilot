window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.ModeToggle = (() => {
  const API = () => window.SessionPilot.API;

  let mode = 'default';

  function render() {
    const btn = document.getElementById('mode-toggle');
    if (!btn) return;
    btn.textContent = mode === 'ai' ? 'Mode: AI Engineer' : 'Mode: Default';
    btn.classList.toggle('mode-ai', mode === 'ai');
  }

  async function setMode(next) {
    const btn = document.getElementById('mode-toggle');
    try {
      if (btn) btn.disabled = true;
      const res = await API().setAssistantMode(next);
      if (res.ok) {
        mode = res.data.mode;
        render();
      }
    } catch (e) {
      console.error('Failed to set assistant mode:', e);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function loadMode() {
    try {
      const res = await API().getAssistantMode();
      if (res.ok) {
        mode = res.data.mode;
        render();
      }
    } catch (e) {
      console.error('Failed to load assistant mode:', e);
    }
  }

  function init() {
    const btn = document.getElementById('mode-toggle');
    if (!btn) return;

    btn.addEventListener('click', () => {
      setMode(mode === 'ai' ? 'default' : 'ai');
    });

    render();
    loadMode();
  }

  return { init };
})();
