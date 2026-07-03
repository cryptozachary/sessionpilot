const { test } = require('node:test');
const assert = require('node:assert');
const MockBridge = require('../server/bridge/MockReaperBridge');
const { runAgent } = require('../server/services/agentPlanner');

// Fake client: each call to messages.create returns the next scripted response.
function fakeClient(script) {
  let i = 0;
  return { messages: { create: async () => script[i++] } };
}

test('runAgent executes reads live and records writes as a plan', async () => {
  const bridge = new MockBridge();

  // Snapshot the Lead Vocal track's armed state before running the agent, so
  // we can assert the write tool never touched the bridge.
  const before = (await bridge.listTracks()).data.find((t) => t.name === 'Lead Vocal');
  const wasArmedBefore = before.isArmed;

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

  // The write tool must NOT have executed on the bridge.
  const after = (await bridge.listTracks()).data.find((t) => t.name === 'Lead Vocal');
  assert.strictEqual(after.isArmed, wasArmedBefore, 'armTrack write tool must not mutate the bridge');
});

test('runAgent stops when the model returns no tool calls', async () => {
  const bridge = new MockBridge();
  const script = [
    { stop_reason: 'end_turn', content: [
      { type: 'text', text: 'The session has 8 tracks; Lead Vocal is armed and monitoring.' }
    ] }
  ];
  const res = await runAgent({ client: fakeClient(script), bridge, message: 'how many tracks do I have?' });
  assert.strictEqual(res.proposedActions.length, 0);
  assert.strictEqual(res.requiresConfirmation, false);
  assert.match(res.message, /8 tracks/);
});

test('runAgent stops after MAX_TURNS even if the model keeps calling tools', async () => {
  const bridge = new MockBridge();
  // Always returns a tool_use for a read tool - would loop forever without a cap.
  const client = {
    messages: {
      create: async () => ({
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'x', name: 'get_session_state', input: {} }]
      })
    }
  };
  const res = await runAgent({ client, bridge, message: 'loop forever' });
  assert.strictEqual(res.proposedActions.length, 0);
  assert.strictEqual(typeof res.message, 'string');
});

test('runAgent returns null without a client', async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const res = await runAgent({ client: null, bridge: new MockBridge(), message: 'hi' });
  assert.strictEqual(res, null);
  if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
});
