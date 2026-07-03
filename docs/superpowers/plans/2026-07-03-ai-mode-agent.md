# AI Mode (Agentic LLM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggleable "AI mode" that turns the LLM from a narrow fallback into a full agent — it can see rich session state, call the entire action/workflow toolset via Anthropic tool use, and propose multi-step plans — while the existing deterministic mode remains the default and still handles trivial commands instantly (even inside AI mode).

**Architecture:** A new agent loop (`agentPlanner`) runs an Anthropic tool-use conversation. **Read tools execute live** during the loop so the model can inspect state; **write tools are recorded as a proposed plan** (never executed inside the loop) and returned to the existing preview→confirm→execute pipeline. `chatOrchestrator` gains a mode branch: in AI mode, unambiguous fast-path commands still go through the deterministic classifier (instant/free); everything else goes to the agent. Tools are generated from a single declarative registry with a parity guard test so they never drift from the real action set. Sonnet 5 + prompt caching keeps quality high and cost low.

**Tech Stack:** Node/Express, `@anthropic-ai/sdk` (already an optional dep), Node built-in `node:test` + `node:assert` for tests (no new deps), vanilla-JS frontend.

---

## Conventions for every task

- **Test runner:** Node's built-in test runner. Tests live under `test/`. Run a single file with `node --test test/<file>.test.js`.
- **First task adds** a `test` script to `package.json`: `"test": "node --test"`.
- **LLM calls are never made in unit tests.** The Anthropic client is injected so tests use a fake. Real LLM calls are exercised only in the manual smoke step of Task 7.
- **Commit** at the end of each task with the shown message.

---

### Task 0: Test harness + `assistantMode` profile setting

**Goal:** Add a persisted per-user `assistantMode` (`'default'` | `'ai'`) to the user profile and a route to read/set it, plus wire up the test runner.

**Files:**
- Modify: `package.json` (add `test` script)
- Modify: `server/services/userProfile.js:9-19` (add field to `DEFAULT_PROFILE`)
- Modify: `server/routes/session.js` (add GET/POST `/api/assistant-mode`)
- Test: `test/userProfile.test.js`

**Acceptance Criteria:**
- [ ] `load()` returns `assistantMode: 'default'` for a fresh profile
- [ ] `updateField('assistantMode', 'ai')` persists and `load()` returns `'ai'`
- [ ] `updateField('assistantMode', 'bogus')` is rejected (value unchanged)
- [ ] `GET /api/assistant-mode` returns the current mode; `POST` with `{mode:'ai'}` sets it

**Verify:** `node --test test/userProfile.test.js` → all pass

**Steps:**

- [ ] **Step 1: Add the test script to package.json**

In `package.json`, add to `"scripts"`:

```json
"test": "node --test"
```

- [ ] **Step 2: Write the failing test**

Create `test/userProfile.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// Isolate the profile file per test run.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-profile-'));
process.env.USER_PROFILE_PATH = path.join(tmp, 'user_profile.json');

const profile = require('../server/services/userProfile');

test('fresh profile defaults assistantMode to "default"', async () => {
  const p = await profile.load();
  assert.strictEqual(p.assistantMode, 'default');
});

test('assistantMode can be set to "ai" and persists', async () => {
  await profile.updateField('assistantMode', 'ai');
  const p = await profile.load();
  assert.strictEqual(p.assistantMode, 'ai');
});

test('invalid assistantMode is rejected', async () => {
  await profile.updateField('assistantMode', 'ai');
  await profile.updateField('assistantMode', 'bogus');
  const p = await profile.load();
  assert.strictEqual(p.assistantMode, 'ai'); // unchanged
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test test/userProfile.test.js`
Expected: FAIL — `assistantMode` is `undefined` (not `'default'`), and invalid-value validation not enforced.

- [ ] **Step 4: Add the field and validation**

In `server/services/userProfile.js`, add `assistantMode` to `DEFAULT_PROFILE`:

```js
const DEFAULT_PROFILE = {
  preferredTrackStyle: null,
  punchInStyle: null,
  hookWorkflow: null,
  namingConventions: null,
  preferredOctave: null,
  genre: null,
  notes: [],
  assistantMode: 'default'
};
```

Then make `updateField` honor a per-field validator. Locate the existing `updateField` (around line 37) and replace its body so an `assistantMode` value outside the allowed set is ignored:

```js
const FIELD_VALIDATORS = {
  assistantMode: (v) => v === 'default' || v === 'ai'
};

async function updateField(key, value) {
  if (!KNOWN_FIELDS.has(key)) return load();
  const validator = FIELD_VALIDATORS[key];
  if (validator && !validator(value)) return load();
  const profile = await load();
  profile[key] = value;
  await save(profile);
  return profile;
}
```

If `userProfile.js` currently hard-codes its file path, make it honor `process.env.USER_PROFILE_PATH` when set (needed by the test and harmless in prod):

```js
const PROFILE_PATH = process.env.USER_PROFILE_PATH
  || path.join(__dirname, '..', '..', 'user_profile.json');
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test test/userProfile.test.js`
Expected: PASS (3/3)

- [ ] **Step 6: Add the route**

In `server/routes/session.js`, inside the exported router factory, add:

```js
const userProfile = require('../services/userProfile');

router.get('/api/assistant-mode', async (req, res) => {
  const p = await userProfile.load();
  res.json({ ok: true, data: { mode: p.assistantMode || 'default' } });
});

router.post('/api/assistant-mode', async (req, res) => {
  const mode = req.body && req.body.mode;
  if (mode !== 'default' && mode !== 'ai') {
    return res.json({ ok: false, error: 'mode must be "default" or "ai"' });
  }
  const p = await userProfile.updateField('assistantMode', mode);
  res.json({ ok: true, data: { mode: p.assistantMode } });
});
```

- [ ] **Step 7: Commit**

```bash
git add package.json server/services/userProfile.js server/routes/session.js test/userProfile.test.js
git commit -m "Add assistantMode profile setting and route; wire up node:test"
```

---

### Task 1: Tool registry (Anthropic tool defs from actions + workflows + read tools)

**Goal:** A single module that produces the Anthropic `tools` array and a `byName` lookup mapping each tool to a `kind` (`'read'` | `'write'`) and either a live executor (reads) or an action descriptor (writes). A guard test fails if any `DIRECT_ACTION_MAP` action or workflow lacks a tool, so the registry can never silently drift.

**Files:**
- Create: `server/services/toolRegistry.js`
- Modify: `server/routes/actions.js` (export the set of action-type names for the parity test)
- Test: `test/toolRegistry.test.js`

**Acceptance Criteria:**
- [ ] `buildTools()` returns `{ tools, byName }` where `tools` is a non-empty array of `{ name, description, input_schema }`
- [ ] Read tools have `kind:'read'` and an `execute(bridge, input)` function
- [ ] Write tools have `kind:'write'` and a `toAction(input)` returning `{ type, args }`
- [ ] Parity: every action in `DIRECT_ACTION_MAP` and every workflow name has a matching write tool (or is in an explicit `EXCLUDED` set)
- [ ] The last tool in `tools` carries `cache_control: { type: 'ephemeral' }` (enables tool-definition caching)

**Verify:** `node --test test/toolRegistry.test.js` → all pass

**Steps:**

- [ ] **Step 1: Export action names from the route module**

In `server/routes/actions.js`, the `DIRECT_ACTION_MAP` object is defined inside the factory. Lift the list of keys to a module-level export so other modules can read it without executing routes. Near the top of the file add and export a frozen name list built from the map. Concretely, after `DIRECT_ACTION_MAP` is defined, add:

```js
// Names of every direct action, for tool-registry parity checks.
const DIRECT_ACTION_NAMES = Object.keys(DIRECT_ACTION_MAP);
module.exports.DIRECT_ACTION_NAMES = DIRECT_ACTION_NAMES;
```

(If the file's `module.exports` is a function, attach the property to that function object instead, e.g. `createActionRoutes.DIRECT_ACTION_NAMES = DIRECT_ACTION_NAMES;` and export as before.)

- [ ] **Step 2: Write the failing test**

Create `test/toolRegistry.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { buildTools, EXCLUDED } = require('../server/services/toolRegistry');
const actions = require('../server/routes/actions');
const workflowService = require('../server/services/workflowService');

test('buildTools returns a non-empty tools array with schemas', () => {
  const { tools } = buildTools();
  assert.ok(Array.isArray(tools) && tools.length > 0);
  for (const t of tools) {
    assert.ok(t.name && t.description && t.input_schema, `bad tool: ${JSON.stringify(t)}`);
    assert.strictEqual(t.input_schema.type, 'object');
  }
});

test('read tools have execute(), write tools have toAction()', () => {
  const { byName } = buildTools();
  for (const [name, def] of Object.entries(byName)) {
    if (def.kind === 'read') assert.strictEqual(typeof def.execute, 'function', name);
    else if (def.kind === 'write') assert.strictEqual(typeof def.toAction, 'function', name);
    else assert.fail(`tool ${name} has invalid kind ${def.kind}`);
  }
});

test('every direct action and workflow has a write tool (parity)', () => {
  const { byName } = buildTools();
  const covered = new Set(Object.keys(byName));
  const missing = [];
  for (const a of actions.DIRECT_ACTION_NAMES || []) {
    if (!covered.has(a) && !EXCLUDED.has(a)) missing.push('action:' + a);
  }
  for (const w of workflowService.listWorkflows()) {
    const wname = 'workflow_' + w.name;
    if (!covered.has(wname) && !EXCLUDED.has(w.name)) missing.push('workflow:' + w.name);
  }
  assert.deepStrictEqual(missing, [], 'tools missing for: ' + missing.join(', '));
});

test('last tool carries cache_control', () => {
  const { tools } = buildTools();
  assert.deepStrictEqual(tools[tools.length - 1].cache_control, { type: 'ephemeral' });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test test/toolRegistry.test.js`
Expected: FAIL — module `server/services/toolRegistry.js` does not exist.

- [ ] **Step 4: Implement the registry**

Create `server/services/toolRegistry.js`:

```js
// Single source of truth for the tools the AI-mode agent can call.
// READ tools run live during the agent loop; WRITE tools are recorded as a plan
// and executed only after user confirmation via the existing action pipeline.

const workflowService = require('./workflowService');
const { buildSessionContext } = require('./contextBuilder');

// Actions intentionally NOT exposed as agent tools (covered by read tools,
// or not meaningful for the agent). Keep this list short and justified.
const EXCLUDED = new Set(['getTrackPeaks']);

const trackIdProp = {
  trackId: { type: 'string', description: 'Track id (e.g. "track_2"). Omit to target the selected track.' }
};

// READ tools — executed live so the model can inspect state before planning.
const READ_TOOLS = [
  {
    name: 'get_session_state',
    description: 'Full session snapshot: tracks (with armed/monitoring/fx/takes/volume/pan), transport, markers/regions, and current health warnings.',
    input_schema: { type: 'object', properties: {} },
    execute: async (bridge) => buildSessionContext(bridge)
  },
  {
    name: 'list_takes',
    description: 'List the takes on a track (for comping).',
    input_schema: { type: 'object', properties: { ...trackIdProp } },
    execute: async (bridge, input) => (await bridge.listTakes({ trackId: input.trackId })).data
  },
  {
    name: 'get_track_fx',
    description: 'List the FX/plugins on a track.',
    input_schema: { type: 'object', properties: { ...trackIdProp } },
    execute: async (bridge, input) => (await bridge.getTrackFx({ trackId: input.trackId })).data
  },
  {
    name: 'get_fx_parameters',
    description: 'List parameters of one FX on a track.',
    input_schema: {
      type: 'object',
      properties: { ...trackIdProp, fxIndex: { type: 'number', description: '0-based FX index' } },
      required: ['fxIndex']
    },
    execute: async (bridge, input) =>
      (await bridge.getFxParameters({ trackId: input.trackId, fxIndex: input.fxIndex })).data
  }
];

// WRITE action tools — declarative schemas. Each maps 1:1 to a DIRECT_ACTION_MAP
// action type. `toAction(input)` produces the proposedAction the existing
// preview/confirm/execute pipeline understands: { type, args }.
// NOTE (implementer): the parity test in test/toolRegistry.test.js will FAIL
// until every non-excluded action in DIRECT_ACTION_MAP has an entry here. Add
// them following the patterns below (no-arg, trackId, trackId+value, list-arg).
const WRITE_ACTIONS = [
  { type: 'play', description: 'Start playback.', properties: {} },
  { type: 'stop', description: 'Stop transport.', properties: {} },
  { type: 'record', description: 'Start recording (refused if no track is armed).', properties: {} },
  { type: 'armTrack', description: 'Arm a track for recording.', properties: { ...trackIdProp } },
  { type: 'disarmTrack', description: 'Disarm a track.', properties: { ...trackIdProp } },
  { type: 'toggleMonitoring', description: 'Turn input monitoring on/off.',
    properties: { ...trackIdProp, enabled: { type: 'boolean' } }, required: ['enabled'] },
  { type: 'muteTrack', description: 'Mute/unmute a track.',
    properties: { ...trackIdProp, enabled: { type: 'boolean' } }, required: ['enabled'] },
  { type: 'soloTrack', description: 'Solo/unsolo a track.',
    properties: { ...trackIdProp, enabled: { type: 'boolean' } }, required: ['enabled'] },
  { type: 'setTrackVolume', description: 'Set track volume (linear, 1.0 = unity).',
    properties: { ...trackIdProp, volume: { type: 'number' } }, required: ['volume'] },
  { type: 'setTrackPan', description: 'Set track pan (-1 left .. 1 right).',
    properties: { ...trackIdProp, pan: { type: 'number' } }, required: ['pan'] },
  { type: 'createTrack', description: 'Create a new audio track.',
    properties: { name: { type: 'string' }, color: { type: 'string' } } },
  { type: 'renameTrack', description: 'Rename a track.',
    properties: { ...trackIdProp, name: { type: 'string' } }, required: ['name'] }
  // ... implementer adds the remaining DIRECT_ACTION_MAP actions until parity passes.
];

function actionTool(a) {
  return {
    def: {
      name: a.type,
      description: a.description,
      input_schema: { type: 'object', properties: a.properties || {}, ...(a.required ? { required: a.required } : {}) }
    },
    entry: { kind: 'write', toAction: (input) => ({ type: a.type, args: input || {} }) }
  };
}

// WORKFLOW tools — one per registered workflow, named workflow_<name>.
function workflowTools() {
  return workflowService.listWorkflows().map((w) => ({
    def: {
      name: 'workflow_' + w.name,
      description: `Workflow: ${w.description}`,
      input_schema: { type: 'object', properties: {
        args: { type: 'object', description: 'Optional workflow arguments (e.g. startBar/endBar for punch-ins).' }
      } }
    },
    entry: {
      kind: 'write',
      toAction: (input) => ({ type: '__workflow__', workflow: w.name, args: (input && input.args) || {} })
    }
  }));
}

function buildTools() {
  const tools = [];
  const byName = {};

  for (const rt of READ_TOOLS) {
    tools.push({ name: rt.name, description: rt.description, input_schema: rt.input_schema });
    byName[rt.name] = { kind: 'read', execute: rt.execute };
  }
  for (const a of WRITE_ACTIONS) {
    const { def, entry } = actionTool(a);
    tools.push(def);
    byName[def.name] = entry;
  }
  for (const wt of workflowTools()) {
    tools.push(wt.def);
    byName[wt.def.name] = wt.entry;
  }

  // Cache tool definitions (they are static across a session).
  tools[tools.length - 1] = { ...tools[tools.length - 1], cache_control: { type: 'ephemeral' } };
  return { tools, byName };
}

module.exports = { buildTools, EXCLUDED };
```

- [ ] **Step 5: Run the test; add missing action entries until parity passes**

Run: `node --test test/toolRegistry.test.js`
Expected initially: the parity test FAILS listing missing actions (e.g. `action:goToMarker`, `action:setFxParameter`, ...). Add an entry to `WRITE_ACTIONS` for each — following the four patterns shown — then re-run until all 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/services/toolRegistry.js server/routes/actions.js test/toolRegistry.test.js
git commit -m "Add tool registry generating Anthropic tools from actions + workflows with parity guard"
```

---

### Task 2: Agent context builder

**Goal:** Produce a compact, information-dense JSON string of session state for the agent's prompt (per-track detail, health warnings, transport, markers). Reuses `contextBuilder` + `sessionHealthCheck`.

**Files:**
- Create: `server/services/agentContext.js`
- Test: `test/agentContext.test.js`

**Acceptance Criteria:**
- [ ] `buildAgentContext(bridge)` returns a string
- [ ] The string includes each track's name and its armed/monitoring/fx/take info
- [ ] The string includes health warnings when present
- [ ] Works against `MockReaperBridge` without throwing

**Verify:** `node --test test/agentContext.test.js` → all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

Create `test/agentContext.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const MockBridge = require('../server/bridge/MockReaperBridge');
const { buildAgentContext } = require('../server/services/agentContext');

test('buildAgentContext summarizes the mock session', async () => {
  const bridge = new MockBridge();
  const ctx = await buildAgentContext(bridge);
  assert.strictEqual(typeof ctx, 'string');
  assert.ok(ctx.includes('Lead Vocal'), 'should mention a seeded track');
  assert.ok(/armed/i.test(ctx), 'should describe armed state');
  assert.ok(/transport/i.test(ctx), 'should include transport');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/agentContext.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `server/services/agentContext.js`:

```js
const { buildSessionContext } = require('./contextBuilder');

// Compact, model-friendly rendering of session state. Kept small on purpose;
// the agent can call get_session_state for the full JSON when it needs detail.
async function buildAgentContext(bridge) {
  const c = await buildSessionContext(bridge);
  const session = c.session || {};
  const transport = c.transport || { state: 'stopped' };
  const tracks = c.tracks || [];
  const health = (c.health && c.health.warnings) || c.warnings || [];
  const sections = c.sections || [];

  const trackLines = tracks.map((t) => {
    const flags = [];
    if (t.isArmed) flags.push('armed');
    if (t.monitoringOn) flags.push('mon');
    if (t.isMuted) flags.push('mute');
    if (t.isSolo) flags.push('solo');
    const fx = (t.fxNames && t.fxNames.length) ? ` fx=[${t.fxNames.join(',')}]` : '';
    const takes = t.takes && t.takes.length ? ` takes=${t.takes.length}` : (t.itemCount ? ` items=${t.itemCount}` : '');
    return `  - ${t.name} (${t.trackType || 'audio'})${flags.length ? ' ' + flags.join(',') : ''}${fx}${takes}`;
  });

  const lines = [
    `Project: ${session.projectName || 'Untitled'} | ${session.bpm || '?'} BPM | transport=${transport.state}`,
    `Tracks (${tracks.length}):`,
    ...trackLines,
    sections.length ? `Sections: ${sections.map((s) => `${s.name}[${s.startBar}-${s.endBar}]`).join(', ')}` : 'Sections: none',
    health.length ? `Health warnings: ${health.map((h) => `${h.severity}:${h.message}`).join('; ')}` : 'Health: ok'
  ];
  return lines.join('\n');
}

module.exports = { buildAgentContext };
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/agentContext.test.js`
Expected: PASS. (If `buildSessionContext` nests health differently, adjust the `health` line — verify the real shape in `server/services/contextBuilder.js`.)

- [ ] **Step 5: Commit**

```bash
git add server/services/agentContext.js test/agentContext.test.js
git commit -m "Add agent context builder (compact session-state rendering)"
```

---

### Task 3: Agent planner core (tool-use loop)

**Goal:** The heart of AI mode. Given a message, run an Anthropic tool-use loop: execute read tools live, record write tools as a proposed plan, return `{ message, proposedActions, requiresConfirmation }`. The Anthropic client is injected for testability; a fake drives the unit test with no network.

**Files:**
- Create: `server/services/agentPlanner.js`
- Test: `test/agentPlanner.test.js`

**Acceptance Criteria:**
- [ ] `runAgent({ client, bridge, message })` returns `{ message, proposedActions, requiresConfirmation }`
- [ ] A model `tool_use` for a **read** tool executes it and feeds a `tool_result` back
- [ ] A model `tool_use` for a **write** tool is recorded in `proposedActions` and NOT executed on the bridge
- [ ] The loop stops when the model returns no tool calls (or after `MAX_TURNS`)
- [ ] Returns `null` when no API key / SDK is available

**Verify:** `node --test test/agentPlanner.test.js` → all pass

**Steps:**

- [ ] **Step 1: Write the failing test (fake Anthropic client, two-turn conversation)**

Create `test/agentPlanner.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const MockBridge = require('../server/bridge/MockReaperBridge');
const { runAgent } = require('../server/services/agentPlanner');

// Fake client: turn 1 reads state, turn 2 proposes a write, then finishes.
function fakeClient(script) {
  let i = 0;
  return { messages: { create: async () => script[i++] } };
}

test('runAgent executes reads live and records writes as a plan', async () => {
  const bridge = new MockBridge();
  const script = [
    { stop_reason: 'tool_use', content: [
      { type: 'text', text: 'Let me check the session.' },
      { type: 'tool_use', id: 't1', name: 'get_session_state', input: {} }
    ] },
    { stop_reason: 'tool_use', content: [
      { type: 'tool_use', id: 't2', name: 'armTrack', input: { trackId: 'track_4' } }
    ] },
    { stop_reason: 'end_turn', content: [
      { type: 'text', text: "I'll arm the Lead Vocal. Confirm to proceed." }
    ] }
  ];
  const res = await runAgent({ client: fakeClient(script), bridge, message: 'get me ready to record vocals' });
  assert.strictEqual(res.proposedActions.length, 1);
  assert.strictEqual(res.proposedActions[0].type, 'armTrack');
  assert.match(res.message, /Lead Vocal/);
  assert.strictEqual(res.requiresConfirmation, true);
});

test('runAgent returns null without a client', async () => {
  const res = await runAgent({ client: null, bridge: new MockBridge(), message: 'hi' });
  assert.strictEqual(res, null);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/agentPlanner.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the loop**

Create `server/services/agentPlanner.js`:

```js
const { buildTools } = require('./toolRegistry');
const { buildAgentContext } = require('./agentContext');

let Anthropic = null;
try { Anthropic = require('@anthropic-ai/sdk'); } catch (_e) { /* optional */ }

const MODEL = 'claude-sonnet-5';
const MAX_TURNS = 6;

const AGENT_SYSTEM_PROMPT = `You are SessionPilot, an AI recording engineer embedded in the REAPER DAW, helping a solo recording artist.

You can inspect the session with READ tools (get_session_state, list_takes, get_track_fx, get_fx_parameters) — call these freely; they run immediately and return live data.

To CHANGE the session you call WRITE tools (arm/record/create/workflow_*/etc). These are NOT executed immediately — they are added to a plan the user must confirm. So: inspect with reads, then call the write tools for every step you intend, in order, then write a short natural-language summary of the plan. Prefer the highest-level tool that fits (a workflow_* over many low-level actions).

Guidelines:
- Be concise and concrete; mention real track/section names from the state.
- Never invent track ids — read the state to find them, or omit trackId to mean the selected track.
- If the request is a question, answer it from the reads and propose no writes.
- If the request is ambiguous, ask one clarifying question and propose no writes.`;

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !Anthropic) return null;
  return new Anthropic({ apiKey });
}

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
        catch (e) { out = { error: String(e && e.message || e) }; }
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out).slice(0, 6000) });
      } else if (def && def.kind === 'write') {
        proposedActions.push(def.toAction(tu.input || {}));
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id,
          content: JSON.stringify({ queued: true, note: 'Added to the plan; runs after the user confirms.' }) });
      } else {
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true,
          content: JSON.stringify({ error: 'unknown tool ' + tu.name }) });
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/agentPlanner.test.js`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add server/services/agentPlanner.js test/agentPlanner.test.js
git commit -m "Add AI-mode agent planner: tool-use loop (reads live, writes as plan)"
```

---

### Task 4: Wire the agent into chatOrchestrator (mode branch + fast-path)

**Goal:** In AI mode, route non-trivial messages to `runAgent`; keep the deterministic classifier as the free fast-path for high-confidence commands (and for all of default mode). The `__workflow__` proposed-action type from workflow tools is normalized into a real preview.

**Files:**
- Modify: `server/services/chatOrchestrator.js` (mode branch; ~line 240 `processMessage`)
- Modify: `server/services/agentPlanner.js` (add `expandWorkflowActions` helper OR do it in orchestrator — see step)
- Test: `test/chatOrchestrator.agent.test.js`

**Acceptance Criteria:**
- [ ] In default mode, behavior is unchanged (existing rule-based path)
- [ ] In AI mode, a trivial command (`"stop"`) still routes through the deterministic classifier (no agent call)
- [ ] In AI mode, a non-trivial message routes to `runAgent` and its `proposedActions` are returned
- [ ] A `__workflow__` proposed action is expanded to a real workflow preview before returning

**Verify:** `node --test test/chatOrchestrator.agent.test.js` → all pass

**Steps:**

- [ ] **Step 1: Add a fast-path predicate**

Trivial commands should skip the agent even in AI mode. Add to `chatOrchestrator.js`:

```js
// Intents cheap and unambiguous enough to always run deterministically.
const FAST_PATH_INTENTS = new Set([
  'transport_play', 'transport_stop', 'transport_pause', 'transport_record',
  'transport_goto_start', 'transport_goto_end', 'transport_goto_bar',
  'arm_track', 'disarm_track', 'mute_track', 'solo_track', 'toggle_monitoring',
  'undo', 'redo', 'goto_marker'
]);
```

- [ ] **Step 2: Write the failing test**

Create `test/chatOrchestrator.agent.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
process.env.USER_PROFILE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sp-')), 'p.json');

const MockBridge = require('../server/bridge/MockReaperBridge');
const userProfile = require('../server/services/userProfile');
const orchestrator = require('../server/services/chatOrchestrator');

test('AI mode routes a non-trivial message to the agent', async () => {
  await userProfile.updateField('assistantMode', 'ai');
  const bridge = new MockBridge();
  // Inject a fake agent so no network call happens.
  const fakeAgent = async () => ({
    message: 'Planned it.',
    proposedActions: [{ type: 'createTrack', args: { name: 'Harmony' } }],
    requiresConfirmation: true
  });
  const res = await orchestrator.processMessage(bridge, 'build me a harmony stack over the hook',
    { sessionId: 's1', __agentOverride: fakeAgent });
  assert.strictEqual(res.context.route, 'agent');
  assert.strictEqual(res.proposedActions[0].type, 'createTrack');
});

test('AI mode keeps trivial commands deterministic', async () => {
  await userProfile.updateField('assistantMode', 'ai');
  const bridge = new MockBridge();
  let agentCalled = false;
  const fakeAgent = async () => { agentCalled = true; return { message: '', proposedActions: [] }; };
  const res = await orchestrator.processMessage(bridge, 'stop',
    { sessionId: 's2', __agentOverride: fakeAgent });
  assert.strictEqual(agentCalled, false);
  assert.notStrictEqual(res.context.route, 'agent');
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `node --test test/chatOrchestrator.agent.test.js`
Expected: FAIL — orchestrator doesn't branch on mode/agent yet.

- [ ] **Step 4: Add the mode branch to processMessage**

In `server/services/chatOrchestrator.js`, require the agent and profile at top:

```js
const { runAgent } = require('./agentPlanner');
const userProfile = require('./userProfile');
const { createAssistantResponse } = require('../models');
```

Inside `processMessage`, after intake handling and after computing `matchedIntent`, insert the AI-mode branch **before** the existing planner/rule-based block:

```js
const profile = await userProfile.load();
const isFastPath = matchedIntent && FAST_PATH_INTENTS.has(matchedIntent.intent);
if (profile.assistantMode === 'ai' && !isFastPath) {
  const agentFn = options.__agentOverride || runAgent;
  const agentResult = await agentFn({ bridge, message, history: [] });
  if (agentResult) {
    const proposedActions = await expandWorkflowActions(bridge, agentResult.proposedActions);
    response = createAssistantResponse({
      message: agentResult.message,
      proposedActions,
      requiresConfirmation: agentResult.requiresConfirmation,
      actionType: agentResult.requiresConfirmation ? 'needs_confirmation' : 'advice',
      context: { route: 'agent', intent: 'agent' }
    });
  }
}
```

Ensure `response` is declared before this block and that the existing `if (!response) { ... }` fallback still runs when the agent returns null (no key). Then apply the existing `response.context = {...sessionSummary}` and `rememberTurn` tail as today.

- [ ] **Step 5: Add `expandWorkflowActions`**

Still in `chatOrchestrator.js`, add:

```js
// Turn agent __workflow__ placeholders into real workflow previews; pass other
// actions through untouched.
async function expandWorkflowActions(bridge, actions) {
  const out = [];
  for (const a of actions || []) {
    if (a.type === '__workflow__') {
      const preview = await workflowService.previewWorkflow(bridge, a.workflow, a.args || {});
      if (preview.ok && preview.data && preview.data.proposedActions) {
        out.push(...preview.data.proposedActions);
      }
    } else {
      out.push(a);
    }
  }
  return out;
}
```

(`workflowService` is already required in this file.)

- [ ] **Step 6: Run to verify it passes**

Run: `node --test test/chatOrchestrator.agent.test.js`
Expected: PASS (2/2). Also run the full suite: `node --test` → all green.

- [ ] **Step 7: Commit**

```bash
git add server/services/chatOrchestrator.js test/chatOrchestrator.agent.test.js
git commit -m "Route AI-mode messages to the agent; keep trivial commands deterministic"
```

---

### Task 5: Frontend mode toggle

**Goal:** A visible toggle (styled like the existing voice toggle) that flips between Default and AI mode, persists via `/api/assistant-mode`, and reflects the current mode on load.

**Files:**
- Modify: `public/index.html` (add toggle button near the voice controls)
- Create: `public/components/modeToggle.js`
- Modify: `public/app.js` (initialize the toggle)

**Acceptance Criteria:**
- [ ] On load, the toggle shows the current mode from `GET /api/assistant-mode`
- [ ] Clicking it flips the mode and POSTs the new value
- [ ] The label clearly reads "Default" vs "AI Engineer"

**Verify:** Manual — load `http://localhost:3000`, click the toggle, confirm the network POST and the label change (checked in Task 7 smoke).

**Steps:**

- [ ] **Step 1: Add the toggle element**

In `public/index.html`, near the voice control buttons, add:

```html
<button id="mode-toggle" class="mode-toggle" title="Switch assistant mode">Mode: Default</button>
```

- [ ] **Step 2: Implement the component**

Create `public/components/modeToggle.js`:

```js
export function initModeToggle() {
  const btn = document.getElementById('mode-toggle');
  if (!btn) return;
  let mode = 'default';

  function render() {
    btn.textContent = mode === 'ai' ? 'Mode: AI Engineer' : 'Mode: Default';
    btn.classList.toggle('mode-ai', mode === 'ai');
  }

  async function setMode(next) {
    const res = await fetch('/api/assistant-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: next })
    }).then((r) => r.json());
    if (res.ok) { mode = res.data.mode; render(); }
  }

  btn.addEventListener('click', () => setMode(mode === 'ai' ? 'default' : 'ai'));

  fetch('/api/assistant-mode').then((r) => r.json()).then((res) => {
    if (res.ok) { mode = res.data.mode; render(); }
  });
}
```

- [ ] **Step 3: Initialize it**

In `public/app.js`, import and call during startup:

```js
import { initModeToggle } from './components/modeToggle.js';
// ... inside the app init sequence:
initModeToggle();
```

- [ ] **Step 4: Add minimal styling**

In `public/styles.css`, add:

```css
.mode-toggle { padding: 6px 12px; border-radius: 6px; cursor: pointer; }
.mode-toggle.mode-ai { background: #6c3ce7; color: #fff; }
```

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/components/modeToggle.js public/app.js public/styles.css
git commit -m "Add AI/Default mode toggle to the UI"
```

---

### Task 6: Frontend multi-step plan preview/confirm

**Goal:** When the agent returns several `proposedActions`, render them as an ordered, confirmable plan (reuse the existing action-preview/confirm components; extend to a list) so the user approves the whole sequence before anything runs.

**Files:**
- Modify: `public/components/actionCards.js` (render an ordered list when >1 action)
- Modify: `public/components/chat.js` (pass the full proposedActions array through)
- Modify: `public/modules/actionQueue.js` (execute an approved multi-action plan in order)

**Acceptance Criteria:**
- [ ] A response with N proposed actions shows N numbered steps and one "Confirm plan" control
- [ ] Confirming executes the actions in order via the existing `/api/actions/execute`
- [ ] A single-action response behaves exactly as today

**Verify:** Manual — in Task 7 smoke, send a multi-step request in AI mode and confirm the numbered plan runs top-to-bottom.

**Steps:**

- [ ] **Step 1: Render a numbered plan**

In `public/components/actionCards.js`, where a single proposed action is rendered, branch on count. Add:

```js
export function renderPlan(actions, onConfirm, onCancel) {
  const wrap = document.createElement('div');
  wrap.className = 'action-plan';
  actions.forEach((a, i) => {
    const row = document.createElement('div');
    row.className = 'plan-step';
    row.textContent = `${i + 1}. ${a.label || a.type}`;
    wrap.appendChild(row);
  });
  const confirm = document.createElement('button');
  confirm.textContent = `Confirm plan (${actions.length} steps)`;
  confirm.onclick = () => onConfirm(actions);
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.onclick = () => onCancel && onCancel();
  wrap.appendChild(confirm);
  wrap.appendChild(cancel);
  return wrap;
}
```

- [ ] **Step 2: Use it from chat rendering**

In `public/components/chat.js`, when a response has `proposedActions.length > 1`, call `renderPlan(proposedActions, executePlan)`; otherwise keep the existing single-action card path.

- [ ] **Step 3: Execute the plan in order**

In `public/modules/actionQueue.js`, add:

```js
export async function executePlan(actions) {
  for (const a of actions) {
    await fetch('/api/actions/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionType: a.type, args: a.args || {} })
    }).then((r) => r.json());
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add public/components/actionCards.js public/components/chat.js public/modules/actionQueue.js
git commit -m "Render and execute multi-step agent plans with a single confirmation"
```

---

### Task 7: Docs, env, and end-to-end smoke

**Goal:** Document the mode and its env, and verify the whole thing against a live server with a real (or stubbed) LLM.

**Files:**
- Modify: `README.md` (document AI mode + env)
- Modify: `.env.example` (note that AI mode needs `ANTHROPIC_API_KEY` and credits)
- Create: `docs/superpowers/plans/2026-07-03-ai-mode-agent.md` (this file — already exists)

**Acceptance Criteria:**
- [ ] `npm test` runs the whole suite green
- [ ] README explains Default vs AI mode, the fast-path, the confirm-before-write safety model, and cost (Sonnet 5 + prompt caching)
- [ ] Manual smoke: with a valid key, toggling AI mode and sending "set me up to record a harmony stack over the hook" returns a multi-step plan that executes on confirm

**Verify:** `npm test` → all pass; then the manual smoke below.

**Steps:**

- [ ] **Step 1: Update README**

Add an "Assistant Modes" section to `README.md`: Default (deterministic, fast, free) vs AI Engineer (agentic; reads state live, proposes multi-step plans you confirm; trivial commands stay instant). Note: AI mode requires `ANTHROPIC_API_KEY` with credits; uses `claude-sonnet-5` with prompt caching; writes always require confirmation.

- [ ] **Step 2: Update .env.example**

Add a comment under `ANTHROPIC_API_KEY`: `# Required for AI mode (agent). Account must have API credits.`

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all test files pass.

- [ ] **Step 4: Manual smoke (real LLM)**

Start the server (`USE_REAL_BRIDGE=1 npm start` with a funded key), open the UI, toggle **AI Engineer**, and send: `set me up to record a harmony stack over the hook`. Expected: a numbered plan (create track(s), arm, etc.); confirming runs it in order. Also send a question — `which tracks have no FX?` — expect a text answer with **no** proposed actions. Send `stop` — expect instant deterministic stop (no agent latency).

- [ ] **Step 5: Commit**

```bash
git add README.md .env.example
git commit -m "Document AI mode and finalize; full test suite green"
```

---

## Self-Review

**Spec coverage:**
- Toggleable mode, default preserved → Task 0 (setting) + Task 5 (toggle) + Task 4 (branch). ✓
- Deterministic fast-path inside AI mode → Task 4 `FAST_PATH_INTENTS`. ✓
- Full toolset via tool use, never stale → Task 1 registry + parity test. ✓
- Rich context → Task 2. ✓
- Multi-step planning → Task 3 (loop) + Task 6 (UI). ✓
- Auto-execute reads / confirm writes → Task 3 (reads live, writes queued) + Task 6 (confirm). ✓
- Sonnet 5 + prompt caching → Task 3 (`MODEL`, `cache_control` on system + tools). ✓

**Placeholder scan:** One deliberate, test-enforced gap — `WRITE_ACTIONS` in Task 1 ships a representative subset and the parity test FAILS until the engineer adds the rest; this is TDD-driven completion, not a silent placeholder (Step 5 calls it out explicitly).

**Type consistency:** `runAgent({ client, bridge, message, history })` used consistently in Task 3 and Task 4. `proposedActions` items are `{ type, args }` (or `{ type:'__workflow__', workflow, args }`) throughout; `expandWorkflowActions` (Task 4) consumes the latter. `buildTools()` → `{ tools, byName }` used in Tasks 1 and 3. `buildAgentContext(bridge)` → string, used in Tasks 2 and 3.

**Risk to verify during execution:** confirm `contextBuilder.buildSessionContext` health-warning shape (Task 2 Step 4) and that `chatOrchestrator.processMessage` declares `response` before the new branch (Task 4 Step 4).
