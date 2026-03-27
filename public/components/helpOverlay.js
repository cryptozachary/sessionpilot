window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.HelpOverlay = (() => {
  let overlayEl = null;

  const VOICE_COMMANDS = [
    { category: 'Transport', commands: [
      '"Hit play" / "Play it" / "Start playback"',
      '"Stop" / "Hit stop"',
      '"Pause" / "Hit pause"',
      '"Hit record" / "Roll tape" / "Let\'s record"',
      '"Go to start" / "From the top"',
      '"Go to bar 16" / "Jump to bar 8"'
    ]},
    { category: 'Track Control', commands: [
      '"Arm [track name]" / "Disarm"',
      '"Mute [track]" / "Unmute [track]"',
      '"Solo [track]" / "Unsolo [track]"',
      '"Monitor on" / "Monitor off"',
      '"Select lead vocal"',
      '"Duplicate [track]"',
      '"Rename [track] to [name]"'
    ]},
    { category: 'Volume & Pan', commands: [
      '"Volume up" / "Louder" / "Turn up"',
      '"Volume down" / "Quieter" / "Softer"',
      '"Volume 80%" / "Volume 50%"',
      '"Pan left" / "Pan right" / "Pan center"',
      '"Pan 50% left"'
    ]},
    { category: 'Workflows', commands: [
      '"Set up to record vocals" / "Vocal setup"',
      '"Vocal stack" / "Doubles and adlibs"',
      '"Punch loop bars 8 to 16"',
      '"Punch in bars 4 to 12"',
      '"Rough mix" / "Quick mix"',
      '"Comp takes" / "Review takes"',
      '"Cue mix" / "Headphone mix"',
      '"Preflight check" / "Ready to record"',
      '"Color code vocals" / "Organize tracks"'
    ]},
    { category: 'Navigation', commands: [
      '"Go to chorus" / "Go to verse 2"',
      '"Go to [marker name]"'
    ]},
    { category: 'Markers & Notes', commands: [
      '"Drop a marker" / "Add marker [name]"',
      '"Create track [name]"'
    ]}
  ];

  const KEYBOARD_SHORTCUTS = [
    { key: 'Space', action: 'Play / Pause toggle' },
    { key: 'Escape', action: 'Stop transport' },
    { key: 'R', action: 'Toggle recording' },
    { key: 'Home', action: 'Go to start' },
    { key: 'End', action: 'Go to end' }
  ];

  function createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'help-overlay';
    overlay.className = 'modal-overlay hidden';
    overlay.innerHTML = `
      <div class="help-modal">
        <div class="help-modal-header">
          <h3>SessionPilot Commands</h3>
          <button class="help-close-btn" title="Close">&times;</button>
        </div>
        <div class="help-modal-body">
          <div class="help-section">
            <h4>Keyboard Shortcuts</h4>
            <div class="help-shortcuts-grid">
              ${KEYBOARD_SHORTCUTS.map(s => `
                <div class="help-shortcut">
                  <kbd>${s.key}</kbd>
                  <span>${s.action}</span>
                </div>
              `).join('')}
            </div>
            <p class="help-note">Keyboard shortcuts are active when the chat input is not focused.</p>
          </div>
          ${VOICE_COMMANDS.map(cat => `
            <div class="help-section">
              <h4>${cat.category}</h4>
              <ul class="help-command-list">
                ${cat.commands.map(cmd => `<li>${cmd}</li>`).join('')}
              </ul>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hide();
    });
    overlay.querySelector('.help-close-btn').addEventListener('click', hide);

    document.body.appendChild(overlay);
    return overlay;
  }

  function show() {
    if (!overlayEl) overlayEl = createOverlay();
    overlayEl.classList.remove('hidden');
  }

  function hide() {
    if (overlayEl) overlayEl.classList.add('hidden');
  }

  function toggle() {
    if (!overlayEl || overlayEl.classList.contains('hidden')) {
      show();
    } else {
      hide();
    }
  }

  function init() {
    // Listen for ? key when not focused on input
    document.addEventListener('keydown', (e) => {
      const el = document.activeElement;
      const isInput = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape' && overlayEl && !overlayEl.classList.contains('hidden')) {
        hide();
      }
    });
  }

  return { init, show, hide, toggle };
})();
