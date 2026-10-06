const test = require('node:test');
const assert = require('node:assert');
const C = require('../core.js');

test('level thresholds', () => {
  const t = [[0, 1], [499, 1], [500, 2], [1500, 3], [3500, 4], [7000, 5], [12000, 6], [20000, 7], [99999, 7]];
  t.forEach(([xp, lvl]) => assert.strictEqual(C.levelFor(xp).level, lvl));
});

test('progress to next level', () => {
  const p = C.progress(250);
  assert.strictEqual(p.xpToNext, 250);
  assert.strictEqual(p.percent, 50);
  assert.strictEqual(C.progress(30000).next, null);
});

test('new user starts at zero', () => {
  const u = C.newUser({ id: 123456, username: 'abc' });
  assert.strictEqual(u.xp_total, 0);
  assert.strictEqual(u.wallet_balance, 0);
  assert.strictEqual(u.level, 1);
  assert.strictEqual(u.id, 123456);
});

test('referral code round-trips', () => {
  const code = C.referralCode(987654321);
  assert.strictEqual(C.parseReferralCode(code), 987654321);
  assert.ok(C.referralLink(5, 'Bot').includes('ref_' + C.referralCode(5)));
});

test('referral milestones are claimed once', () => {
  const u = C.newUser({ id: 1 });
  u.referral_count = 20;
  assert.strictEqual(C.claimReferralMilestones(u).length, 2);
  assert.strictEqual(u.xp_total, 350);
  assert.strictEqual(C.claimReferralMilestones(u).length, 0);
});

test('timer cooldown', () => {
  const u = C.newUser({ id: 1 });
  const now = Date.now();
  assert.ok(C.claimTimer(u, now).ok);
  assert.ok(!C.claimTimer(u, now + 3600000).ok);
  assert.ok(C.claimTimer(u, now + 4 * 3600000 + 1).ok);
  assert.strictEqual(u.xp_total, 40);
});

test('task claim requires goal and is single-use', () => {
  const u = C.newUser({ id: 1 });
  const task = TP().TASKS[0];
  const claimed = [];
  assert.ok(!C.claimTask(u, task, claimed, {}).ok);
  C.addXp(u, 60);
  assert.ok(C.claimTask(u, task, claimed, {}).ok);
  assert.strictEqual(u.stars, 10);
  assert.ok(!C.claimTask(u, task, claimed, {}).ok);
});

test('validation helpers', () => {
  assert.strictEqual(C.safeUrl('javascript:alert(1)'), null);
  assert.ok(C.safeUrl('https://example.com'));
  assert.ok(!C.validateAmount(-1).ok);
  assert.ok(!C.validateAmount(5, 1).ok);
  assert.strictEqual(C.parseInitData('user=' + encodeURIComponent('{"id":42}')).id, 42);
  assert.strictEqual(C.parseInitData('garbage'), null);
});

function TP() { return require('../app-config.js'); }
