/* Data layer. Set CONFIG.USE_MOCK_API = false and CONFIG.API_BASE_URL to use a real backend. */
(function () {
  'use strict';

  var CONFIG = window.CONFIG = Object.assign({
    USE_MOCK_API: true,
    API_BASE_URL: '',
    BOT_USERNAME: 'TechnixProBot',
    ANIMATIONS: true,
    SYNC_DEBOUNCE_MS: 4000
  }, window.CONFIG || {});

  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  var tgUser = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : {};

  var currentUser = {
    id: tgUser.id || 0,
    username: tgUser.username || '',
    first_name: tgUser.first_name || 'Guest',
    last_name: tgUser.last_name || '',
    photo_url: tgUser.photo_url || '',
    language_code: tgUser.language_code || 'pl'
  };

  var MOCK_KEY = 'technixpro.mock.v1';
  var CACHE_KEY = 'technixpro.gamestate.v1';

  function defaults() {
    return {
      me: { tp: 0, taps: 0, energy: 1000, stars: 0 },
      rig: { owned: {} },
      tasks: [],
      leaderboard: [],
      referrals: { count: 0, earned: 0, items: [] },
      notifications: [],
      wallet: { balance: 0, history: [] }
    };
  }

  function loadMock() {
    try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(MOCK_KEY) || '{}')); }
    catch (e) { return defaults(); }
  }
  function saveMock(db) { try { localStorage.setItem(MOCK_KEY, JSON.stringify(db)); } catch (e) { /* storage unavailable */ } }

  function mockRequest(method, path, body) {
    var db = loadMock();
    switch (method + ' ' + path) {
      case 'GET /api/me': return db.me;
      case 'GET /api/rig': return db.rig;
      case 'POST /api/rig':
        if (body && body.part) { db.rig.owned[body.part] = true; saveMock(db); }
        return db.rig;
      case 'POST /api/sync':
        if (body && body.state) { db.me = Object.assign(db.me, body.state); saveMock(db); }
        return { ok: true, serverTime: Date.now() };
      case 'GET /api/tasks': return db.tasks;
      case 'GET /api/leaderboard': return db.leaderboard;
      case 'GET /api/referrals': return db.referrals;
      case 'GET /api/notifications': return db.notifications;
      case 'GET /api/wallet': return db.wallet;
      default: throw new Error('Unknown endpoint ' + method + ' ' + path);
    }
  }

  function request(method, path, body, opts) {
    if (CONFIG.USE_MOCK_API) {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          try { resolve(JSON.parse(JSON.stringify(mockRequest(method, path, body)))); } catch (e) { reject(e); }
        }, 120);
      });
    }
    return fetch(CONFIG.API_BASE_URL + path, {
      method: method,
      keepalive: !!(opts && opts.keepalive),
      headers: {
        'Content-Type': 'application/json',
        // Backend MUST verify this signed string (HMAC with bot token) before trusting any user data.
        'X-Telegram-Init-Data': tg ? tg.initData || '' : ''
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  // Game state sync: local cache + debounced batched upload with clientRequestId and timestamp
  var pending = null, timer = null;

  function cacheState(state) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  function flushSync(keepalive) {
    clearTimeout(timer);
    timer = null;
    if (!pending) return Promise.resolve();
    var payload = {
      clientRequestId: Date.now().toString(36) + Math.random().toString(36).slice(2, 10),
      clientTime: Date.now(),
      state: pending
    };
    pending = null;
    return request('POST', '/api/sync', payload, { keepalive: keepalive }).catch(function () {
      pending = pending || payload.state;
    });
  }
  function queueSync(state) {
    pending = state;
    cacheState(state);
    if (!timer) timer = setTimeout(flushSync, CONFIG.SYNC_DEBOUNCE_MS);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) flushSync(true); });
  window.addEventListener('beforeunload', function () { flushSync(true); });

  window.TechnixAPI = {
    currentUser: currentUser,
    referralLink: function () {
      return 'https://t.me/' + CONFIG.BOT_USERNAME + '?start=ref_' + (currentUser.id || 'guest');
    },
    getMe: function () { return request('GET', '/api/me'); },
    getRig: function () { return request('GET', '/api/rig'); },
    buyRigPart: function (part) { return request('POST', '/api/rig', { part: part }); },
    getTasks: function () { return request('GET', '/api/tasks'); },
    getLeaderboard: function () { return request('GET', '/api/leaderboard'); },
    getReferrals: function () { return request('GET', '/api/referrals'); },
    getNotifications: function () { return request('GET', '/api/notifications'); },
    getWallet: function () { return request('GET', '/api/wallet'); },
    queueSync: queueSync,
    flushSync: flushSync
  };
})();
