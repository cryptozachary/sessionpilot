const actionLog = require('./actionLog');

function resolveSettledData(result, fallbackValue) {
  if (result.status !== 'fulfilled' || !result.value || result.value.ok === false) {
    return fallbackValue;
  }
  return result.value.data !== undefined ? result.value.data : fallbackValue;
}

function collectWarning(warnings, label, result) {
  if (result.status === 'rejected') {
    warnings.push(`${label}: ${result.reason && result.reason.message ? result.reason.message : 'failed'}`);
    return;
  }

  const value = result.value;
  if (!value) {
    warnings.push(`${label}: no response`);
    return;
  }

  const errors = Array.isArray(value.errors) ? value.errors : [];
  const messages = errors.filter(Boolean);
  if (messages.length > 0) {
    warnings.push(`${label}: ${messages.join('; ')}`);
  }
}

function secondsToBar(seconds, bpm) {
  if (!Number.isFinite(seconds) || !Number.isFinite(bpm) || bpm <= 0) {
    return null;
  }

  const beats = (seconds * bpm) / 60;
  return Math.max(1, Math.round(beats / 4) + 1);
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function buildSectionItem(item, source, timelineUnit, bpm) {
  if (!item || typeof item !== 'object') return null;

  const rawStart = item.start !== undefined ? item.start : item.position;
  const rawEnd = item.end !== undefined ? item.end : null;

  let startBar = firstFiniteNumber(item.startBar, item.bar);
  let endBar = firstFiniteNumber(item.endBar);

  if (!Number.isFinite(startBar) && timelineUnit === 'bars') {
    if (Number.isFinite(rawStart)) startBar = Math.max(1, Math.round(rawStart));
  } else if (!Number.isFinite(startBar)) {
    startBar = secondsToBar(rawStart, bpm);
  }

  if (!Number.isFinite(endBar) && timelineUnit === 'bars') {
    if (Number.isFinite(rawEnd)) endBar = Math.max(startBar || 1, Math.round(rawEnd));
  } else if (!Number.isFinite(endBar)) {
    endBar = secondsToBar(rawEnd, bpm);
  }

  return {
    name: item.name || '',
    source,
    start: Number.isFinite(rawStart) ? rawStart : null,
    end: Number.isFinite(rawEnd) ? rawEnd : null,
    startBar,
    endBar
  };
}

function buildSections(markers, regions, context) {
  const timelineUnit = context.connection && context.connection.bridgeType === 'mock'
    ? 'bars'
    : 'seconds';
  const bpm = context.session && Number.isFinite(context.session.bpm)
    ? context.session.bpm
    : 120;
  const sections = [];
  const markerList = Array.isArray(markers)
    ? [...markers].sort((a, b) => (a.position || 0) - (b.position || 0))
    : [];
  const regionList = Array.isArray(regions)
    ? [...regions].sort((a, b) => (a.start || 0) - (b.start || 0))
    : [];

  regionList.forEach((region) => {
    const section = buildSectionItem(region, 'region', timelineUnit, bpm);
    if (section) sections.push(section);
  });

  markerList.forEach((marker, index) => {
    const nextMarker = markerList[index + 1] || null;
    const markerSpan = buildSectionItem(
      {
        name: marker.name,
        position: marker.position,
        bar: marker.bar,
        startBar: marker.startBar,
        endBar: nextMarker ? firstFiniteNumber(nextMarker.startBar, nextMarker.bar) : null,
        end: nextMarker ? nextMarker.position : null
      },
      'marker_span',
      timelineUnit,
      bpm
    );

    if (markerSpan) {
      sections.push(markerSpan);
    }
  });

  return sections.sort((a, b) => {
    if (!Number.isFinite(a.start) && !Number.isFinite(b.start)) return 0;
    if (!Number.isFinite(a.start)) return 1;
    if (!Number.isFinite(b.start)) return -1;
    return a.start - b.start;
  });
}

async function buildSessionContext(bridge, options = {}) {
  const actionLogLimit = Number.isFinite(options.actionLogLimit) ? options.actionLogLimit : 8;
  const warnings = [];

  const [
    sessionResult,
    tracksResult,
    selectedTrackResult,
    markersResult,
    transportResult,
    connectionResult
  ] = await Promise.allSettled([
    bridge.getProjectSummary(),
    bridge.listTracks(),
    bridge.getSelectedTrack(),
    bridge.getMarkersAndRegions(),
    bridge.getTransportState(),
    bridge.getConnectionStatus()
  ]);

  collectWarning(warnings, 'session', sessionResult);
  collectWarning(warnings, 'tracks', tracksResult);
  collectWarning(warnings, 'selectedTrack', selectedTrackResult);
  collectWarning(warnings, 'markers', markersResult);
  collectWarning(warnings, 'transport', transportResult);
  collectWarning(warnings, 'connection', connectionResult);

  const session = resolveSettledData(sessionResult, {});
  const tracks = resolveSettledData(tracksResult, []);
  const selectedTrack = resolveSettledData(selectedTrackResult, null);
  const markerData = resolveSettledData(markersResult, { markers: [], regions: [] }) || {};
  const transport = resolveSettledData(transportResult, {
    state: session.transportState || 'stopped',
    bpm: session.bpm || 120,
    playCursor: session.playCursor || 0
  });
  const connection = resolveSettledData(connectionResult, {
    connected: false,
    bridgeType: 'unknown'
  });

  const markers = Array.isArray(markerData.markers) ? markerData.markers : [];
  const regions = Array.isArray(markerData.regions) ? markerData.regions : [];

  // Compute recording metadata from tracks
  const armedTracks = Array.isArray(tracks) ? tracks.filter(t => t.isArmed || t.armed) : [];
  const trackTakeCounts = Array.isArray(tracks) ? tracks.reduce((acc, t) => {
    const takeCount = Array.isArray(t.takes) ? t.takes.length : 0;
    if (takeCount > 0) acc.push({ trackId: t.id, name: t.name, takeCount });
    return acc;
  }, []) : [];
  const totalTakes = trackTakeCounts.reduce((sum, t) => sum + t.takeCount, 0);

  const recording = {
    armedTrackCount: armedTracks.length,
    armedTracks: armedTracks.map(t => ({ id: t.id, name: t.name })),
    tracksWithTakes: trackTakeCounts,
    totalTakeCount: totalTakes,
    isRecording: transport.state === 'recording'
  };

  const context = {
    generatedAt: new Date().toISOString(),
    connection,
    session,
    transport,
    tracks,
    selectedTrack,
    markers,
    regions,
    recording,
    recentActions: actionLog.getRecent(actionLogLimit),
    warnings
  };

  context.sections = buildSections(markers, regions, context);

  return context;
}

module.exports = {
  buildSessionContext
};
