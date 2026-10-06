const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../core.js');
const A = require('../admin-core.js');

test('admin permission check relies on ADMIN_IDS only', () => {
  assert.equal(A.isAdminId(42, [42, '7']), true);
  assert.equal(A.isAdminId('7', [42, 7]), true);
  assert.equal(A.isAdminId(43, [42]), false);
  assert.equal(A.isAdminId(0, [0]), false);
  assert.equal(A.isAdminId(42, []), false);
  assert.equal(A.isAdminId(42, undefined), false);
});

test('phase presets match the launch plan', () => {
  assert.deepEqual(A.PHASES[1].features, { chat: false, bonus: false, rig: false, wallet: false, shop: false, airdrop: false });
  assert.deepEqual(A.PHASES[2].features, { chat: true, bonus: true, rig: true, wallet: false, shop: false, airdrop: false });
  assert.deepEqual(A.PHASES[3].features, { chat: true, bonus: true, rig: true, wallet: true, shop: true, airdrop: true });
});

test('deploying a phase requires admin and updates flags + record', () => {
  const s = A.defaultState();
  assert.equal(A.deployPhase(s, 2, { isAdmin: false }).reason, 'forbidden');
  assert.equal(A.deployPhase(s, 9, { isAdmin: true }).reason, 'unknown_phase');
  const r = A.deployPhase(s, 2, { isAdmin: true, adminId: 42, now: '2026-01-01T00:00:00.000Z', id: 'x' });
  assert.equal(r.ok, true);
  assert.equal(r.state.phase, 2);
  assert.equal(r.state.flags.wallet, false);
  assert.equal(r.state.flags.chat, true);
  assert.deepEqual([r.record.number, r.record.deployed_by, r.record.deployed_at], [2, 42, '2026-01-01T00:00:00.000Z']);
  assert.equal(s.phase, 0, 'input state is not mutated');
});

test('feature visibility: admin sees everything, users follow flags', () => {
  const p1 = A.deployPhase(A.defaultState(), 1, { isAdmin: true }).state;
  ['chat', 'bonus', 'rig', 'wallet'].forEach((f) => {
    assert.equal(A.featureVisible(p1, f, false), false);
    assert.equal(A.featureVisible(p1, f, true), true);
  });
  assert.equal(A.featureVisible(p1, 'channel', false), true);
  assert.equal(A.featureVisible(A.defaultState(), 'wallet', false), true, 'legacy installs keep all features');
});

test('setFlag requires admin and a known feature', () => {
  const s = A.defaultState();
  assert.equal(A.setFlag(s, 'chat', false, { isAdmin: false }).reason, 'forbidden');
  assert.equal(A.setFlag(s, 'nope', false, { isAdmin: true }).reason, 'unknown_feature');
  assert.equal(A.setFlag(s, 'chat', false, { isAdmin: true }).state.flags.chat, false);
});

test('normalizeState repairs corrupt storage', () => {
  assert.deepEqual(A.normalizeState(null), A.defaultState());
  const s = A.normalizeState({ phase: 99, flags: { chat: 'no', rig: false }, tasks: 'x' });
  assert.equal(s.phase, 0);
  assert.equal(s.flags.chat, true);
  assert.equal(s.flags.rig, false);
  assert.equal(s.tasks, null);
});

test('effective config clamps admin-supplied values', () => {
  const c = A.effectiveConfig({ config: { xp_multiplier: 9, xp_timer_hours: 0, referral_scale: 2, rig_prices: { gpu: 55, desk: 99 } } });
  assert.equal(c.xpMultiplier, 2);
  assert.equal(c.xpTimerHours, 1);
  assert.equal(c.rigPrices.gpu, 55);
  assert.equal(c.rigPrices.desk, 0);
  assert.equal(c.milestones[0].rewardXp, 200);
  assert.equal(A.effectiveConfig(A.defaultState()).xpTimerHours, 4);
  assert.equal(A.scaleXp(20, 0.5), 10);
});

test('click thresholds: +5 per 100, +50 per 1000, achievement at 10000', () => {
  assert.deepEqual(A.clickReward(0, 99), { xp: 0, lootbox: false, achievement: false });
  assert.deepEqual(A.clickReward(99, 100), { xp: 5, lootbox: false, achievement: false });
  assert.deepEqual(A.clickReward(999, 1000), { xp: 50, lootbox: true, achievement: false });
  assert.deepEqual(A.clickReward(9999, 10000), { xp: 50, lootbox: true, achievement: true });
  assert.equal(A.clickReward(0, 1000).xp, 9 * 5 + 50);
});

test('scheduled posts become visible to users when due', () => {
  const now = Date.parse('2026-01-02T00:00:00Z');
  assert.equal(A.postVisible({ published: false }, false, now), false);
  assert.equal(A.postVisible({ published: false }, true, now), true);
  assert.equal(A.postVisible({ published: true }, false, now), true);
  assert.equal(A.postVisible({ published: false, scheduled_at: '2026-01-03T00:00:00Z' }, false, now), false);
  assert.equal(A.postVisible({ published: false, scheduled_at: '2026-01-01T00:00:00Z' }, false, now), true);
});

test('post validation accepts only safe media', () => {
  assert.equal(A.validatePost({ content: '' }, 100).error, 'empty');
  const r = A.validatePost({ content: ' hi ', images: 'https://x.io/a.png\njavascript:alert(1)\nhttps://x.io/a.svg', videos: 'https://x.io/v.mp4\nhttps://x.io/v.avi', links: 'https://x.io', attachments: ['data:image/jpeg;base64,AAAA', 'data:text/html;base64,AAAA'] }, 100);
  assert.equal(r.ok, true);
  assert.deepEqual(r.post.images, ['https://x.io/a.png', 'data:image/jpeg;base64,AAAA']);
  assert.deepEqual(r.post.videos, ['https://x.io/v.mp4']);
  assert.equal(r.invalid, 3);
  assert.equal(A.validatePost({ content: 'a', scheduled_at: 'nope' }).error, 'bad_date');
});

test('trash and restore posts', () => {
  const posts = [{ id: 'a' }, { id: 'b' }];
  const t = A.trashPost(posts, [], 'a', 42, 'now', 't1');
  assert.deepEqual(t.posts, [{ id: 'b' }]);
  assert.equal(t.trash[0].original_post_id, 'a');
  assert.equal(t.trash[0].deleted_by, 42);
  const r = A.restorePost(t.posts, t.trash, 't1', 'later');
  assert.equal(r.posts.length, 2);
  assert.equal(r.trash[0].restored_at, 'later');
  assert.equal(A.restorePost(r.posts, r.trash, 't1', 'x').ok, false);
});

test('task and event validation', () => {
  assert.equal(A.validateTask({ id: 't', title: '', goal: 1, metric: 'xp_total' }).error, 'title');
  assert.equal(A.validateTask({ id: 't', title: 'x', goal: 1, metric: 'bad' }).error, 'metric');
  assert.equal(A.validateTask({ id: 't', title: 'x', goal: 0, metric: 'clicks' }).error, 'goal');
  const t = A.validateTask({ id: 't 1!', title: 'x', goal: '5', metric: 'clicks', rewardXp: 3, rewardStars: 2 });
  assert.equal(t.ok, true);
  assert.deepEqual([t.task.id, t.task.goal, t.task.enabled], ['t1', 5, true]);
  assert.equal(A.validateEvent({ id: 'e', title: 'E', starts_at: '2026-02-02', ends_at: '2026-02-01' }).error, 'date_order');
  assert.equal(A.validateEvent({ id: 'e', title: 'E', live: 1 }).event.live, true);
});

test('notification validation, status and pending list', () => {
  assert.equal(A.validateNotification({ title: 'a', message: '' }).error, 'empty');
  assert.equal(A.validateNotification({ title: 'a', message: 'b', link: 'javascript:1' }).error, 'link');
  assert.equal(A.validateNotification({ title: 'a', message: 'b', link: 'https://t.me/x' }).ok, true);
  const now = Date.parse('2026-01-02T00:00:00Z');
  assert.equal(A.notificationStatus({ scheduled_at: '2026-01-03T00:00:00Z' }, now), 'scheduled');
  assert.equal(A.notificationStatus({ scheduled_at: null }, now), 'sent');
  const list = [{ id: '1' }, { id: '2' }, { id: '3', scheduled_at: '2026-01-03T00:00:00Z' }, { id: '4', status: 'cancelled' }];
  assert.deepEqual(A.pendingNotifications(list, ['1'], now).map((n) => n.id), ['2']);
});

test('stats aggregate users, activity and phases', () => {
  const now = Date.parse('2026-01-10T00:00:00Z');
  const st = A.computeStats({
    users: [{ xp_total: 100, wallet_balance: 2, tasks_completed: 1, referral_count: 1 }, { xp_total: 300, wallet_balance: 0, tasks_completed: 3, referral_count: 0 }],
    activity: { 1: '2026-01-09T23:00:00Z', 2: '2026-01-05T00:00:00Z', 3: '2025-12-01T00:00:00Z' },
    transactions: [{ amount: 1.5 }, { amount: 2 }], taskStats: { a: 1, b: 4 },
    phases: [{ number: 2, deployed_at: '2026-01-04T00:00:00Z' }], online: 1
  }, now);
  assert.deepEqual([st.users, st.avgXp, st.totalXp, st.tasksCompleted, st.referrals, st.avgBalance, st.txVolume], [2, 200, 400, 4, 1, 1, 3.5]);
  assert.deepEqual([st.active24h, st.active7d], [1, 2]);
  assert.equal(st.topTasks[0].id, 'b');
  assert.equal(st.adoption, 67);
});

test('backup validation', () => {
  assert.equal(A.validateBackup(null).ok, false);
  assert.equal(A.validateBackup({ app: 'x' }).error, 'version');
  assert.equal(A.validateBackup({ app: 'technixpro-admin', version: 1, admin: {}, posts: [{ id: 1 }] }).error, 'posts');
  assert.equal(A.validateBackup({ app: 'technixpro-admin', version: 1, admin: {}, posts: [{ id: 'a' }] }).ok, true);
});

test('core claims honour admin overrides', () => {
  const u = Core.newUser({ id: 5 });
  assert.equal(Core.claimTimer(u, 1000, { hours: 1, reward: 7 }).xp, 7);
  assert.equal(Core.claimTimer(u, 1000 + 3600000 - 1, { hours: 1, reward: 7 }).ok, false);
  assert.equal(Core.claimTimer(u, 1000 + 3600000, { hours: 1, reward: 7 }).ok, true);
  assert.equal(Core.claimDaily(u, 1000, { reward: 3 }).xp, 3);
  u.referral_count = 10;
  Core.claimReferralMilestones(u, [{ count: 10, rewardXp: 123 }]);
  assert.equal(u.xp_total, 7 + 7 + 3 + 123);
});
