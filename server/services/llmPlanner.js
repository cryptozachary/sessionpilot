const { PLAN_KINDS, validatePlan } = require('./plannerSchema');
const userProfileService = require('./userProfile');

// LLM integration (optional — requires ANTHROPIC_API_KEY env var and @anthropic-ai/sdk)
let Anthropic = null;
try {
  Anthropic = require('@anthropic-ai/sdk');
} catch (_e) {
  // SDK not installed — LLM features unavailable, heuristic-only mode
}

const ORDINAL_WORDS = {
  first: 1,
  one: 1,
  '1st': 1,
  second: 2,
  two: 2,
  '2nd': 2,
  third: 3,
  three: 3,
  '3rd': 3,
  fourth: 4,
  four: 4,
  '4th': 4
};

const SECTION_ALIASES = {
  hook: 'chorus',
  prechorus: 'pre chorus',
  'pre-chorus': 'pre chorus'
};

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalSectionLabel(value) {
  const normalized = normalizeText(value).replace(/\b(pre)\s+(chorus)\b/g, 'pre chorus');
  return SECTION_ALIASES[normalized] || normalized;
}

function parseOrdinal(token) {
  if (!token) return null;
  const normalized = normalizeText(token);
  return ORDINAL_WORDS[normalized] || (/^\d+$/.test(normalized) ? parseInt(normalized, 10) : null);
}

function extractSectionReference(message) {
  const normalized = normalizeText(message);
  const labels = ['intro', 'verse', 'pre chorus', 'chorus', 'hook', 'bridge', 'outro', 'break', 'solo', 'interlude'];
  const sectionLabelPattern = labels.join('|').replace(/ /g, '\\s+');
  const leadingPattern = new RegExp(`\\b(first|second|third|fourth|one|two|three|four|1st|2nd|3rd|4th)?\\s*(${sectionLabelPattern})\\b`);
  const trailingPattern = new RegExp(`\\b(${sectionLabelPattern})\\s*(1|2|3|4|one|two|three|four|first|second|third|fourth)?\\b`);

  let match = normalized.match(leadingPattern);
  if (match && match[2]) {
    return {
      label: canonicalSectionLabel(match[2]),
      ordinal: parseOrdinal(match[1]),
      display: `${match[1] ? `${match[1]} ` : ''}${match[2]}`.trim()
    };
  }

  match = normalized.match(trailingPattern);
  if (match && match[1]) {
    return {
      label: canonicalSectionLabel(match[1]),
      ordinal: parseOrdinal(match[2]),
      display: `${match[1]}${match[2] ? ` ${match[2]}` : ''}`.trim()
    };
  }

  return null;
}

function parseSectionName(name) {
  const normalized = canonicalSectionLabel(name);
  const labels = ['intro', 'verse', 'pre chorus', 'chorus', 'bridge', 'outro', 'break', 'solo', 'interlude'];

  let label = labels.find((candidate) => normalized.includes(candidate));
  if (!label && normalized.includes('hook')) {
    label = 'chorus';
  }

  const ordinalMatch = normalized.match(/\b(1|2|3|4|one|two|three|four|first|second|third|fourth)\b/);
  return {
    label: label || normalized,
    ordinal: parseOrdinal(ordinalMatch && ordinalMatch[1]),
    normalized
  };
}

function findSectionMatch(context, reference) {
  const sections = Array.isArray(context.sections) ? context.sections : [];
  const candidates = sections
    .map((section) => {
      const parsed = parseSectionName(section.name);
      return {
        ...section,
        parsedLabel: parsed.label,
        parsedOrdinal: parsed.ordinal
      };
    })
    .filter((section) => section.parsedLabel === reference.label);

  if (candidates.length === 0) {
    return null;
  }

  if (reference.ordinal) {
    const exact = candidates.find((candidate) => candidate.parsedOrdinal === reference.ordinal);
    if (exact) return exact;

    if (reference.ordinal <= candidates.length) {
      return candidates[reference.ordinal - 1];
    }
  }

  return candidates[0];
}

function parsePreRollBeats(message) {
  const match = String(message || '').match(/(\d+)\s*beats?\s*pre-?roll|pre-?roll\s*(?:of\s*)?(\d+)\s*beats?/i);
  if (!match) return null;
  return parseInt(match[1] || match[2], 10);
}

function describeLastPlan(plan) {
  if (!plan) return 'that action';
  if (plan.kind === PLAN_KINDS.WORKFLOW && plan.workflow) {
    return plan.workflow;
  }
  if (plan.kind === PLAN_KINDS.DIRECT_ACTION && plan.actionType) {
    return plan.actionType;
  }
  return 'that action';
}

function finalizePlan(plan) {
  const validated = validatePlan(plan);
  return validated.ok ? validated.data : null;
}

function planRepeatRequest(message, memory) {
  const normalized = normalizeText(message);
  const isRepeatRequest =
    /\b(do|run|try|repeat)\b.*\b(that|it)\b.*\bagain\b/.test(normalized) ||
    /\bsame thing\b/.test(normalized);

  if (!isRepeatRequest || !memory || !memory.lastPlan) {
    return null;
  }

  if (/\b(more|less)\s+reverb\b/.test(normalized) || /\b(reverb|echo)\b/.test(normalized)) {
    return finalizePlan({
      kind: PLAN_KINDS.CLARIFICATION,
      message: 'I can repeat the last setup, but reverb amount is not a direct control yet. Tell me the bars or track you want adjusted and I will keep it structured.',
      confidence: 0.73,
      metadata: {
        reason: 'unsupported_reverb_follow_up'
      }
    });
  }

  return finalizePlan({
    kind: memory.lastPlan.kind,
    workflow: memory.lastPlan.workflow || '',
    actionType: memory.lastPlan.actionType || '',
    args: memory.lastPlan.args || {},
    message: `I'll repeat ${describeLastPlan(memory.lastPlan)}.`,
    requiresConfirmation: Boolean(memory.lastPlan.requiresConfirmation),
    confidence: 0.88,
    metadata: {
      reason: 'memory_repeat',
      sectionRef: memory.lastPlan.sectionRef || undefined
    }
  });
}

function planSectionPunchRequest(message, context) {
  const normalized = normalizeText(message);
  const mentionsPunch = /\b(punch|drop in|drop-in|redo|re record|re-record|loop)\b/.test(normalized);
  const sectionReference = extractSectionReference(message);

  if (!mentionsPunch || !sectionReference) {
    return null;
  }

  const section = findSectionMatch(context, sectionReference);
  if (!section) {
    return finalizePlan({
      kind: PLAN_KINDS.CLARIFICATION,
      message: `I couldn't match "${sectionReference.display}" to the current markers or regions. Tell me the bar range you want to punch.`,
      confidence: 0.64,
      metadata: {
        reason: 'section_not_found'
      }
    });
  }

  if (!Number.isFinite(section.startBar) || !Number.isFinite(section.endBar)) {
    return finalizePlan({
      kind: PLAN_KINDS.CLARIFICATION,
      message: `I found "${section.name}", but I still need a clear bar range. Tell me something like "bars 17 to 25".`,
      confidence: 0.66,
      metadata: {
        reason: 'section_missing_bar_range',
        sectionRef: {
          name: section.name
        }
      }
    });
  }

  const wantsLoop = /\b(loop|cleaner|tight|keep going|keep looping)\b/.test(normalized);
  const preRollBeats = parsePreRollBeats(message);
  const args = {
    startBar: section.startBar,
    endBar: section.endBar
  };

  if (wantsLoop && Number.isFinite(preRollBeats)) {
    args.preRollBeats = preRollBeats;
  }

  return finalizePlan({
    kind: PLAN_KINDS.WORKFLOW,
    workflow: wantsLoop ? 'quickPunchLoop' : 'preparePunchIn',
    args,
    message: wantsLoop
      ? `I can set up a loop punch for "${section.name}" on bars ${section.startBar} to ${section.endBar}.`
      : `I can set up a punch-in for "${section.name}" on bars ${section.startBar} to ${section.endBar}.`,
    confidence: 0.82,
    metadata: {
      reason: 'section_punch_lookup',
      sectionRef: {
        name: section.name,
        startBar: section.startBar,
        endBar: section.endBar
      }
    }
  });
}

const LLM_SYSTEM_PROMPT = `You are a REAPER DAW session assistant classifier. Classify the user's message into one of these action types.

WORKFLOWS (return kind: "workflow"):
- setupLeadVocal: Set up a lead vocal track for recording
- setupLeadDoubleAdlib: Set up lead, doubles, and adlib tracks
- preparePunchIn: Prepare a punch-in recording (args: startBar, endBar)
- quickPunchLoop: Set up loop punch recording (args: startBar, endBar, preRollBeats)
- organizeSessionTracks: Organize/clean up session tracks into folders
- colorCodeVocals: Color code vocal tracks for visual clarity
- diagnoseMonitoringIssue: Help with monitoring/hearing problems
- diagnoseLowInputIssue: Help with low input levels or gain
- setupHeadphoneMix: Set up headphone/cue mix with reverb
- compTakes: Review and comp takes on a track
- roughMix: Create a rough mix with panning and levels
- markSongStructure: Mark song sections with markers (args: sections array)
- sessionNotes: Add session notes or bookmarks (args: note text)
- preflightCheck: Pre-session readiness check

DIRECT ACTIONS (return kind: "direct_action"):
- armTrack: Arm a track for recording
- disarmTrack: Disarm a track
- renameTrack: Rename a track (args: name)
- createTrack: Create a new track (args: name)
- duplicateTrack: Duplicate selected track
- insertMarker: Insert a marker (args: name)
- selectTrack: Select a track

ADVICE (return kind: "advice"): For general recording questions, technique tips, or greetings.
CLARIFICATION (return kind: "clarification"): When the request is too ambiguous to act on.

Respond with ONLY valid JSON:
{"kind":"...","workflow":"...","actionType":"...","args":{},"message":"natural response","confidence":0.0-1.0,"requiresConfirmation":false}

Omit workflow/actionType fields when not applicable. Keep message under 200 chars.`;

async function planWithLLM(message, context) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !Anthropic) {
    return null;
  }

  const tracks = (context.tracks || []).map(t => t.name).join(', ');
  const selectedTrack = context.selectedTrack ? context.selectedTrack.name : 'none';
  const sections = (context.sections || [])
    .map(s => `${s.name} (bars ${s.startBar}-${s.endBar})`)
    .join(', ');
  const session = context.session || {};

  const profileSummary = userProfileService.summarize(context.userProfile);
  const contextLine = `Session: "${session.projectName || 'Untitled'}" | ${(context.tracks || []).length} tracks [${tracks}] | Selected: ${selectedTrack} | Sections: ${sections || 'none'} | BPM: ${session.bpm || '?'}${profileSummary ? ` | Preferences: ${profileSummary}` : ''}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: LLM_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `${contextLine}\n\nUser: ${message}` }]
    });

    const text = (response.content[0].text || '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return finalizePlan(parsed);
  } catch (err) {
    console.error('LLM planner error:', err.message);
    return null;
  }
}

async function plan({ message, context, memory }) {
  const mode = (process.env.SESSIONPILOT_PLANNER_MODE || 'heuristic').toLowerCase();
  if (mode === 'off') {
    return null;
  }

  const repeatPlan = planRepeatRequest(message, memory);
  if (repeatPlan) {
    return repeatPlan;
  }

  const sectionPlan = planSectionPunchRequest(message, context);
  if (sectionPlan) {
    return sectionPlan;
  }

  // LLM fallback — only when heuristics cannot classify and API key is available
  if (mode !== 'heuristic-only') {
    const llmPlan = await planWithLLM(message, context);
    if (llmPlan) {
      return llmPlan;
    }
  }

  return null;
}

const ADVISOR_SYSTEM_PROMPT = `You are a REAPER DAW session advisor. The user asked for session guidance ("what should I do next?", "now what?", etc.). Analyze their current session state and give ONE concrete, actionable suggestion tailored to where they are in the session.

Guidelines:
- If recording: encourage them to keep going or stop to review
- If armed but not recording: tell them they are set up and ready
- If takes exist but nothing armed: suggest comping or punching in
- If session is empty: suggest setting up a first track
- Keep it conversational and specific — mention track names or section names when available
- Max 2 sentences. Do not list multiple options.

Respond with ONLY valid JSON: {"kind":"advice","message":"your advice here","confidence":0.85}`;

async function planAdvisor({ message, context }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !Anthropic) {
    return null;
  }

  const mode = (process.env.SESSIONPILOT_PLANNER_MODE || 'heuristic').toLowerCase();
  if (mode === 'off' || mode === 'heuristic-only') {
    return null;
  }

  const tracks = (context.tracks || []).map(t => t.name).join(', ');
  const selectedTrack = context.selectedTrack ? context.selectedTrack.name : 'none';
  const sections = (context.sections || [])
    .map(s => `${s.name} (bars ${s.startBar}-${s.endBar})`)
    .join(', ');
  const session = context.session || {};
  const transport = context.transport || { state: 'stopped' };
  const recording = context.recording || { armedTrackCount: 0, totalTakeCount: 0 };
  const profileSummary = userProfileService.summarize(context.userProfile);

  const contextLine = [
    `Session: "${session.projectName || 'Untitled'}"`,
    `Tracks: [${tracks || 'none'}]`,
    `Selected: ${selectedTrack}`,
    `Transport: ${transport.state}`,
    `Armed: ${recording.armedTrackCount}`,
    `Takes: ${recording.totalTakeCount}`,
    sections ? `Sections: ${sections}` : null,
    profileSummary ? `Preferences: ${profileSummary}` : null
  ].filter(Boolean).join(' | ');

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      system: ADVISOR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `${contextLine}\n\nUser: ${message}` }]
    });

    const text = (response.content[0].text || '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return finalizePlan({ ...parsed, kind: 'advice' });
  } catch (err) {
    console.error('LLM advisor error:', err.message);
    return null;
  }
}

module.exports = {
  plan,
  planAdvisor
};
