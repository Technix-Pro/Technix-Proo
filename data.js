// Versioned localStorage store + optional Supabase REST adapter. Falls back to local mock data when the backend is unavailable.
(function () {
  var CFG = window.TP_CONFIG, SEC = window.TECHNIX_CONFIG || {};
  var PREFIX = CFG.STORAGE_PREFIX + ':v' + CFG.STORAGE_VERSION + ':';
  var BE = window.TPBackend || (typeof require === 'function' ? require('./backend-adapter.js') : null);
  var remoteOn = BE.isConfigured(SEC);
  // Backend session (JWT from the auth-telegram Edge Function). Without it (no Telegram initData) the app stays in local/mock mode for progress.
  var session = null, authPromise = null, initDataRaw = '', currentId = null, syncedClicks = 0, leadersCache = null;
  var failures = 0, lastOkAt = 0, verified = null, REQUEST_TIMEOUT_MS = 12000, STALE_MS = 10 * 60000;
  var queue = Promise.resolve(), profileTimer = null, pendingUser = null;
  function noop() {}

  (function purgeOldVersions() {
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf(CFG.STORAGE_PREFIX + ':') === 0 && k.indexOf(PREFIX) !== 0) localStorage.removeItem(k);
      });
    } catch (e) { /* storage unavailable */ }
  })();

  var memory = {};
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return key in memory ? memory[key] : fallback; }
  }
  function write(key, value) {
    memory[key] = value;
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    var a = new Uint32Array(2);
    window.crypto.getRandomValues(a);
    return Date.now().toString(36) + a[0].toString(36) + a[1].toString(36);
  }

  function authenticate() {
    if (BE.sessionValid(session)) return Promise.resolve(session);
    if (!remoteOn || !initDataRaw) return Promise.reject(new Error('no auth'));
    if (authPromise) return authPromise;
    authPromise = fetch(BE.authEndpoint(SEC), {
      method: 'POST',
      headers: { apikey: SEC.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SEC.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: initDataRaw })
    }).then(function (r) {
      if (!r.ok) throw new Error('auth HTTP ' + r.status);
      return r.json();
    }).then(function (res) {
      authPromise = null;
      var ident = BE.verifiedIdentity(res);
      if (!ident) throw new Error('auth invalid response');
      verified = ident; currentId = ident.id;
      session = { token: ident.token, expires_at: ident.expires_at, role: ident.role };
      return session;
    }, function (e) { authPromise = null; throw e; });
    return authPromise;
  }
  function canSync() { return remoteOn && !!initDataRaw && !!currentId && !!verified; }
  function isAdminSession() { return BE.sessionValid(session) && BE.isAdminRole(session.role); }

  function remote(method, path, body) {
    if (!remoteOn || !CFG.FEATURES.realtime) return Promise.reject(new Error('remote off'));
    var pre = initDataRaw && !BE.sessionValid(session) ? authenticate().catch(noop) : Promise.resolve();
    return pre.then(function () { return request(method, path, body); }).then(null, function (err) {
      if (!BE.isAuthError(err && err.status) || !initDataRaw) throw err;
      session = null;
      return authenticate().then(function () { return request(method, path, body); });
    }).then(function (res) { failures = 0; lastOkAt = Date.now(); return res; }, function (err) {
      if (BE.isTransient(err)) failures++;
      throw err;
    });
  }
  function request(method, path, body) {
    return Promise.resolve().then(function () {
      var headers = {
        apikey: SEC.SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + (BE.sessionValid(session) ? session.token : SEC.SUPABASE_ANON_KEY),
        'Content-Type': 'application/json'
      };
      if (method === 'POST' && path.indexOf('rpc/') !== 0) headers.Prefer = 'return=representation,resolution=merge-duplicates';
      var ctl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, REQUEST_TIMEOUT_MS) : null;
      return fetch(SEC.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined })
        .then(function (r) { if (timer) clearTimeout(timer); return r; }, function (e) { if (timer) clearTimeout(timer); throw e; });
    }).then(function (r) {
      if (!r.ok) { var err = new Error('HTTP ' + r.status); err.status = r.status; throw err; }
      return r.status === 204 ? [] : r.json();
    });
  }
  function enqueue(fn) {
    var p = queue.then(fn, fn);
    queue = p.then(noop, noop);
    return p;
  }
  function inList(ids) { return '(' + ids.map(function (i) { return '"' + String(i).replace(/["\\]/g, '') + '"'; }).join(',') + ')'; }
  function quiet(p) { return p.then(null, noop); }

  function fetchUserBundle(id) {
    return Promise.all([
      remote('GET', 'users?telegram_id=eq.' + id + '&select=*'),
      remote('GET', 'rig_parts_owned?user_id=eq.' + id + '&select=part_id'),
      remote('GET', 'user_tasks?user_id=eq.' + id + '&select=task_id,status'),
      remote('GET', 'referrals?referrer_id=eq.' + id + '&select=id'),
      remote('GET', 'wallet_transactions?user_id=eq.' + id + '&order=created_at.desc&limit=50')
    ]).then(function (r) {
      if (!r[0] || !r[0][0]) throw new Error('no_user');
      var base = read('user:' + id, null);
      var user = BE.userFromRow(r[0][0], { rig: r[1].map(function (x) { return x.part_id; }), referralCount: r[3].length, paidParts: read('rig:paid:' + id, []) }, base);
      user.clicks = Math.max(user.clicks, base && base.clicks || 0);
      syncedClicks = Number(r[0][0].clicks) || 0;
      var claimed = BE.claimedFromTasks(r[2]);
      write('user:' + id, user);
      write('rig:' + id, user.rig_parts);
      write('claimed:' + id, claimed);
      write('tx:' + id, r[4].map(BE.mapTransaction));
      return { user: user, claimed: claimed };
    });
  }

  // Admin-managed content (tasks, posts, notifications, phases/flags/config/events) fetched for everyone; resolves true when anything changed.
  function fetchContent() {
    return Promise.all([
      quiet(remote('GET', 'tasks?select=*&order=sort_order.asc')),
      quiet(remote('GET', 'app_settings?select=key,value')),
      quiet(remote('GET', 'posts?select=*&order=created_at.desc&limit=100')),
      quiet(remote('GET', 'notifications?select=*&order=created_at.desc&limit=50'))
    ]).then(function (r) {
      var changed = false;
      function put(key, value) {
        var before = JSON.stringify(read(key, null));
        if (before !== JSON.stringify(value)) { write(key, value); changed = true; }
      }
      if (Array.isArray(r[0]) || Array.isArray(r[1])) {
        var map = BE.settingsToMap(Array.isArray(r[1]) ? r[1] : []);
        put('admin', BE.contentToState(Data.getAdminState(), { admin_state: map.admin_state, tasks: Array.isArray(r[0]) ? r[0] : null }));
      }
      if (Array.isArray(r[2])) put('posts', BE.mergePosts(r[2], read('posts', [])));
      if (Array.isArray(r[3])) put('admin:notifications', r[3].map(BE.notificationFromRow));
      return changed;
    });
  }

  function flushProfile() {
    var u = pendingUser;
    profileTimer = null; pendingUser = null;
    if (!u || !canSync() || Number(u.id) !== currentId) return Promise.resolve(null);
    return enqueue(function () {
      var chain = quiet(remote('PATCH', 'users?telegram_id=eq.' + u.id, BE.profilePatch(u)));
      if ((u.clicks || 0) > syncedClicks) {
        chain = chain.then(function () { return remote('POST', 'rpc/tp_sync_clicks', { p_clicks: Math.floor(u.clicks) }); })
          .then(function () { return Data.syncUser(); }, noop);
      }
      return chain;
    });
  }

  var MOCK_LEADERS = [
    ['Nova', 15200], ['Byte', 11800], ['Quark', 9400], ['Pixel', 7600], ['Cipher', 5100],
    ['Vector', 3900], ['Kernel', 2600], ['Nano', 1700], ['Delta', 900], ['Echo', 400]
  ].map(function (p, i) { return { id: -(i + 1), username: p[0], avatar_url: '', xp_total: p[1], last_active: new Date(Date.now() - i * 60000).toISOString() }; });

  var Data = {
    remoteEnabled: remoteOn,
    // 'local' | 'remote' | 'offline' (configured but failing); stale = no successful backend call recently.
    mode: function () { return BE.backendMode(SEC, { disabled: !CFG.FEATURES.realtime, failures: failures }); },
    isStale: function () { return remoteOn && BE.isStale(lastOkAt, Date.now(), STALE_MS); },
    // Server-verified identity/role (null until auth-telegram succeeded); never derived from client-supplied ids.
    verifiedUser: function () { return verified && verified.user; },
    isAdmin: function (id) { return BE.adminAllowed(SEC, id, session, remoteOn && !!initDataRaw); },
    onSynced: null,

    // Starts a backend session from Telegram initData and loads content + progress. Resolves null when no backend is configured.
    bootstrap: function (tgUser, initData, referrerId) {
      if (!remoteOn) return Promise.resolve(null);
      currentId = tgUser && Number(tgUser.id) ? Number(tgUser.id) : null;
      initDataRaw = initData || '';
      var pre = Promise.resolve();
      if (initDataRaw && currentId) {
        pre = authenticate().then(function () {
          return referrerId ? quiet(remote('POST', 'rpc/tp_register_referral', { p_referrer: referrerId })) : null;
        }).then(null, noop);
      }
      return pre.then(function () { return Data.sync(); });
    },
    // Refreshes content (and the user's progress + leaderboard when signed in). Resolves { user, claimed, contentChanged } or null when offline.
    sync: function () {
      if (!remoteOn) return Promise.resolve(null);
      var userP = canSync() ? fetchUserBundle(currentId).then(null, function () { return null; }) : Promise.resolve(null);
      var boardP = canSync() ? quiet(remote('POST', 'rpc/tp_leaderboard', {})).then(function (rows) {
        if (Array.isArray(rows) && rows.length) leadersCache = BE.leadersFromRows(rows);
      }) : Promise.resolve();
      return Promise.all([fetchContent().then(null, function () { return false; }), userP, boardP]).then(function (r) {
        return { contentChanged: !!r[0], user: r[1] && r[1].user, claimed: r[1] && r[1].claimed };
      });
    },
    syncUser: function () {
      if (!canSync()) return Promise.resolve(null);
      return fetchUserBundle(currentId).then(function (res) {
        if (typeof Data.onSynced === 'function') Data.onSynced(res);
        return res;
      }, function () { return null; });
    },
    // Server-authoritative action (RPC), then re-read the user so the UI shows the server's numbers (also when the server rejected it).
    action: function (name, args) {
      if (!canSync()) return Promise.resolve(null);
      return enqueue(function () {
        return remote('POST', 'rpc/' + name, args || {}).then(null, noop).then(function () { return Data.syncUser(); });
      });
    },

    loadUser: function (tgUser) {
      var key = 'user:' + tgUser.id;
      var u = read(key, null);
      var now = new Date().toISOString();
      if (!u) u = window.TPCore.newUser(tgUser, now);
      var savedRigParts = read('rig:' + tgUser.id, null);
      var rigKeys = CFG.RIG_PARTS.map(function (part) { return part.key; });
      var rigParts = Array.isArray(savedRigParts) ? savedRigParts : u.rig_parts;
      u.rig_parts = (Array.isArray(rigParts) ? rigParts : ['desk']).filter(function (part, index, list) {
        return rigKeys.indexOf(part) !== -1 && list.indexOf(part) === index;
      });
      if (u.rig_parts.indexOf('desk') === -1) u.rig_parts.unshift('desk');
      if (tgUser.photo_url && !u.avatar_custom) u.avatar_url = tgUser.photo_url;
      if (tgUser.username) u.username = tgUser.username;
      u.last_active = now;
      write(key, u);
      write('rig:' + tgUser.id, u.rig_parts);
      return u;
    },
    saveUser: function (u) {
      u.rig_parts = Data.rigParts(u.id);
      write('user:' + u.id, u);
      if (canSync() && Number(u.id) === currentId) {
        pendingUser = u;
        if (!profileTimer) { profileTimer = setTimeout(flushProfile, 1500); if (profileTimer && profileTimer.unref) profileTimer.unref(); }
      }
    },
    flushProfile: flushProfile,
    rigPartsCatalog: function () {
      var prices = (read('admin', {}).config || {}).rig_prices || {};
      return CFG.RIG_PARTS.map(function (part) {
        var v = Number(prices[part.key]);
        return part.key !== 'desk' && isFinite(v) && v >= 0 ? { key: part.key, title: part.title, price: Math.round(v), stars: part.stars } : part;
      });
    },
    rigParts: function (id) { return read('rig:' + id, ['desk']); },
    buyRigPart: function (user, partKey) {
      var part = Data.rigPartsCatalog().filter(function (item) { return item.key === partKey; })[0];
      if (!part) return { ok: false, reason: 'unknown_part' };
      var owned = Data.rigParts(user.id);
      if (owned.indexOf(partKey) !== -1) return { ok: false, reason: 'owned' };
      if (Number(user.stars) < part.price) return { ok: false, reason: 'insufficient_stars' };
      user.stars -= part.price;
      owned.push(partKey);
      user.rig_parts = owned;
      write('rig:' + user.id, owned);
      Data.saveUser(user);
      Data.action('tp_buy_rig_part', { p_part_id: partKey });
      return { ok: true, part: part };
    },
    grantRigPart: function (user, partKey) {
      var part = Data.rigPartsCatalog().filter(function (item) { return item.key === partKey; })[0];
      if (!part) return { ok: false, reason: 'unknown_part' };
      var owned = Data.rigParts(user.id);
      if (owned.indexOf(partKey) !== -1) return { ok: false, reason: 'owned' };
      owned.push(partKey);
      user.rig_parts = owned;
      write('rig:' + user.id, owned);
      // Parts paid with Telegram Stars are not stored by the server yet; remember them so a backend refresh does not drop them.
      write('rig:paid:' + user.id, (read('rig:paid:' + user.id, []).concat(partKey)));
      Data.saveUser(user);
      return { ok: true, part: part };
    },
    claimed: function (id) { return read('claimed:' + id, []); },
    saveClaimed: function (id, list) { write('claimed:' + id, list); },

    transactions: function (id) { return read('tx:' + id, []); },
    addTransaction: function (id, tx) {
      var list = Data.transactions(id);
      list.unshift({ id: uid(), type: tx.type, amount: tx.amount, status: tx.status || 'completed', created_at: new Date().toISOString() });
      write('tx:' + id, list.slice(0, 50));
      if (tx.type === 'deposit' || tx.type === 'withdraw') Data.action('tp_request_wallet', { p_type: tx.type, p_amount: tx.amount });
    },

    leaders: function () { return (leadersCache || MOCK_LEADERS).slice(); },

    getMessages: function () {
      return (initDataRaw ? remote : function () { return Promise.reject(new Error('local chat')); })('GET', 'messages?order=created_at.desc&limit=50').then(function (rows) {
        return rows.reverse();
      }).catch(function () {
        return read('messages', [{ id: 'sys', user_id: 0, username: 'TechnixPro', avatar_url: '', content: 'Witaj na czacie! Bądź miły dla innych.', created_at: new Date().toISOString() }]);
      });
    },
    sendMessage: function (u, content) {
      var msg = { id: uid(), user_id: u.id, username: u.username, avatar_url: u.avatar_url && u.avatar_url.length < 2000 ? u.avatar_url : '', content: content, created_at: new Date().toISOString() };
      var list = read('messages', []);
      list.push(msg);
      write('messages', list.slice(-100));
      if (!initDataRaw) return Promise.resolve(msg);
      return remote('POST', 'messages', [{ user_id: msg.user_id, username: msg.username, avatar_url: msg.avatar_url, content: msg.content }])
        .catch(function () {}).then(function () { return msg; });
    },
    onlineUsers: function (selfUser) {
      var cutoff = Date.now() - CFG.ONLINE_WINDOW_MS;
      var seen = {};
      read('messages', []).forEach(function (m) {
        var t = Date.parse(m.created_at);
        if (m.user_id && t >= cutoff) seen[m.user_id] = m.username;
      });
      seen[selfUser.id] = selfUser.username;
      return Object.keys(seen).length;
    },

    getPosts: function () { return read('posts', []); },
    savePosts: function (list) {
      var prev = read('posts', []);
      var ok = write('posts', list);
      if (isAdminSession()) {
        var rows = list.filter(function (p) { return BE.isUuid(p.id); }).map(function (p) { return BE.postToRow(p, currentId); });
        var kept = {};
        list.forEach(function (p) { kept[p.id] = true; });
        var removed = prev.filter(function (p) { return BE.isUuid(p.id) && !kept[p.id]; }).map(function (p) { return p.id; });
        if (rows.length) quiet(remote('POST', 'posts', rows));
        if (removed.length) quiet(remote('PATCH', 'posts?id=in.' + inList(removed), { status: 'trashed' }));
      }
      return ok;
    },
    newId: uid,

    /* ----- admin data (Supabase-ready: audit_actions, phases, notifications, post_trash) ----- */
    getAdminState: function () {
      var raw = read('admin', null);
      return window.TPAdmin ? window.TPAdmin.normalizeState(raw) : (raw || {});
    },
    saveAdminState: function (state) {
      var ok = write('admin', state);
      if (isAdminSession()) {
        var norm = window.TPAdmin ? window.TPAdmin.normalizeState(state) : state;
        var tasks = (norm.tasks || CFG.TASKS).map(function (t, i) { return BE.taskToRow(t, i, currentId); });
        quiet(remote('POST', 'app_settings', BE.settingsRows(norm, currentId)));
        quiet(remote('POST', 'tasks', tasks).then(function () {
          return tasks.length ? remote('PATCH', 'tasks?id=not.in.' + inList(tasks.map(function (t) { return t.id; })), { published: false }) : remote('PATCH', 'tasks?id=not.is.null', { published: false });
        }));
      }
      return ok;
    },
    getStore: function (name, fallback) { return read('eng:' + name, fallback); },
    saveStore: function (name, value) { return write('eng:' + name, value); },
    getList: function (name) { var v = read('admin:' + name, []); return Array.isArray(v) ? v : []; },
    saveList: function (name, list, limit) {
      var prev = name === 'notifications' ? Data.getList(name) : [];
      var ok = write('admin:' + name, limit ? list.slice(0, limit) : list);
      if (name === 'notifications' && isAdminSession()) {
        var kept = {};
        list.forEach(function (n) { kept[n.id] = true; });
        var rows = list.filter(function (n) { return BE.isUuid(n.id); }).map(BE.notificationToRow);
        var removed = prev.filter(function (n) { return BE.isUuid(n.id) && !kept[n.id]; }).map(function (n) { return n.id; });
        if (rows.length) quiet(remote('POST', 'notifications', rows));
        if (removed.length) quiet(remote('PATCH', 'notifications?id=in.' + inList(removed), { published: false }));
      }
      return ok;
    },
    mirror: function (table, row) { remote('POST', table, [row]).catch(function () {}); },
    audit: function (adminId, action, entityType, entityId, changes) {
      var row = { id: uid(), admin_id: adminId, action: action, entity_type: entityType, entity_id: entityId == null ? null : String(entityId), changes: changes || null, timestamp: new Date().toISOString() };
      Data.saveList('audit', [row].concat(Data.getList('audit')), 200);
      Data.mirror('admin_actions', { id: row.id, admin_id: row.admin_id, action: row.action, target: row.entity_type + (row.entity_id ? ':' + row.entity_id : ''), payload: row.changes || {} });
      return row;
    },
    taskStats: function () { return read('admin:taskstats', {}); },
    recordTaskCompletion: function (taskId) {
      var st = Data.taskStats();
      st[taskId] = (st[taskId] || 0) + 1;
      write('admin:taskstats', st);
    },
    touchActivity: function (id) {
      var a = read('activity', {});
      a[id] = new Date().toISOString();
      write('activity', a);
    },
    activity: function () { return read('activity', {}); },
    localUsers: function () {
      var out = [];
      try {
        Object.keys(localStorage).forEach(function (k) {
          if (k.indexOf(PREFIX + 'user:') !== 0) return;
          try { var u = JSON.parse(localStorage.getItem(k)); if (u && typeof u === 'object') out.push(u); } catch (e) { /* skip corrupt */ }
        });
      } catch (e) { /* storage unavailable */ }
      return out;
    },
    localTransactions: function () {
      var out = [];
      try {
        Object.keys(localStorage).forEach(function (k) {
          if (k.indexOf(PREFIX + 'tx:') !== 0) return;
          try { out = out.concat(JSON.parse(localStorage.getItem(k)) || []); } catch (e) { /* skip corrupt */ }
        });
      } catch (e) { /* storage unavailable */ }
      return out;
    },

    exportBackup: function () {
      return { app: 'technixpro-admin', version: 1, exported_at: new Date().toISOString(), admin: Data.getAdminState(), posts: Data.getPosts(), notifications: Data.getList('notifications'), phases: Data.getList('phases') };
    },
    importBackup: function (obj) {
      var check = window.TPAdmin.validateBackup(obj);
      if (!check.ok) return check;
      write('admin', window.TPAdmin.normalizeState(obj.admin));
      write('posts', obj.posts);
      if (Array.isArray(obj.notifications)) write('admin:notifications', obj.notifications);
      if (Array.isArray(obj.phases)) write('admin:phases', obj.phases);
      return { ok: true };
    },
    snapshot: function (label) {
      var snap = { id: uid(), label: label, created_at: new Date().toISOString(), data: Data.exportBackup() };
      Data.saveList('history', [snap].concat(Data.getList('history')), 5);
      return snap;
    },

    testConnection: function () {
      if (!remoteOn) return Promise.resolve({ ok: false, reason: 'not_configured' });
      var t0 = Date.now();
      return remote('GET', 'users?select=telegram_id&limit=1').then(function () { return { ok: true, ms: Date.now() - t0 }; }, function (e) { return { ok: false, reason: e.message }; });
    },
    validateSchema: function () {
      var tables = ['users', 'messages', 'posts', 'admin_actions', 'phases', 'notifications', 'tasks', 'app_settings'];
      if (!remoteOn) return Promise.resolve({ ok: false, reason: 'not_configured', missing: tables });
      return Promise.all(tables.map(function (t) {
        return remote('GET', t + '?select=*&limit=0').then(function () { return null; }, function () { return t; });
      })).then(function (r) { var missing = r.filter(Boolean); return { ok: !missing.length, missing: missing }; });
    },

    subscribeStorage: function (cb) {
      window.addEventListener('storage', function (e) { if (e.key && e.key.indexOf(PREFIX) === 0) cb(e.key.slice(PREFIX.length)); });
    }
  };
  window.TPData = Data;
})();
