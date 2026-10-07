// Versioned localStorage store + optional Supabase REST adapter. Falls back to local mock data when the backend is unavailable.
(function () {
  var CFG = window.TP_CONFIG, SEC = window.TECHNIX_CONFIG || {};
  var PREFIX = CFG.STORAGE_PREFIX + ':v' + CFG.STORAGE_VERSION + ':';
  var remoteOn = /^https:\/\//.test(SEC.SUPABASE_URL || '') && !!SEC.SUPABASE_ANON_KEY && SEC.SUPABASE_ANON_KEY.indexOf('TUTAJ') === -1;

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
    var a = new Uint32Array(2);
    window.crypto.getRandomValues(a);
    return Date.now().toString(36) + a[0].toString(36) + a[1].toString(36);
  }

  function remote(method, path, body) {
    if (!remoteOn || !CFG.FEATURES.realtime) return Promise.reject(new Error('remote off'));
    return fetch(SEC.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path, {
      method: method,
      headers: {
        apikey: SEC.SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SEC.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=representation,resolution=merge-duplicates'
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.status === 204 ? [] : r.json();
    });
  }

  var MOCK_LEADERS = [
    ['Nova', 15200], ['Byte', 11800], ['Quark', 9400], ['Pixel', 7600], ['Cipher', 5100],
    ['Vector', 3900], ['Kernel', 2600], ['Nano', 1700], ['Delta', 900], ['Echo', 400]
  ].map(function (p, i) { return { id: -(i + 1), username: p[0], avatar_url: '', xp_total: p[1], last_active: new Date(Date.now() - i * 60000).toISOString() }; });

  var Data = {
    remoteEnabled: remoteOn,

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
      remote('POST', 'users', [u]).catch(function () {});
    },
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
    },

    leaders: function () { return MOCK_LEADERS.slice(); },

    getMessages: function () {
      return remote('GET', 'messages?order=created_at.desc&limit=50').then(function (rows) {
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
    savePosts: function (list) { return write('posts', list); },
    newId: uid,

    /* ----- admin data (Supabase-ready: audit_actions, phases, notifications, post_trash) ----- */
    getAdminState: function () {
      var raw = read('admin', null);
      return window.TPAdmin ? window.TPAdmin.normalizeState(raw) : (raw || {});
    },
    saveAdminState: function (state) { return write('admin', state); },
    getList: function (name) { var v = read('admin:' + name, []); return Array.isArray(v) ? v : []; },
    saveList: function (name, list, limit) { return write('admin:' + name, limit ? list.slice(0, limit) : list); },
    mirror: function (table, row) { remote('POST', table, [row]).catch(function () {}); },
    audit: function (adminId, action, entityType, entityId, changes) {
      var row = { id: uid(), admin_id: adminId, action: action, entity_type: entityType, entity_id: entityId == null ? null : String(entityId), changes: changes || null, timestamp: new Date().toISOString() };
      Data.saveList('audit', [row].concat(Data.getList('audit')), 200);
      Data.mirror('admin_actions', row);
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
      return remote('GET', 'users?select=id&limit=1').then(function () { return { ok: true, ms: Date.now() - t0 }; }, function (e) { return { ok: false, reason: e.message }; });
    },
    validateSchema: function () {
      var tables = ['users', 'messages', 'posts', 'admin_actions', 'phases', 'notifications', 'post_trash'];
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
