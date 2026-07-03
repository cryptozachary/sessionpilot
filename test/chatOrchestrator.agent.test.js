const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
process.env.USER_PROFILE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sp-')), 'p.json');

const MockBridge = require('../server/bridge/MockReaperBridge');
const userProfile = require('../server/services/userProfile');
const sessionMemory = require('../server/services/sessionMemory');
const orchestrator = require('../server/services/chatOrchestrator');

// Intake runs on the first message of a new session unless the message is
// already a recognized command. These tests use non-command phrasing on
// purpose (to exercise the agent path), so pre-mark intake complete for the
// session the same way the orchestrator itself would once intake finishes.
function markIntakeComplete(sessionId) {
  sessionMemory.updateIntake(sessionId, {
    started: true,
    complete: true,
    answers: {},
    currentQuestion: null
  });
}

test('AI mode routes a non-trivial message to the agent', async () => {
  await userProfile.updateField('assistantMode', 'ai');
  markIntakeComplete('s1');
  const bridge = new MockBridge();
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

test('default mode does not call the agent', async () => {
  await userProfile.updateField('assistantMode', 'default');
  markIntakeComplete('s3');
  const bridge = new MockBridge();
  let agentCalled = false;
  const fakeAgent = async () => { agentCalled = true; return { message: '', proposedActions: [] }; };
  const res = await orchestrator.processMessage(bridge, 'build me a harmony stack over the hook',
    { sessionId: 's3', __agentOverride: fakeAgent });
  assert.strictEqual(agentCalled, false);
});

test('AI mode expands a __workflow__ proposed action into a real workflow preview', async () => {
  await userProfile.updateField('assistantMode', 'ai');
  markIntakeComplete('s4');
  const bridge = new MockBridge();
  const fakeAgent = async () => ({
    message: 'Setting up the lead vocal.',
    proposedActions: [{ type: '__workflow__', workflow: 'setupLeadVocal', args: {} }],
    requiresConfirmation: true
  });
  const res = await orchestrator.processMessage(bridge, 'set me up for vocals however you think is best',
    { sessionId: 's4', __agentOverride: fakeAgent });
  assert.strictEqual(res.context.route, 'agent');
  assert.ok(res.proposedActions.length > 0);
  assert.notStrictEqual(res.proposedActions[0].type, '__workflow__');
});
