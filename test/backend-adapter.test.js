const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global;
const config = require('../app-config.js');
global.TP_CONFIG = config;
global.TPCore = require('../core.js');
global.TPAdmin = require('../admin-core.js');
const BE = require('../backend-adapter.js');

const UUID = '123e4567-e89b-42d3-a456-426614174000';

test('isConfigured requires https URL and a real anon key', () => {
  assert.equal(BE.isConfigured({}), false);
  assert.equal(BE.isConfigured({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'TUTAJ_KLUCZ' }), false);
  assert.equal(BE.isConfigured({ SUPABASE_URL: 'http://x', SUPABASE_ANON_KEY: 'k' }), false);
  assert.equal(BE.isConfigured({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'k' }), true);
});

test('authEndpoint defaults to the auth-telegram function', () => {
  assert.equal(BE.authEndpoint({ SUPABASE_URL: 'https://x.supabase.co/' }), 'https://x.supabase.co/functions/v1/auth-telegram');
  assert.equal(BE.authEndpoint({ SUPABASE_URL: 'https://x.supabase.co', AUTH_ENDPOINT: 'https://a/b' }), 'https://a/b');
});

test('sessionValid honours expiry (seconds, ms or ISO)', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  assert.equal(BE.sessionValid(null, now), false);
  assert.equal(BE.sessionValid({ token: 't', expires_at: '2026-01-01T01:00:00Z' }, now), true);
  assert.equal(BE.sessionValid({ token: 't', expires_at: '2025-12-31T00:00:00Z' }, now), false);
  assert.equal(BE.sessionValid({ token: 't', expires_at: now / 1000 + 3600 }, now), true);
  assert.equal(BE.sessionValid({ token: 't', expires_at: now / 1000 - 5 }, now), false);
});

test('userFromRow maps server numbers and keeps UI-only local fields', () => {
  const base = global.TPCore.newUser({ id: 7, username: 'loc' });
  base.avatar_url = 'data:image/png;base64,AAA'; base.avatar_custom = true;
  const u = BE.userFromRow({ telegram_id: 7, username: 'srv', avatar_url: 'https://a/b.png', xp: 520, stars: 12, balance: '1.5', clicks: 40, tasks_completed: 3,
    referral_claimed: [10], last_daily: '2026-01-01T00:00:00Z', settings: { language: 'en' }, created_at: '2026-01-01T00:00:00Z' },
  { rig: ['gpu', 'bogus', 'gpu'], referralCount: 11, paidParts: ['ram'] }, base);
  assert.equal(u.id, 7);
  assert.equal(u.username, 'srv');
  assert.equal(u.avatar_url, 'data:image/png;base64,AAA');
  assert.equal(u.xp_total, 520);
  assert.equal(u.level, 2);
  assert.equal(u.stars, 12);
  assert.equal(u.wallet_balance, 1.5);
  assert.equal(u.referral_count, 11);
  assert.deepEqual(u.referral_claimed, [10]);
  assert.deepEqual(u.rig_parts, ['desk', 'gpu', 'ram']);
  assert.equal(u.settings.language, 'en');
  assert.equal(u.settings.privacy.show_online, true);
});

test('profilePatch never contains progression columns', () => {
  const u = global.TPCore.newUser({ id: 1, username: 'a' });
  u.xp_total = 9999; u.stars = 9999; u.wallet_balance = 9999;
  const patch = BE.profilePatch(u);
  ['xp', 'stars', 'balance', 'xp_total', 'wallet_balance', 'clicks'].forEach((k) => assert.equal(k in patch, false));
  assert.equal(patch.username, 'a');
  u.avatar_url = 'data:image/png;base64,' + 'A'.repeat(3000);
  assert.equal('avatar_url' in BE.profilePatch(u), false);
});

test('claimedFromTasks and mapTransaction', () => {
  assert.deepEqual(BE.claimedFromTasks([{ task_id: 'a', status: 'claimed' }, { task_id: 'b', status: 'started' }]), ['a']);
  const tx = BE.mapTransaction({ id: '1', type: 'withdraw_request', amount: '2.5', status: 'pending', created_at: 'x' });
  assert.equal(tx.type, 'withdraw');
  assert.equal(tx.amount, 2.5);
});

test('task rows round-trip', () => {
  const row = BE.taskToRow({ id: 'earn_xp', title: 'T', goal: 50, rewardStars: 10, metric: 'xp_total', enabled: false }, 2, 9);
  assert.equal(row.published, false);
  assert.equal(row.sort_order, 2);
  const t = BE.taskFromRow(row);
  assert.deepEqual([t.id, t.goal, t.rewardStars, t.rewardXp, t.metric, t.enabled], ['earn_xp', 50, 10, 0, 'xp_total', false]);
});

test('posts: row mapping, scheduled status and local likes preserved', () => {
  const post = { id: UUID, admin_id: 5, content: 'hi', images: [], videos: [], links: [], likes: [1], comments: [{ id: 'c' }], likes_count: 1, comments_count: 1, created_at: '2026-01-01T00:00:00Z', published: false, scheduled_at: '2026-02-01T00:00:00Z' };
  const row = BE.postToRow(post, 5);
  assert.equal(row.status, 'published');
  assert.equal('likes' in row.payload, false);
  assert.equal(BE.postToRow(Object.assign({}, post, { scheduled_at: null }), 5).status, 'draft');
  const merged = BE.mergePosts([row, Object.assign({}, row, { id: 'x', status: 'trashed' })], [post]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].content, 'hi');
  assert.equal(merged[0].published, false);
  assert.deepEqual(merged[0].likes, [1]);
});

test('notification rows round-trip', () => {
  const n = { id: UUID, title: 'T', message: 'M', link: 'https://x.y' };
  const back = BE.notificationFromRow(BE.notificationToRow(n));
  assert.equal(back.title, 'T');
  assert.equal(back.message, 'M');
  assert.equal(back.link, 'https://x.y');
});

test('contentToState applies remote admin state and tasks; settingsRows mirror server-side numbers', () => {
  const local = global.TPAdmin.defaultState();
  const remoteState = { phase: 2, flags: { chat: true, bonus: true, rig: true, wallet: false, shop: false, airdrop: false }, config: { xp_timer_hours: 6, xp_timer_reward: 30, xp_multiplier: 2 }, events: [{ id: 'e', title: 'E' }] };
  const next = BE.contentToState(local, { admin_state: remoteState, tasks: [{ id: 't', title: 'T', goal: 1, reward_stars: 5, reward_xp: 0, metric: 'clicks', published: true }] });
  assert.equal(next.phase, 2);
  assert.equal(next.flags.wallet, false);
  assert.equal(next.events.length, 1);
  assert.equal(next.tasks[0].id, 't');
  const rows = BE.settingsRows(next, 5), by = {};
  rows.forEach((r) => { by[r.key] = r.value; });
  assert.deepEqual(by.xp_timer, { hours: 6, xp: 60 });
  assert.deepEqual(by.daily, { xp: 20 });
  assert.equal(by.xp_multiplier, 2);
  assert.deepEqual(by.referral_milestones[0], { count: 10, xp: 100 });
  assert.equal(by.rig_prices.gpu, 40);
  assert.equal(BE.contentToState(local, {}).phase, 0);
});

test('leadersFromRows maps to app leader shape', () => {
  const l = BE.leadersFromRows([{ telegram_id: 3, username: 'x', xp: 10, last_seen_at: 'now' }]);
  assert.deepEqual(l[0], { id: 3, username: 'x', avatar_url: '', xp_total: 10, last_active: 'now' });
});

const BEx = require('../backend-adapter.js');
test('backendMode: local / remote / offline', () => {
  assert.equal(BEx.backendMode({}, {}), 'local');
  const sec = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'k' };
  assert.equal(BEx.backendMode(sec, {}), 'remote');
  assert.equal(BEx.backendMode(sec, { disabled: true }), 'local');
  assert.equal(BEx.backendMode(sec, { failures: 3 }), 'offline');
});
test('verifiedIdentity uses the server user id and sanitizes role', () => {
  assert.equal(BEx.verifiedIdentity(null), null);
  assert.equal(BEx.verifiedIdentity({ token: 't', user: { id: 'x' } }), null);
  const v = BEx.verifiedIdentity({ token: 't', role: 'root', user: { id: '42' }, expires_at: 9 });
  assert.equal(v.id, 42);
  assert.equal(v.role, 'user');
  assert.equal(BEx.verifiedIdentity({ token: 't', role: 'owner', user: { id: 1 } }).role, 'owner');
});
test('adminAllowed: server role wins once signed in, ADMIN_IDS hint otherwise', () => {
  const sec = { ADMIN_IDS: [7] };
  const good = { token: 't', role: 'admin', expires_at: Date.now() / 1000 + 600 };
  assert.equal(BEx.adminAllowed(sec, 7, null, true), true);
  assert.equal(BEx.adminAllowed(sec, 8, null, true), false);
  assert.equal(BEx.adminAllowed(sec, 7, Object.assign({}, good, { role: 'user' }), true), false);
  assert.equal(BEx.adminAllowed(sec, 1, good, true), true);
  assert.equal(BEx.adminAllowed(sec, 1, Object.assign({}, good, { role: 'user' }), true), false);
  assert.equal(BEx.adminAllowed(sec, 7, null, false), true);
  assert.equal(BEx.adminAllowed(sec, 8, null, false), false);
});
test('isStale, error classification and retryDelay', () => {
  assert.equal(BEx.isStale(0, 1e6), true);
  assert.equal(BEx.isStale(900, 1000, 500), false);
  assert.equal(BEx.isAuthError(401), true);
  assert.equal(BEx.isAuthError(500), false);
  assert.equal(BEx.isTransient({ status: 503 }), true);
  assert.equal(BEx.isTransient({ status: 400 }), false);
  assert.equal(BEx.isTransient(new Error('network')), true);
  assert.equal(BEx.retryDelay(0), 1000);
  assert.equal(BEx.retryDelay(10), 30000);
});

test('mergePosts: keepUnsynced retains local posts missing on the server, never trashed ones', () => {
  const rows = [
    { id: 'a', status: 'published', body: 'A', created_at: '2026-01-02T00:00:00Z', payload: {} },
    { id: 'b', status: 'trashed', body: 'B', created_at: '2026-01-01T00:00:00Z', payload: {} }
  ];
  const local = [
    { id: 'b', content: 'B', created_at: '2026-01-01T00:00:00Z' },
    { id: 'c', content: 'C', created_at: '2026-01-03T00:00:00Z' }
  ];
  assert.deepEqual(BEx.mergePosts(rows, local).map((p) => p.id), ['a']);
  assert.deepEqual(BEx.mergePosts(rows, local, { keepUnsynced: true }).map((p) => p.id), ['c', 'a']);
});
