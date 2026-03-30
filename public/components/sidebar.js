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

    const typeIcons = { midi: 'M', instrument: 'I', folder: 'F' };
    container.innerHTML = `
      <div class="panel-header">TRACKS (${tracks.length})</div>
      <div class="track-list-items">
        ${tracks.map((track, i) => {
          const isSelected = track.index === selectedIdx || i === selectedIdx;
          const color = track.color || '#555';
          const ttype = track.trackType || 'audio';
          const typeIcon = typeIcons[ttype]
            ? `<span class="track-type-icon ${ttype}" title="${ttype}">${typeIcons[ttype]}</span>`
            : '';
          return `
            <div class="track-row ${isSelected ? 'selected' : ''}" data-track-index="${track.index != null ? track.index : i}">
              <div class="track-color-bar" style="background: ${color}"></div>
              ${typeIcon}
              <span class="track-name">${escapeHtml(track.name || `Track ${i + 1}`)}</span>
              <div class="track-meter" data-track-index="${track.index != null ? track.index : i}">
                <div class="track-meter-bar left" style="width: 0%"></div>
                <div class="track-meter-bar right" style="width: 0%"></div>
              </div>
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

  function renderHealthWarnings(warnings) {
    const container = document.getElementById('health-warnings-bar');
    if (!container) return;

    if (!warnings || warnings.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = warnings.map(w => `
      <div class="health-warning health-warning--${w.severity}" title="${escapeHtml(w.detail || '')}">
        <span class="health-warning-icon">${w.severity === 'error' ? '!' : w.severity === 'warning' ? '⚠' : 'i'}</span>
        <span class="health-warning-text">${escapeHtml(w.message)}</span>
      </div>
    `).join('');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function updatePeakMeters(data) {
    if (!data || !data.peaks) return;
    data.peaks.forEach(p => {
      const meterEl = document.querySelector(`.track-meter[data-track-index="${p.trackIndex}"]`);
      if (!meterEl) return;
      const leftBar = meterEl.querySelector('.left');
      const rightBar = meterEl.querySelector('.right');
      if (leftBar) leftBar.style.width = `${Math.min(p.peakL * 100, 100)}%`;
      if (rightBar) rightBar.style.width = `${Math.min(p.peakR * 100, 100)}%`;
    });
  }

  function init() {
    State().on('session', renderSessionSummary);
    State().on('tracks', renderTrackList);
    State().on('selectedTrack', () => {
      // Re-render track list to update selection highlight
      renderTrackList(State().get('tracks'));
    });
    State().on('peakUpdate', updatePeakMeters);
    State().on('healthWarnings', renderHealthWarnings);

    // Render initial state
    renderSessionSummary(State().get('session'));
    renderTrackList(State().get('tracks'));
    renderHealthWarnings(State().get('healthWarnings'));
  }

  return { init };
})();
