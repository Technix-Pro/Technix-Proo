const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Backend = require('../backend-adapter.js');

test('checked-in config defines safe placeholders and boots in local mode', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'config.js'), 'utf8'), { window });
  const config = window.TECHNIX_CONFIG;
  assert.ok(config);
  assert.match(config.SUPABASE_URL, /^https:\/\//);
  assert.equal(config.SUPABASE_ANON_KEY, 'TUTAJ');
  assert.equal(config.AUTH_ENDPOINT, '');
  assert.deepEqual(Array.from(config.ADMIN_IDS), []);
  assert.equal(config.BOT_USERNAME, 'TUTAJ');
  assert.equal(config.BOT_ID, 'TUTAJ');
  assert.equal(config.DEV_MODE, false);
  assert.equal(Backend.isConfigured(config), false);
});

test('example config uses the same placeholder-only offline defaults', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'config.example.js'), 'utf8'), { window });
  assert.equal(Backend.isConfigured(window.TECHNIX_CONFIG), false);
  assert.deepEqual(Array.from(window.TECHNIX_CONFIG.ADMIN_IDS), []);
});
