// SessionPilot for REAPER - AI Mode Agent Planner
//
// Runs a multi-turn Anthropic tool-use loop for AI mode. READ tools execute
// live against the bridge so the model can inspect the session; WRITE tools
// (direct actions + workflows) are NOT executed here - they are recorded into
// a proposed plan that the app's existing preview -> confirm -> execute
// pipeline runs later.
//
// The Anthropic client is injected so tests can drive this with a fake (no
// network). Returns null when there is no client and no usable API key/SDK,
// so callers can fall back to the non-AI flow.

const { buildTools } = require('./toolRegistry');
const { buildAgentContext } = require('./agentContext');

let Anthropic = null;
try { Anthropic = require('@anthropic-ai/sdk'); } catch (_e) { /* optional dependency */ }

const MODEL = 'claude-sonnet-5';
const MAX_TURNS = 6;

const AGENT_SYSTEM_PROMPT = `You are SessionPilot, an AI recording engineer embedded in the REAPER DAW, helping a solo recording artist.

You can inspect the session with READ tools (get_session_state, list_takes, get_track_fx, get_fx_parameters) - call these freely; they run immediately and return live data.

To CHANGE the session you call WRITE tools (arm/record/create/workflow_*/etc). These are NOT executed immediately - they are added to a plan the user must confirm. So: inspect with reads, then call the write tools for every step you intend, in order, then write a short natural-language summary of the plan. Prefer the highest-level tool that fits (a workflow_* over many low-level actions).

Guidelines:
- Be concise and concrete; mention real track/section names from the state.
- Never invent track ids - read the state to find them, or omit trackId to mean the selected track.
- If the request is a question, answer it from the reads and propose no writes.
- If the request is ambiguous, ask one clarifying question and propose no writes.`;

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !Anthropic) return null;
  return new Anthropic({ apiKey });
}

/**
 * Runs the AI-mode agent tool-use loop.
 * @param {Object} opts
 * @param {Object} [opts.client] - injected Anthropic-compatible client (must expose messages.create). Falls back to an env-configured client when omitted.
 * @param {Object} opts.bridge - a ReaperBridge implementation (mock or real)
 * @param {string} opts.message - the user's message for this turn
 * @param {Array} [opts.history] - prior conversation messages (Anthropic message format)
 * @returns {Promise<{message: string, proposedActions: Array, requiresConfirmation: boolean}|null>}
 */
async function runAgent({ client, bridge, message, history = [] }) {
  const active = client || getClient();
  if (!active) return null;

  const { tools, byName } = buildTools();
  const context = await buildAgentContext(bridge);

  const system = [{ type: 'text', text: AGENT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }];
  const messages = [
    ...history,
    { role: 'user', content: `CURRENT SESSION STATE:\n${context}\n\nUSER REQUEST: ${message}` }
  ];

  const proposedActions = [];
  let finalText = '';

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const resp = await active.messages.create({ model: MODEL, max_tokens: 1024, system, tools, messages });

    const textParts = (resp.content || []).filter((c) => c.type === 'text').map((c) => c.text);
    if (textParts.length) finalText = textParts.join('\n').trim();

    const toolUses = (resp.content || []).filter((c) => c.type === 'tool_use');
    if (toolUses.length === 0) break;

    messages.push({ role: 'assistant', content: resp.content });

    const toolResults = [];
    for (const tu of toolUses) {
      const def = byName[tu.name];
      if (def && def.kind === 'read') {
        let out;
        try { out = await def.execute(bridge, tu.input || {}); }
        catch (e) { out = { error: String((e && e.message) || e) }; }
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out).slice(0, 6000) });
      } else if (def && def.kind === 'write') {
        proposedActions.push(def.toAction(tu.input || {}));
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify({ queued: true, note: 'Added to the plan; runs after the user confirms.' })
        });
      } else {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          is_error: true,
          content: JSON.stringify({ error: 'unknown tool ' + tu.name })
        });
      }
    }
    messages.push({ role: 'user', content: toolResults });

    if (resp.stop_reason !== 'tool_use') break;
  }

  return {
    message: finalText || 'Done.',
    proposedActions,
    requiresConfirmation: proposedActions.length > 0
  };
}

module.exports = { runAgent, AGENT_SYSTEM_PROMPT };
