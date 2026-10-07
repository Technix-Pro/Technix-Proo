const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engagement.js');
const FX = require('../effects.js');

const iso = (d) => new Date(d).toISOString();

test('streak: +1 per day, same-day login is idempotent, miss resets quietly', () => {
  let r = E.updateStreak(null, '2026-01-01T10:00:00Z');
  assert.deepEqual([r.status, r.record.current_streak, r.bonusXp], ['new', 1, 0]);
  r = E.updateStreak(r.record, '2026-01-01T22:00:00Z');
  assert.equal(r.status, 'same');
  r = E.updateStreak(r.record, '2026-01-02T01:00:00Z');
  assert.deepEqual([r.status, r.record.current_streak], ['continued', 2]);
  r = E.updateStreak(r.record, '2026-01-05T01:00:00Z');
  assert.deepEqual([r.status, r.record.current_streak, r.record.max_streak], ['reset', 1, 2]);
  assert.equal(r.record.reset_at, iso('2026-01-05T01:00:00Z'));
});

test('streak: bonus only on day 7/14/30', () => {
  let rec = null, bonuses = {};
  for (let d = 0; d < 31; d++) {
    const r = E.updateStreak(rec, new Date(Date.UTC(2026, 0, 1 + d, 12)));
    rec = r.record;
    if (r.bonusXp) bonuses[rec.current_streak] = r.bonusXp;
  }
  assert.deepEqual(Object.keys(bonuses), ['7', '14', '30']);
  assert.equal(rec.current_streak, 31);
});

test('leaderboard: weeks start Monday, everyone starts equal, rotation snapshots the old week', () => {
  assert.equal(E.weekKey('2026-01-07T12:00:00Z'), '2026-01-05');
  assert.equal(E.weekKey('2026-01-11T23:59:00Z'), '2026-01-05');
  const users = [{ id: 1, username: 'a', xp_total: 900 }, { id: 2, username: 'b', xp_total: 10 }];
  let r = E.rotateLeaderboard(null, users, '2026-01-07T00:00:00Z');
  assert.equal(r.rotated, false);
  assert.deepEqual(E.weeklyScores(users, r.state).map((x) => x.score), [0, 0]);
  users[1].xp_total = 60;
  users.push({ id: 3, username: 'c', xp_total: 0 });
  r = E.rotateLeaderboard(r.state, users, '2026-01-08T00:00:00Z');
  users[2].xp_total = 20;
  const ranked = E.weeklyScores(users, r.state);
  assert.deepEqual(ranked.map((x) => [x.id, x.score]), [[2, 50], [3, 20], [1, 0]]);
  const next = E.rotateLeaderboard(r.state, users, '2026-01-13T00:00:00Z');
  assert.equal(next.rotated, true);
  assert.equal(next.snapshot.week_start, '2026-01-05');
  assert.equal(next.snapshot.rows[0].id, 2);
  assert.deepEqual(E.weeklyScores(users, next.state).map((x) => x.score), [0, 0, 0]);
});

test('community milestones unlock once', () => {
  const defs = [{ id: 'xp_1k', metric: 'total_xp', target: 1000 }, { id: 'users_10', metric: 'users', target: 10 }];
  let r = E.detectMilestones(defs, [], { total_xp: 400, users: 3 }, '2026-01-01T00:00:00Z');
  assert.equal(r.unlocked.length, 0);
  r = E.detectMilestones(defs, r.milestones, { total_xp: 1500, users: 3 }, '2026-01-02T00:00:00Z');
  assert.deepEqual(r.unlocked.map((m) => m.id), ['xp_1k']);
  const again = E.detectMilestones(defs, r.milestones, { total_xp: 1600, users: 3 }, '2026-01-03T00:00:00Z');
  assert.equal(again.unlocked.length, 0);
  assert.equal(again.milestones[0].unlocked_at, iso('2026-01-02T00:00:00Z'));
});

test('anti-bot: humans pass, machine-regular or extreme rates get a temporary cooldown only', () => {
  let s = null, t = 0, ok = true;
  for (let i = 0; i < 100; i++) { t += 150 + (i * 37) % 400; const r = E.checkAction(s, t); s = r.state; ok = ok && r.allowed; }
  assert.equal(ok, true);
  s = null; t = 1000; let blocked = null;
  for (let i = 0; i < 40 && !blocked; i++) { t += 100; const r = E.checkAction(s, t); s = r.state; if (!r.allowed) blocked = r; }
  assert.equal(blocked.reason, 'regular');
  assert.equal(E.checkAction(s, t + 1000).reason, 'cooldown');
  assert.equal(E.checkAction(s, t + E.BOT_RULES.cooldownMs + 1).allowed, true, 'cooldown expires, no ban');
});

test('sponsor validation, activity window and disclosure', () => {
  const ok = E.validateSponsor({ name: ' Acme ', link: 'https://acme.test', logo_url: 'https://acme.test/l.png', start_date: '2026-01-01', end_date: '2026-01-31T23:59:59Z', created_by: 1 });
  assert.equal(ok.ok, true);
  assert.equal(ok.sponsor.name, 'Acme');
  assert.deepEqual(E.validateSponsor({ name: '', link: 'javascript:alert(1)', start_date: 'x', end_date: 'y' }).errors, ['name', 'link', 'start', 'end']);
  assert.deepEqual(E.validateSponsor({ name: 'A', link: 'https://a.test', start_date: '2026-02-01', end_date: '2026-01-01' }).errors, ['range']);
  const s = Object.assign({}, ok.sponsor, { id: 's1' });
  assert.equal(E.sponsorActive(s, '2026-01-15'), true);
  assert.equal(E.sponsorActive(s, '2026-03-01'), false);
  assert.equal(E.sponsorFor({ sponsor_id: 's1' }, [s], '2026-01-15').name, 'Acme');
  assert.equal(E.sponsorFor({ sponsor_id: 's1' }, [s], '2026-03-01'), null);
  assert.equal(E.sponsorFor({}, [s], '2026-01-15'), null);
  assert.equal(E.disclosure(s), 'Wspierane przez Acme');
});

test('sponsor CRUD data round-trip through the admin store', () => {
  const values = new Map();
  global.localStorage = { getItem: (k) => (values.has(k) ? values.get(k) : null), setItem: (k, v) => values.set(k, v), removeItem: (k) => values.delete(k) };
  const prev = global.window;
  global.window = { TP_CONFIG: require('../app-config.js'), TPCore: require('../core.js'), TPAdmin: require('../admin-core.js'), crypto: require('node:crypto').webcrypto, addEventListener() {} };
  delete require.cache[require.resolve('../data.js')];
  try {
    require('../data.js');
    const D = global.window.TPData;
    const v = E.validateSponsor({ name: 'Acme', link: 'https://acme.test', start_date: '2026-01-01', end_date: '2026-02-01' });
    const rec = Object.assign({ id: D.newId() }, v.sponsor);
    D.saveList('sponsors', [rec]);
    assert.equal(D.getList('sponsors').length, 1);
    D.saveList('sponsors', D.getList('sponsors').map((s) => Object.assign({}, s, { name: 'Acme 2' })));
    assert.equal(D.getList('sponsors')[0].name, 'Acme 2');
    D.saveList('sponsors', D.getList('sponsors').filter((s) => s.id !== rec.id));
    assert.equal(D.getList('sponsors').length, 0);
    D.saveStore('premium:1', { tier: 'monthly' });
    assert.equal(D.getStore('premium:1', null).tier, 'monthly');
  } finally { global.window = prev; }
});

test('cosmetic packs: type/config validated, only safe values kept; premium expiry', () => {
  assert.equal(E.validateCosmetic({ name: 'x', type: 'weapon', config: {} }).error, 'type');
  assert.equal(E.validateCosmetic({ name: 'x', type: 'border', config: '{bad' }).error, 'config');
  const r = E.validateCosmetic({ name: 'Neon', type: 'border', config: '{"color":"#fff","evil":"url(javascript:x)<","n":2}' });
  assert.deepEqual(r.cosmetic.config, { color: '#fff', n: 2 });
  assert.equal(E.premiumActive({ tier: 'monthly', expires_at: '2026-02-01T00:00:00Z' }, '2026-01-01'), true);
  assert.equal(E.premiumActive({ tier: 'monthly', expires_at: '2026-02-01T00:00:00Z' }, '2026-03-01'), false);
  assert.equal(E.premiumActive(null, '2026-01-01'), false);
});

test('CSV exports escape quotes, newlines and formula injection; analytics aggregate only', () => {
  assert.equal(E.csvCell('a,"b"'), '"a,""b"""');
  assert.equal(E.csvCell('=1+1'), "'=1+1");
  const sponsors = [{ id: 's1', name: '=HYPERLINK("x")', link: 'https://a.test', start_date: '2026-01-01T00:00:00.000Z', end_date: '2026-01-31T00:00:00.000Z' }];
  const posts = [{ sponsor_id: 's1', created_at: '2026-01-10T00:00:00Z', likes: [1, 2], comments: [{}] }, { created_at: '2026-01-10T00:00:00Z' }];
  const csv = E.sponsorReportCsv(sponsors, '2026-01', E.sponsorPostStats(posts, '2026-01'));
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 2);
  assert.match(lines[1], /^"'=HYPERLINK/);
  assert.ok(lines[1].endsWith(',yes,1,2,1,0'));
  const users = [{ id: 1, created_at: '2025-12-01T00:00:00Z' }, { id: 2, created_at: '2025-12-02T00:00:00Z' }, { id: 3, created_at: '2026-01-02T00:00:00Z' }];
  const activity = { 1: '2026-01-05T10:00:00Z', 3: '2026-01-05T11:00:00Z' };
  assert.deepEqual(E.retention(users, activity, '2026-01'), { cohort: 2, retained: 1, percent: 50 });
  assert.deepEqual(E.dailyActive(activity, '2026-01'), [['2026-01-05', 2]]);
  const a = E.analyticsCsv('2026-01', users, activity);
  assert.ok(a.includes('daily_active_users,2026-01-05,2'));
  assert.ok(!a.includes('"1"'), 'no per-user identifiers');
});

function fakeRoot(reduce) {
  const created = [];
  const el = () => ({ className: '', style: { setProperty() {} }, children: [], setAttribute() {}, appendChild(c) { this.children.push(c); }, classList: { add() {}, remove() {} }, offsetWidth: 0 });
  return {
    created,
    matchMedia: (q) => ({ matches: reduce && /prefers-reduced-motion/.test(q) }),
    setTimeout: () => 0,
    document: { body: { appendChild(c) { created.push(c); } }, createElement: () => el(), getElementById: () => el() }
  };
}

test('animations honour prefers-reduced-motion', () => {
  const src = require('node:fs').readFileSync(require.resolve('../effects.js'), 'utf8');
  const load = (root) => { const g = new Function('root', 'module', src.replace(/\}\)\(typeof window[^\n]*\n?$/, '})(root);')); const m = { exports: {} }; g(root, m); return root.TPEffects; };
  const calm = load(fakeRoot(true));
  assert.equal(calm.confetti({ count: 20 }), false);
  assert.equal(calm.celebrate('streak'), false);
  assert.equal(calm.celebrate('levelup', {}), false);
  assert.equal(calm.glow({}), false);
  const rootOn = fakeRoot(false), on = load(rootOn);
  assert.equal(on.confetti({ count: 20, rain: true }), true);
  assert.equal(rootOn.created[0].children.length, 20);
  assert.equal(FX.particles(20, true).length, 20);
});

test('stylesheet: all new animations are disabled for reduced motion and use 300ms fades', () => {
  const css = require('node:fs').readFileSync(require.resolve('../styles.css'), 'utf8');
  assert.match(css, /prefers-reduced-motion: reduce\) \{[^}]*\.tp-glow::after[\s\S]*?animation: none/);
  assert.match(css, /\.tp-fade-in \{ animation: tpFadeIn 300ms cubic-bezier/);
  assert.match(css, /\.tp-shake \{ animation: tpShake 300ms/);
  assert.match(css, /confetti-piece[^}]*animation: confetti-burst 1\.5s/);
});
