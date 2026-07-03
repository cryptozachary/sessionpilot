const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

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
