window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.TrackPanel = (() => {
  const State = () => window.SessionPilot.State;
  const API = () => window.SessionPilot.API;

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
    const trackType = track.trackType || 'audio';

    // Build status badges
    const badges = [];
    if (trackType !== 'audio') {
      badges.push(`<span class="track-badge track-type-badge">${trackType}</span>`);
    }
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

    // Extra info rows for MIDI/instrument
    let extraRows = '';
    if (track.midiInput) {
      extraRows += `<div class="track-detail-row"><span class="track-detail-label">MIDI Input</span><span class="track-detail-value">${escapeHtml(track.midiInput)}</span></div>`;
    }
    if (track.instrumentPlugin) {
      extraRows += `<div class="track-detail-row"><span class="track-detail-label">Instrument</span><span class="track-detail-value">${escapeHtml(track.instrumentPlugin)}</span></div>`;
    }

    container.innerHTML = `
      <div class="panel-header">SELECTED TRACK</div>
      <div class="selected-track-content">
        <div class="track-detail-header">
          <div class="track-color-swatch" style="background: ${color}"></div>
          <div class="track-detail-name">${escapeHtml(track.name || 'Unnamed Track')}</div>
        </div>

        <div class="track-panel-meter" id="selected-track-meter">
          <div class="meter-channel"><div class="meter-fill left-fill"></div></div>
          <div class="meter-channel"><div class="meter-fill right-fill"></div></div>
        </div>

        <div class="track-detail-badges">
          ${badges.join('')}
        </div>

        <div class="track-detail-info">
          <div class="track-detail-row">
            <span class="track-detail-label">Input</span>
            <span class="track-detail-value">${escapeHtml(inputLabel)}</span>
          </div>
          ${extraRows}
          <div class="track-detail-row">
            <span class="track-detail-label">Items</span>
            <span class="track-detail-value">${itemCount}</span>
          </div>
          <div class="track-detail-row track-slider-row">
            <span class="track-detail-label">Volume</span>
            <input type="range" class="track-slider track-volume-slider" min="0" max="200" value="${Math.round((track.volume != null ? track.volume : 1.0) * 100)}" data-track-id="${track.id}">
            <span class="track-slider-value">${Math.round((track.volume != null ? track.volume : 1.0) * 100)}%</span>
          </div>
          <div class="track-detail-row track-slider-row">
            <span class="track-detail-label">Pan</span>
            <input type="range" class="track-slider track-pan-slider" min="-100" max="100" value="${Math.round((track.pan || 0) * 100)}" data-track-id="${track.id}">
            <span class="track-slider-value">${formatPan(track.pan)}</span>
          </div>
        </div>

        ${fxList.length > 0 ? `
          <div class="track-fx-list">
            <div class="track-detail-label" style="margin-bottom:4px;">FX Chain (${fxList.length}) <span class="text-muted" style="font-size:10px;">— click to expand</span></div>
            ${fxList.map((fx, idx) => {
              const fxName = typeof fx === 'string' ? fx : fx.name || 'Unknown FX';
              return `<div class="track-fx-item expandable" data-fx-index="${idx}" data-track-id="${track.id}">${escapeHtml(fxName)}</div>
                      <div class="fx-params-container" id="fx-params-${idx}" style="display:none;"></div>`;
            }).join('')}
          </div>
        ` : `
          <div class="track-fx-list">
            <div class="track-detail-label" style="margin-bottom:4px;">FX Chain</div>
            <div class="track-fx-item text-muted">No FX</div>
          </div>
        `}
      </div>
    `;

    // Bind volume slider
    const volSlider = container.querySelector('.track-volume-slider');
    if (volSlider) {
      let volTimeout;
      volSlider.addEventListener('input', () => {
        const val = parseInt(volSlider.value, 10);
        volSlider.nextElementSibling.textContent = val + '%';
      });
      volSlider.addEventListener('change', () => {
        clearTimeout(volTimeout);
        volTimeout = setTimeout(async () => {
          const volume = parseInt(volSlider.value, 10) / 100;
          try {
            await API().executeAction({ actionType: 'setTrackVolume', args: { trackId: volSlider.dataset.trackId, volume }, confirmed: true });
          } catch (e) { console.error('Volume change failed:', e); }
        }, 100);
      });
    }

    // Bind pan slider
    const panSlider = container.querySelector('.track-pan-slider');
    if (panSlider) {
      let panTimeout;
      panSlider.addEventListener('input', () => {
        const val = parseInt(panSlider.value, 10) / 100;
        panSlider.nextElementSibling.textContent = formatPan(val);
      });
      panSlider.addEventListener('change', () => {
        clearTimeout(panTimeout);
        panTimeout = setTimeout(async () => {
          const pan = parseInt(panSlider.value, 10) / 100;
          try {
            await API().executeAction({ actionType: 'setTrackPan', args: { trackId: panSlider.dataset.trackId, pan }, confirmed: true });
          } catch (e) { console.error('Pan change failed:', e); }
        }, 100);
      });
    }

    // Bind FX expand click handlers
    container.querySelectorAll('.track-fx-item.expandable').forEach(item => {
      item.addEventListener('click', async () => {
        const fxIdx = parseInt(item.dataset.fxIndex, 10);
        const trkId = item.dataset.trackId;
        const paramsEl = document.getElementById(`fx-params-${fxIdx}`);
        if (!paramsEl) return;

        if (paramsEl.style.display !== 'none') {
          paramsEl.style.display = 'none';
          return;
        }

        paramsEl.innerHTML = '<div class="text-muted" style="padding:4px 8px;font-size:11px;">Loading...</div>';
        paramsEl.style.display = 'block';

        try {
          const res = await fetch(`/api/tracks/${trkId}/fx/${fxIdx}/params`);
          const result = await res.json();
          if (!result.ok || !result.data || !result.data.params) {
            paramsEl.innerHTML = '<div class="text-muted" style="padding:4px 8px;font-size:11px;">No parameters</div>';
            return;
          }
          const params = result.data.params.slice(0, 12); // Show up to 12 params
          paramsEl.innerHTML = params.map(p => `
            <div class="fx-param-row">
              <span class="fx-param-name">${escapeHtml(p.name)}</span>
              <input type="range" class="fx-param-slider" min="0" max="100" value="${Math.round(p.value * 100)}"
                data-track-id="${trkId}" data-fx-index="${fxIdx}" data-param-index="${p.index}">
              <span class="fx-param-value">${escapeHtml(p.formattedValue || Math.round(p.value * 100) + '%')}</span>
            </div>
          `).join('');

          // Bind param sliders
          paramsEl.querySelectorAll('.fx-param-slider').forEach(slider => {
            let paramTimeout;
            slider.addEventListener('input', () => {
              slider.nextElementSibling.textContent = `${slider.value}%`;
            });
            slider.addEventListener('change', () => {
              clearTimeout(paramTimeout);
              paramTimeout = setTimeout(async () => {
                try {
                  await API().executeAction({
                    actionType: 'setFxParameter',
                    args: {
                      trackId: slider.dataset.trackId,
                      fxIndex: parseInt(slider.dataset.fxIndex, 10),
                      paramIndex: parseInt(slider.dataset.paramIndex, 10),
                      value: parseInt(slider.value, 10) / 100
                    },
                    confirmed: true
                  });
                } catch (e) { console.error('FX param change failed:', e); }
              }, 100);
            });
          });
        } catch (e) {
          paramsEl.innerHTML = '<div class="text-muted" style="padding:4px 8px;font-size:11px;">Failed to load</div>';
        }
      });
    });
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

  function updateSelectedMeter(data) {
    const selectedTrack = State().get('selectedTrack');
    if (!selectedTrack || !data || !data.peaks) return;
    const peak = data.peaks.find(p => p.trackIndex === selectedTrack.index);
    if (!peak) return;
    const leftFill = document.querySelector('#selected-track-meter .left-fill');
    const rightFill = document.querySelector('#selected-track-meter .right-fill');
    if (leftFill) leftFill.style.width = `${Math.min(peak.peakL * 100, 100)}%`;
    if (rightFill) rightFill.style.width = `${Math.min(peak.peakR * 100, 100)}%`;
  }

  function init() {
    State().on('selectedTrack', render);
    State().on('peakUpdate', updateSelectedMeter);
    render(State().get('selectedTrack'));
  }

  return { init, render };
})();
