const test = require('node:test');
const assert = require('node:assert/strict');

function setup(fetchImpl, sec) {
  const values = new Map();
  global.localStorage = new Proxy({
    getItem(k) { return values.has(k) ? values.get(k) : null; },
    setItem(k, v) { values.set(k, String(v)); },
    removeItem(k) { values.delete(k); }
  }, { ownKeys: () => [...values.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
  global.window = { TECHNIX_CONFIG: sec, crypto: require('node:crypto').webcrypto, addEventListener() {} };
  global.window.TP_CONFIG = require('../app-config.js');
  global.window.TPCore = require('../core.js');
  global.window.TPAdmin = require('../admin-core.js');
  global.window.TPBackend = require('../backend-adapter.js');
  global.fetch = fetchImpl;
  delete require.cache[require.resolve('../data.js')];
  require('../data.js');
  return global.window.TPData;
}

const SEC = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' };
const json = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

test('without backend config the data layer stays local', async () => {
  const calls = [];
  const data = setup((...a) => { calls.push(a); return json([]); }, {});
  assert.equal(data.remoteEnabled, false);
  assert.equal(await data.bootstrap({ id: 1 }, 'initData'), null);
  assert.equal(await data.action('tp_claim_daily'), null);
  assert.equal(calls.length, 0);
});

test('backend mode: authenticates, loads progress + admin content, and actions refresh from the server', async () => {
  const serverUser = { telegram_id: 42, username: 'srv', xp: 600, stars: 30, balance: 0, clicks: 0, tasks_completed: 1, referral_claimed: [], settings: {}, created_at: '2026-01-01T00:00:00Z' };
  const calls = [];
  const data = setup((url, opts) => {
    calls.push({ url, opts });
    if (url.endsWith('/functions/v1/auth-telegram')) return json({ token: 'jwt', expires_at: Math.floor(Date.now() / 1000) + 3600, role: 'user' });
    if (url.includes('/users?telegram_id=eq.42')) return json([serverUser]);
    if (url.includes('/rig_parts_owned')) return json([{ part_id: 'gpu' }]);
    if (url.includes('/user_tasks')) return json([{ task_id: 'earn_xp', status: 'claimed' }]);
    if (url.includes('/referrals')) return json([{ id: 'a' }, { id: 'b' }]);
    if (url.includes('/wallet_transactions')) return json([{ id: 't', type: 'deposit_request', amount: 1, status: 'pending', created_at: 'x' }]);
    if (url.includes('/tasks?select')) return json([{ id: 'only', title: 'Only', goal: 1, reward_stars: 1, reward_xp: 0, metric: 'clicks', published: true }]);
    if (url.includes('/app_settings')) return json([{ key: 'admin_state', value: { phase: 2, flags: { wallet: false }, config: {}, events: null } }]);
    if (url.includes('/posts?')) return json([{ id: 'p1', status: 'published', body: 'hello', created_at: '2026-01-01T00:00:00Z', payload: {} }]);
    if (url.includes('/notifications?')) return json([]);
    if (url.includes('rpc/tp_leaderboard')) return json([{ telegram_id: 1, username: 'top', xp: 99999 }]);
    if (url.includes('rpc/')) return json(serverUser);
    return json([], 404);
  }, SEC);
  assert.equal(data.remoteEnabled, true);
  const res = await data.bootstrap({ id: 42, username: 'srv' }, 'query_id=1&user=%7B%7D&hash=x');
  assert.equal(res.user.xp_total, 600);
  assert.equal(res.user.referral_count, 2);
  assert.deepEqual(res.user.rig_parts, ['desk', 'gpu']);
  assert.deepEqual(res.claimed, ['earn_xp']);
  assert.equal(res.contentChanged, true);
  assert.equal(data.getAdminState().tasks[0].id, 'only');
  assert.equal(data.getAdminState().flags.wallet, false);
  assert.equal(data.getPosts()[0].content, 'hello');
  assert.equal(data.transactions(42)[0].type, 'deposit');
  assert.equal(data.leaders()[0].username, 'top');
  const auth = calls.find((c) => c.url.endsWith('/auth-telegram'));
  assert.equal(JSON.parse(auth.opts.body).initData, 'query_id=1&user=%7B%7D&hash=x');
  assert.equal(calls.find((c) => c.url.includes('/users?telegram_id')).opts.headers.Authorization, ['Bearer', 'jwt'].join(' '));

  let synced = null;
  data.onSynced = (r) => { synced = r; };
  const before = calls.length;
  await data.action('tp_claim_daily');
  assert.ok(calls.slice(before).some((c) => c.url.endsWith('/rpc/tp_claim_daily') && c.opts.method === 'POST'));
  assert.equal(synced.user.xp_total, 600);
});

test('backend failure falls back to local data without throwing', async () => {
  const data = setup(() => Promise.reject(new Error('offline')), SEC);
  const res = await data.bootstrap({ id: 5 }, 'initData');
  assert.equal(res.user, null);
  const u = data.loadUser({ id: 5, username: 'loc' });
  assert.equal(u.xp_total, 0);
  assert.equal(await data.action('tp_claim_daily'), null);
  assert.equal(data.leaders().length, 10);
});

test('non-admin session never writes admin content', async () => {
  const calls = [];
  const data = setup((url, opts) => {
    calls.push({ url, opts });
    if (url.endsWith('/auth-telegram')) return json({ token: 'jwt', expires_at: Math.floor(Date.now() / 1000) + 3600, role: 'user' });
    return json([]);
  }, SEC);
  await data.bootstrap({ id: 9 }, 'initData');
  const before = calls.length;
  data.savePosts([{ id: '123e4567-e89b-42d3-a456-426614174000', content: 'x', created_at: 'now', published: true }]);
  data.saveAdminState(data.getAdminState());
  assert.equal(calls.length, before);
});
