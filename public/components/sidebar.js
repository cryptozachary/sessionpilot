window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.Sidebar = (() => {
  const State = () => window.SessionPilot.State;

  function renderSessionSummary(session) {
    const container = document.getElementById('session-summary');
    if (!container) return;

    if (!session) {
      container.innerHTML = `
        <div class="panel-header">SESSION</div>
        <div class="session-summary-grid">
          <div class="session-stat">
            <div class="session-stat-label">Status</div>
            <div class="session-stat-value text-muted">No session</div>
          </div>
        </div>
      `;
      return;
    }

    const stats = [
      { label: 'Project', value: session.projectName || 'Untitled' },
      { label: 'BPM', value: session.bpm || '---' },
      { label: 'Sample Rate', value: session.sampleRate ? `${(session.sampleRate / 1000).toFixed(1)}k` : '---' },
      { label: 'Tracks', value: session.trackCount != null ? session.trackCount : '---' },
      { label: 'Markers', value: session.markerCount != null ? session.markerCount : '---' },
      { label: 'Transport', value: session.transportState || 'stopped' }
    ];

    container.innerHTML = `
      <div class="panel-header">SESSION</div>
      <div class="session-summary-grid">
        ${stats.map(s => `
          <div class="session-stat">
            <div class="session-stat-label">${s.label}</div>
            <div class="session-stat-value">${s.value}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderTrackList(tracks) {
    const container = document.getElementById('track-list');
    if (!container) return;

    const selectedTrack = State().get('selectedTrack');
    const selectedIdx = selectedTrack ? selectedTrack.index : -1;

    if (!tracks || tracks.length === 0) {
      container.innerHTML = `
        <div class="panel-header">TRACKS</div>
        <div class="no-track-selected">No tracks in session</div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="panel-header">TRACKS (${tracks.length})</div>
      <div class="track-list-items">
        ${tracks.map((track, i) => {
          const isSelected = track.index === selectedIdx || i === selectedIdx;
          const color = track.color || '#555';
          return `
            <div class="track-row ${isSelected ? 'selected' : ''}" data-track-index="${track.index != null ? track.index : i}">
              <div class="track-color-bar" style="background: ${color}"></div>
              <span class="track-name">${escapeHtml(track.name || `Track ${i + 1}`)}</span>
              <div class="track-status-dots">
                <span class="track-dot armed ${track.armed ? 'visible' : ''}" title="Armed"></span>
                <span class="track-dot monitoring ${track.monitoring ? 'visible' : ''}" title="Monitoring"></span>
                <span class="track-dot muted ${track.muted ? 'visible' : ''}" title="Muted"></span>
                <span class="track-dot solo ${track.solo ? 'visible' : ''}" title="Solo"></span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Click handlers for track selection
    container.querySelectorAll('.track-row').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt(row.dataset.trackIndex, 10);
        const track = tracks.find(t => (t.index != null ? t.index : tracks.indexOf(t)) === idx);
        if (track) {
          State().set('selectedTrack', track);
          renderTrackList(tracks); // re-render to update highlight
        }
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function init() {
    State().on('session', renderSessionSummary);
    State().on('tracks', renderTrackList);
    State().on('selectedTrack', () => {
      // Re-render track list to update selection highlight
      renderTrackList(State().get('tracks'));
    });

    // Render initial state
    renderSessionSummary(State().get('session'));
    renderTrackList(State().get('tracks'));
  }

  return { init };
})();
