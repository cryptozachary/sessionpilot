// SessionPilot for REAPER - Session Health Check
// Pure analysis: takes a contextSnapshot, returns a list of health warnings.
// Called on every WebSocket broadcast — no I/O, no side effects.

const FX_HEAVY_THRESHOLD = 4; // armed tracks with this many FX or more trigger a warning

function warn(id, severity, message, detail) {
  return { id, severity, message, detail };
}

function checkNoTracks(tracks) {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return warn(
      'no_tracks',
      'info',
      'Session has no tracks',
      "Create a track to get started, or load a template."
    );
  }
  return null;
}

function checkRecordingNoArmed(transport, armedTracks) {
  if (transport.state === 'recording' && armedTracks.length === 0) {
    return warn(
      'recording_no_armed',
      'error',
      'Recording but no tracks armed',
      "You're rolling tape but nothing is armed. Arm a track before recording."
    );
  }
  return null;
}

function checkNoArmedTracks(tracks, armedTracks, transport) {
  // Only surface this if there's activity but nothing armed (avoid noise on fresh sessions)
  const hasActivity = Array.isArray(tracks) && tracks.some(t =>
    (Array.isArray(t.takes) && t.takes.length > 0) || (t.itemCount && t.itemCount > 0)
  );
  if (hasActivity && armedTracks.length === 0 && transport.state === 'stopped') {
    return warn(
      'no_armed_tracks',
      'warning',
      'No tracks armed',
      "Session has takes but nothing is armed. Arm a track when you're ready to record."
    );
  }
  return null;
}

function checkMonitoringOffArmed(armedTracks, allTracks) {
  const trackMap = new Map((allTracks || []).map(t => [t.id, t]));
  const offTracks = armedTracks
    .map(a => trackMap.get(a.id))
    .filter(t => t && t.monitoringOn === false);
  if (offTracks.length > 0) {
    const names = offTracks.map(t => t.name || 'unnamed').join(', ');
    return warn(
      'monitoring_off_armed',
      'warning',
      `Monitoring off on armed track${offTracks.length > 1 ? 's' : ''}`,
      `"${names}" ${offTracks.length > 1 ? 'are' : 'is'} armed but input monitoring is off. You won't hear yourself.`
    );
  }
  return null;
}

function checkDuplicateInputArmed(armedTracks, allTracks) {
  const trackMap = new Map((allTracks || []).map(t => [t.id, t]));
  const inputCounts = {};
  for (const a of armedTracks) {
    const t = trackMap.get(a.id);
    const label = t && t.inputLabel;
    if (label) {
      inputCounts[label] = (inputCounts[label] || 0) + 1;
    }
  }
  const dupes = Object.entries(inputCounts).filter(([, count]) => count > 1);
  if (dupes.length > 0) {
    const inputName = dupes[0][0];
    return warn(
      'duplicate_input_armed',
      'warning',
      'Same input on multiple armed tracks',
      `"${inputName}" is routed to ${dupes[0][1]} armed tracks. This will record the same signal multiple times.`
    );
  }
  return null;
}

function checkNoInputLabelArmed(armedTracks, allTracks) {
  const trackMap = new Map((allTracks || []).map(t => [t.id, t]));
  const missing = armedTracks
    .map(a => trackMap.get(a.id))
    .filter(t => t && !t.inputLabel);
  if (missing.length > 0) {
    const names = missing.map(t => t.name || 'unnamed').join(', ');
    return warn(
      'no_input_label_armed',
      'info',
      'No input assigned on armed track',
      `"${names}" is armed but has no input source assigned.`
    );
  }
  return null;
}

function checkFxHeavyArmed(armedTracks, allTracks) {
  const trackMap = new Map((allTracks || []).map(t => [t.id, t]));
  const heavy = armedTracks
    .map(a => trackMap.get(a.id))
    .filter(t => t && Array.isArray(t.fxNames) && t.fxNames.length >= FX_HEAVY_THRESHOLD);
  if (heavy.length > 0) {
    const names = heavy.map(t => `${t.name || 'unnamed'} (${t.fxNames.length} FX)`).join(', ');
    return warn(
      'fx_heavy_armed',
      'warning',
      'FX-heavy chain on armed track',
      `${names}. Heavy FX chains while tracking can cause latency. Consider bypassing non-essential plugins.`
    );
  }
  return null;
}

/**
 * Analyzes a contextSnapshot and returns an array of health warnings.
 * @param {Object} contextSnapshot - from buildSessionContext()
 * @returns {{ warnings: Array }}
 */
function analyzeSession(contextSnapshot) {
  const tracks = contextSnapshot.tracks || [];
  const transport = contextSnapshot.transport || { state: 'stopped' };
  const recording = contextSnapshot.recording || { armedTracks: [], armedTrackCount: 0 };
  const armedTracks = recording.armedTracks || [];

  const warnings = [
    checkNoTracks(tracks),
    checkRecordingNoArmed(transport, armedTracks),
    checkNoArmedTracks(tracks, armedTracks, transport),
    checkMonitoringOffArmed(armedTracks, tracks),
    checkDuplicateInputArmed(armedTracks, tracks),
    checkNoInputLabelArmed(armedTracks, tracks),
    checkFxHeavyArmed(armedTracks, tracks)
  ].filter(Boolean);

  return { warnings };
}

module.exports = { analyzeSession };
