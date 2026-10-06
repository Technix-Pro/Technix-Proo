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
      if (tgUser.photo_url && !u.avatar_custom) u.avatar_url = tgUser.photo_url;
      if (tgUser.username) u.username = tgUser.username;
      u.last_active = now;
      write(key, u);
      return u;
    },
    saveUser: function (u) {
      write('user:' + u.id, u);
      remote('POST', 'users', [u]).catch(function () {});
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
    savePosts: function (list) { write('posts', list); },
    newId: uid,

    subscribeStorage: function (cb) {
      window.addEventListener('storage', function (e) { if (e.key && e.key.indexOf(PREFIX) === 0) cb(e.key.slice(PREFIX.length)); });
    }
  };
  window.TPData = Data;
})();
