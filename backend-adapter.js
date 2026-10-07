// Pure mapping between Supabase rows and the app's local shapes (users, tasks, posts, notifications, settings). No DOM / network.
// Unit-tested in test/backend-adapter.test.js.
(function (root) {
  var CFG = root.TP_CONFIG || (typeof require === 'function' ? require('./app-config.js') : null);
  var Core = root.TPCore || (typeof require === 'function' ? require('./core.js') : null);
  var Admin = root.TPAdmin || (typeof require === 'function' ? require('./admin-core.js') : null);

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function isUuid(v) { return typeof v === 'string' && UUID_RE.test(v); }
  function num(v, fallback) { var n = Number(v); return isFinite(n) ? n : fallback; }

  function isConfigured(sec) {
    sec = sec || {};
    return /^https:\/\//.test(sec.SUPABASE_URL || '') && !!sec.SUPABASE_ANON_KEY && String(sec.SUPABASE_ANON_KEY).indexOf('TUTAJ') === -1;
  }

  function authEndpoint(sec) {
    if (sec && sec.AUTH_ENDPOINT) return sec.AUTH_ENDPOINT;
    return sec && sec.SUPABASE_URL ? sec.SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/auth-telegram' : '';
  }

  function isAdminRole(role) { return role === 'admin' || role === 'owner'; }

  function sessionValid(session, nowMs) {
    if (!session || !session.token) return false;
    var exp = typeof session.expires_at === 'number' ? session.expires_at * (session.expires_at < 1e12 ? 1000 : 1) : Date.parse(session.expires_at);
    return !isFinite(exp) || exp - 30000 > (nowMs || Date.now());
  }

  // Single source of truth for the data source: 'local' (no usable config / feature off), 'remote' (signed-in or anonymous reads work), 'offline' (configured but recent requests failing).
  function backendMode(sec, state) {
    state = state || {};
    if (!isConfigured(sec) || state.disabled) return 'local';
    return num(state.failures, 0) >= 3 ? 'offline' : 'remote';
  }

  // The server-verified identity wins over whatever id the client claimed; null when the response is unusable.
  function verifiedIdentity(res) {
    var id = res && res.user ? Number(res.user.id) : NaN;
    if (!res || !res.token || !isFinite(id) || id <= 0) return null;
    return { id: id, role: isAdminRole(res.role) ? res.role : 'user', user: res.user, token: res.token, expires_at: res.expires_at };
  }

  // Admin UI is gated by the server role when a backend login is expected; ADMIN_IDS is only an offline/mock hint.
  function adminAllowed(sec, id, session, expectServer, nowMs) {
    if (expectServer) return sessionValid(session, nowMs) && isAdminRole(session.role);
    return !!sec && Array.isArray(sec.ADMIN_IDS) && sec.ADMIN_IDS.map(Number).indexOf(Number(id)) !== -1;
  }

  function isStale(ts, nowMs, maxAgeMs) {
    var t = typeof ts === 'number' ? ts : Date.parse(ts);
    return !isFinite(t) || (nowMs || Date.now()) - t > (maxAgeMs == null ? 300000 : maxAgeMs);
  }

  // Auth failures (expired/invalid JWT) are retried once after re-authenticating; 5xx/network errors are transient.
  function isAuthError(status) { return status === 401 || status === 403; }
  function isTransient(err) { return !err || !err.status || err.status >= 500 || err.status === 429 || err.status === 408; }
  function retryDelay(attempt) { return Math.min(30000, 1000 * Math.pow(2, Math.max(0, attempt || 0))); }

  /* ----- user ----- */
  function claimedFromTasks(rows) {
    return (Array.isArray(rows) ? rows : []).filter(function (r) { return r && r.status === 'claimed'; }).map(function (r) { return r.task_id; });
  }

  function mapTransaction(row) {
    return { id: row.id, type: String(row.type || '').replace(/_request$/, ''), amount: num(row.amount, 0), status: row.status || 'pending', created_at: row.created_at };
  }

  // Merges the authoritative DB row (plus rig/referral extras) over the local user (kept for UI-only fields such as custom avatar/settings).
  function userFromRow(row, extras, base) {
    extras = extras || {};
    var rigKeys = CFG.RIG_PARTS.map(function (p) { return p.key; });
    var u = Object.assign(Core.newUser({ id: row.telegram_id, username: row.username, photo_url: row.avatar_url }, row.created_at), base || {});
    u.id = Number(row.telegram_id);
    if (row.username) u.username = row.username;
    if (row.avatar_url && !u.avatar_custom) u.avatar_url = row.avatar_url;
    u.xp_total = Math.max(0, num(row.xp, 0));
    u.stars = Math.max(0, num(row.stars, 0));
    u.wallet_balance = Math.max(0, num(row.balance, 0));
    u.clicks = Math.max(num(row.clicks, 0), 0);
    u.tasks_completed = num(row.tasks_completed, 0);
    u.referral_count = num(extras.referralCount, 0);
    u.referral_claimed = (row.referral_claimed || []).map(Number);
    u.referred_by = row.referred_by == null ? u.referred_by : Number(row.referred_by);
    u.last_xp_claim = row.last_xp_claim || null;
    u.last_daily = row.last_daily || null;
    u.ton_keeper_connected = !!row.ton_keeper_connected;
    if (row.settings && typeof row.settings === 'object' && Object.keys(row.settings).length) {
      var d = Core.newUser({ id: u.id }).settings;
      u.settings = { notifications: Object.assign({}, d.notifications, row.settings.notifications), privacy: Object.assign({}, d.privacy, row.settings.privacy), language: row.settings.language || d.language };
    }
    var parts = ['desk'].concat(extras.rig || [], extras.paidParts || []);
    u.rig_parts = parts.filter(function (p, i) { return rigKeys.indexOf(p) !== -1 && parts.indexOf(p) === i; });
    Core.addXp(u, 0);
    return u;
  }

  // Only profile-safe columns are ever sent; xp/stars/balance are server-controlled.
  function profilePatch(user) {
    var patch = { username: user.username, settings: user.settings, ton_keeper_connected: !!user.ton_keeper_connected };
    if (user.avatar_url && String(user.avatar_url).length < 2000) patch.avatar_url = user.avatar_url;
    if (user.settings && user.settings.language) patch.language_code = user.settings.language;
    return patch;
  }

  /* ----- tasks ----- */
  function taskFromRow(row) {
    return { id: row.id, title: row.title, goal: num(row.goal, 1), rewardXp: num(row.reward_xp, 0), rewardStars: num(row.reward_stars, 0), metric: row.metric || 'tasks_completed', enabled: row.published !== false };
  }
  function taskToRow(t, index, adminId) {
    return { id: String(t.id), title: String(t.title || t.id), kind: 'metric', reward_stars: Math.max(0, Math.round(num(t.rewardStars, 0))), reward_xp: Math.max(0, Math.round(num(t.rewardXp, 0))),
      metric: t.metric || null, goal: Math.max(0, Math.round(num(t.goal, 1))), sort_order: index, published: t.enabled !== false, created_by: adminId || null, updated_at: new Date().toISOString() };
  }

  /* ----- posts ----- */
  function postFromRow(row) {
    var pl = row.payload && typeof row.payload === 'object' ? row.payload : {};
    var published = typeof pl.published === 'boolean' ? pl.published : row.status === 'published';
    return Object.assign({ images: [], videos: [], links: [], likes: [], comments: [], likes_count: 0, comments_count: 0 }, pl, {
      id: row.id, admin_id: row.author_id, content: pl.content != null ? pl.content : row.body || '', published: published, created_at: pl.created_at || row.created_at
    });
  }
  // Scheduled posts need status 'published' so RLS lets users read them; the client still honours scheduled_at / published.
  function postToRow(p, adminId) {
    var payload = Object.assign({}, p);
    delete payload.likes; delete payload.comments; delete payload.likes_count; delete payload.comments_count;
    return { id: p.id, author_id: p.admin_id || adminId || null, body: p.content || '', kind: 'text', status: p.published || p.scheduled_at ? 'published' : 'draft',
      published_at: p.published ? p.created_at : null, payload: payload, created_at: p.created_at, updated_at: new Date().toISOString() };
  }
  // Keeps local likes/comments (not yet server-backed) when replacing posts with the remote list.
  // opts.keepUnsynced (admin): local posts the server does not know yet (write still in flight / failed) are kept instead of being dropped.
  function mergePosts(remoteRows, localPosts, opts) {
    var local = {}, known = {};
    (localPosts || []).forEach(function (p) { local[p.id] = p; });
    var out = (remoteRows || []).filter(function (r) { known[r.id] = true; return r.status !== 'trashed'; }).map(function (r) {
      var p = postFromRow(r), l = local[p.id];
      if (l) { p.likes = l.likes || []; p.comments = l.comments || []; p.likes_count = p.likes.length; p.comments_count = p.comments.length; }
      return p;
    });
    if (opts && opts.keepUnsynced) (localPosts || []).forEach(function (p) { if (!known[p.id]) out.push(p); });
    return out.sort(function (a, b) { return Date.parse(b.created_at) - Date.parse(a.created_at) || 0; });
  }

  /* ----- notifications ----- */
  function notificationFromRow(row) {
    var pl = row.payload && typeof row.payload === 'object' ? row.payload : {};
    return Object.assign({ message: row.body || '' }, pl, { id: row.id, title: row.title });
  }
  function notificationToRow(n) {
    return { id: n.id, title: String(n.title || ''), body: n.message || null, published: true, payload: n };
  }

  /* ----- admin state <-> app_settings ----- */
  function contentToState(state, content) {
    content = content || {};
    var next = Admin.normalizeState(state);
    var remote = content.admin_state;
    if (remote && typeof remote === 'object') {
      var n = Admin.normalizeState(remote);
      next.phase = n.phase; next.flags = n.flags; next.config = n.config; next.events = n.events;
    }
    if (Array.isArray(content.tasks) && content.tasks.length) next.tasks = content.tasks.map(taskFromRow);
    return next;
  }

  // Rows written by an admin so that the server-side RPCs (rewards, prices, thresholds) use the same numbers as the admin panel.
  function settingsRows(state, adminId) {
    var s = Admin.normalizeState(state), c = Admin.effectiveConfig(s), now = new Date().toISOString();
    function row(key, value, pub) { return { key: key, value: value, is_public: pub !== false, updated_by: adminId || null, updated_at: now }; }
    return [
      row('admin_state', { phase: s.phase, flags: s.flags, config: s.config, events: s.events }),
      row('xp_timer', { hours: c.xpTimerHours, xp: Admin.scaleXp(c.xpTimerReward, c.xpMultiplier) }),
      row('daily', { xp: Admin.scaleXp(c.dailyReward, c.xpMultiplier) }),
      row('xp_multiplier', c.xpMultiplier),
      row('rig_prices', c.rigPrices),
      row('click_thresholds', c.clicks),
      row('referral_milestones', c.milestones.map(function (m) { return { count: m.count, xp: m.rewardXp }; }))
    ];
  }

  function settingsToMap(rows) {
    var out = {};
    (rows || []).forEach(function (r) { out[r.key] = r.value; });
    return out;
  }

  function leadersFromRows(rows) {
    return (rows || []).map(function (r) {
      return { id: Number(r.telegram_id), username: r.username || 'User', avatar_url: r.avatar_url || '', xp_total: num(r.xp, 0), last_active: r.last_seen_at || new Date(0).toISOString() };
    });
  }

  var api = {
    isUuid: isUuid, isConfigured: isConfigured, authEndpoint: authEndpoint, isAdminRole: isAdminRole, sessionValid: sessionValid,
    backendMode: backendMode, verifiedIdentity: verifiedIdentity, adminAllowed: adminAllowed, isStale: isStale, isAuthError: isAuthError,
    isTransient: isTransient, retryDelay: retryDelay, claimedFromTasks: claimedFromTasks, mapTransaction: mapTransaction, userFromRow: userFromRow, profilePatch: profilePatch,
    taskFromRow: taskFromRow, taskToRow: taskToRow, postFromRow: postFromRow, postToRow: postToRow, mergePosts: mergePosts,
    notificationFromRow: notificationFromRow, notificationToRow: notificationToRow, contentToState: contentToState,
    settingsRows: settingsRows, settingsToMap: settingsToMap, leadersFromRows: leadersFromRows
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TPBackend = api;
})(typeof window !== 'undefined' ? window : globalThis);
