window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.TrackPanel = (() => {
  const State = () => window.SessionPilot.State;

  function render(track) {
    const container = document.getElementById('selected-track-panel');
    if (!container) return;

    if (!track) {
      container.innerHTML = `
        <div class="panel-header">SELECTED TRACK</div>
        <div class="no-track-selected">No track selected<br><span class="text-muted" style="font-size:11px;">Click a track in the sidebar</span></div>
      `;
      return;
    }

    const color = track.color || '#555';
    const fxList = track.fxChain || track.fx || [];
    const inputLabel = track.input || track.inputLabel || 'Not set';
    const itemCount = track.itemCount != null ? track.itemCount : '---';

    // Build status badges
    const badges = [];
    badges.push(track.armed
      ? '<span class="track-badge armed">Armed</span>'
      : '<span class="track-badge not-armed">Not Armed</span>');
    badges.push(track.monitoring
      ? '<span class="track-badge monitoring-on">Monitor On</span>'
      : '<span class="track-badge monitoring-off">Monitor Off</span>');
    if (track.muted) {
      badges.push('<span class="track-badge muted-on">Muted</span>');
    }
    if (track.solo) {
      badges.push('<span class="track-badge solo-on">Solo</span>');
    }

    container.innerHTML = `
      <div class="panel-header">SELECTED TRACK</div>
      <div class="selected-track-content">
        <div class="track-detail-header">
          <div class="track-color-swatch" style="background: ${color}"></div>
          <div class="track-detail-name">${escapeHtml(track.name || 'Unnamed Track')}</div>
        </div>

        <div class="track-detail-badges">
          ${badges.join('')}
        </div>

        <div class="track-detail-info">
          <div class="track-detail-row">
            <span class="track-detail-label">Input</span>
            <span class="track-detail-value">${escapeHtml(inputLabel)}</span>
          </div>
          <div class="track-detail-row">
            <span class="track-detail-label">Items</span>
            <span class="track-detail-value">${itemCount}</span>
          </div>
          <div class="track-detail-row">
            <span class="track-detail-label">Volume</span>
            <span class="track-detail-value">${track.volume != null ? track.volume.toFixed(1) + ' dB' : '0.0 dB'}</span>
          </div>
          <div class="track-detail-row">
            <span class="track-detail-label">Pan</span>
            <span class="track-detail-value">${formatPan(track.pan)}</span>
          </div>
        </div>

        ${fxList.length > 0 ? `
          <div class="track-fx-list">
            <div class="track-detail-label" style="margin-bottom:4px;">FX Chain (${fxList.length})</div>
            ${fxList.map(fx => `
              <div class="track-fx-item">${escapeHtml(typeof fx === 'string' ? fx : fx.name || 'Unknown FX')}</div>
            `).join('')}
          </div>
        ` : `
          <div class="track-fx-list">
            <div class="track-detail-label" style="margin-bottom:4px;">FX Chain</div>
            <div class="track-fx-item text-muted">No FX</div>
          </div>
        `}
      </div>
    `;
  }

  function formatPan(pan) {
    if (pan == null || pan === 0) return 'Center';
    if (pan < 0) return `${Math.abs(Math.round(pan * 100))}% L`;
    return `${Math.round(pan * 100)}% R`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function init() {
    State().on('selectedTrack', render);
    render(State().get('selectedTrack'));
  }

  return { init, render };
})();
