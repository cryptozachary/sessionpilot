// SessionPilot for REAPER - Agent Context Builder
// Compact, model-friendly rendering of session state for the AI-mode agent's
// prompt. Reuses buildSessionContext (tracks/transport/sections) and
// sessionHealthCheck.analyzeSession (health warnings) rather than
// re-deriving either. Kept small on purpose; the agent can call
// get_session_state for the full JSON when it needs more detail.

const { buildSessionContext } = require('./contextBuilder');
const { analyzeSession } = require('./sessionHealthCheck');

function formatTrackLine(t) {
  const flags = [];
  if (t.isArmed) flags.push('armed');
  if (t.monitoringOn) flags.push('mon');
  if (t.isMuted) flags.push('mute');
  if (t.isSolo) flags.push('solo');

  const fx = (t.fxNames && t.fxNames.length) ? ` fx=[${t.fxNames.join(',')}]` : '';
  const takes = (t.takes && t.takes.length)
    ? ` takes=${t.takes.length}`
    : (t.itemCount ? ` items=${t.itemCount}` : '');

  return `  - ${t.name} (${t.trackType || 'audio'})${flags.length ? ' ' + flags.join(',') : ' idle'}${fx}${takes}`;
}

/**
 * Builds a compact string summary of the session for the agent prompt.
 * @param {Object} bridge - a ReaperBridge implementation (mock or real)
 * @returns {Promise<string>}
 */
async function buildAgentContext(bridge) {
  const c = await buildSessionContext(bridge);
  const session = c.session || {};
  const transport = c.transport || { state: 'stopped' };
  const tracks = Array.isArray(c.tracks) ? c.tracks : [];
  const sections = Array.isArray(c.sections) ? c.sections : [];

  // analyzeSession reads contextSnapshot.tracks/transport/recording, all of
  // which buildSessionContext already produced on `c` — reuse it directly
  // rather than re-deriving armed-track state.
  const { warnings: health } = analyzeSession(c);

  const trackLines = tracks.map(formatTrackLine);

  const lines = [
    `Project: ${session.projectName || 'Untitled'} | ${session.bpm || transport.bpm || '?'} BPM | transport=${transport.state}`,
    `Tracks (${tracks.length}):`,
    ...trackLines,
    sections.length
      ? `Sections: ${sections.map((s) => `${s.name}[${s.startBar}-${s.endBar}]`).join(', ')}`
      : 'Sections: none',
    health.length
      ? `Health warnings: ${health.map((h) => `${h.severity}:${h.message}`).join('; ')}`
      : 'Health: ok'
  ];

  return lines.join('\n');
}

module.exports = { buildAgentContext };
