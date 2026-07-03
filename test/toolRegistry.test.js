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

test('resolveTrackId falls back to the selected track when nothing is supplied', async () => {
  const MockReaperBridge = require('../server/bridge/MockReaperBridge');
  const bridge = new MockReaperBridge();

  // Pick a real track and select it.
  const tracks = (await bridge.listTracks()).data;
  const target = tracks[2];
  await bridge.selectTrack({ trackId: target.id });

  // No trackId / trackIndex / target — should resolve to the selected track.
  const resolved = await actions.resolveTrackId(bridge, {});
  assert.strictEqual(resolved, target.id);

  // Reproduction of the original bug: muteTrack({}) previously errored with
  // "Track not found: null". With the fallback it now succeeds.
  const muteArgs = { trackId: await actions.resolveTrackId(bridge, {}), enabled: true };
  const result = await bridge.muteTrack(muteArgs);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.data.id, target.id);
});
