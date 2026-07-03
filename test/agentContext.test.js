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

test('buildAgentContext includes per-track monitoring/fx/take info', async () => {
  const bridge = new MockBridge();
  const result = await buildAgentContext(bridge);
  // Lead Vocal is armed + monitoring on + has fx + has takes in the mock seed.
  assert.match(result, /Lead Vocal[^\n]*armed/);
  assert.match(result, /mon/i);
  assert.match(result, /ReaEQ/);
  assert.match(result, /takes=3/);
});

test('buildAgentContext includes health warnings when present', async () => {
  const bridge = new MockBridge();
  // Force a health-triggering state: recording with no armed tracks.
  bridge._tracks.forEach((t) => { t.isArmed = false; });
  bridge._transportState = 'recording';
  const ctx = await buildAgentContext(bridge);
  assert.match(ctx, /Health warnings:/);
  assert.match(ctx, /error:Recording but no tracks armed/);
});

test('buildAgentContext works without throwing and reports ok health when clean', async () => {
  const bridge = new MockBridge();
  const ctx = await buildAgentContext(bridge);
  assert.ok(typeof ctx === 'string' && ctx.length > 0);
});
