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
(function () {
  const CONFIG = window.CONFIG || { USE_MOCK_API: true, API_BASE_URL: '' };
  const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  const STORAGE_KEY = `technixpro-api-cache:${telegramId || 'guest'}`;
  const DEFAULT_DATA = {
    me: { stars: 1280, level: 1, energy: 1000, energyMax: 1000, tp: 240, rigParts: {} },
    rig: { parts: {} },
    tasks: [
      { title: 'Aktywność w kanale', reward: 25, label: 'Kanał' },
      { title: 'Wspólnota: post do grupy', reward: 40, label: 'Grupa' },
      { title: 'Mining boost', reward: 60, label: 'TP' },
      { title: 'Referral invite', reward: 100, label: 'Referral' }
    ],
    leaderboard: [],
    referrals: { count: 0, rewards: 0 },
    notifications: [{ title: 'Powiadomienie systemowe', text: 'Witaj w TechnixPro!' }],
    wallet: { balance: 0, currency: 'PLN' }
  };

  function readCache() {
    try {
      return { ...DEFAULT_DATA, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
    } catch (_) {
      return { ...DEFAULT_DATA };
    }
  }

  let cache = readCache();

  function saveCache() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch (_) {
      // Local storage may be unavailable in private browsing.
  const CONFIG = window.CONFIG || {};
  const CACHE_KEY = 'technixpro-api-cache';
  let telegramUser = null;
  let telegramInitData = '';

  function readCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function writeCache(key, value) {
    try {
      const cache = readCache();
      cache[key] = value;
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      return;
    }
  }

  async function request(path, options = {}) {
    if (CONFIG.USE_MOCK_API) return options.mock();
    if (!CONFIG.API_BASE_URL) throw new Error('Brak skonfigurowanego adresu API.');
    const telegram = window.Telegram && window.Telegram.WebApp;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (telegram && telegram.initData) {
      // Backend musi zweryfikować initData; nie ufaj initDataUnsafe po stronie serwera.
      headers['X-Telegram-Init-Data'] = telegram.initData;
    }
    const response = await fetch(`${CONFIG.API_BASE_URL}${path}`, { ...options, headers });
    if (CONFIG.USE_MOCK_API) {
      const cache = readCache();
      if (options.method === 'POST' && path === '/api/sync') {
        writeCache('gameState', JSON.parse(options.body));
        return { ok: true, receivedAt: new Date().toISOString() };
      }
      if (options.method === 'POST' && path === '/api/rig') {
        const payload = JSON.parse(options.body);
        writeCache('/api/rig', payload);
        return payload;
      }
      return cache[path] ?? null;
    }

    if (!CONFIG.API_BASE_URL) throw new Error('Brak adresu API.');
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (telegramInitData) {
      // Backend musi zweryfikować initData podpisem Telegrama przed zaufaniem użytkownikowi.
      headers.Authorization = `tma ${telegramInitData}`;
    }
    const response = await fetch(`${CONFIG.API_BASE_URL.replace(/\/$/, '')}${path}`, {
      ...options,
      headers
    });
    if (!response.ok) throw new Error(`Błąd API (${response.status}).`);
    return response.status === 204 ? null : response.json();
  }

  function get(key, path) {
    return request(path, { mock: () => Promise.resolve(cache[key]) });
  }

  function updateCache(patch) {
    cache = { ...cache, ...patch };
    saveCache();
  }

  window.TechnixAPI = {
    getMe: () => get('me', '/api/me'),
    getRig: () => get('rig', '/api/rig'),
    getTasks: () => get('tasks', '/api/tasks'),
    getLeaderboard: () => get('leaderboard', '/api/leaderboard'),
    getReferrals: () => get('referrals', '/api/referrals'),
    getNotifications: () => get('notifications', '/api/notifications'),
    getWallet: () => get('wallet', '/api/wallet'),
    saveRig(parts) {
      return request('/api/rig', {
        method: 'POST',
        body: JSON.stringify({ parts }),
        mock: () => {
          updateCache({ rig: { parts }, me: { ...cache.me, rigParts: parts } });
          return Promise.resolve(cache.rig);
        }
      });
    },
    purchaseRigPart(part, stars) {
      if (CONFIG.USE_MOCK_API) {
        const parts = { ...(cache.me.rigParts || {}), [part]: true };
        updateCache({ rig: { parts }, me: { ...cache.me, rigParts: parts } });
        return Promise.resolve({ mock: true, owned: true, parts });
      }
      return request('/api/payments/stars/invoice', {
        method: 'POST',
        body: JSON.stringify({ part, currency: 'XTR', stars })
      }).then(invoice => {
        const telegram = window.Telegram && window.Telegram.WebApp;
        if (!invoice?.invoiceLink || !telegram || typeof telegram.openInvoice !== 'function') {
          throw new Error('Płatności Telegram Stars są dostępne wyłącznie w aplikacji Telegram.');
        }
        return new Promise((resolve, reject) => {
          telegram.openInvoice(invoice.invoiceLink, status => {
            if (status !== 'paid') {
              resolve({ status });
              return;
            }
            request('/api/payments/stars/confirm', {
              method: 'POST',
              body: JSON.stringify({ part, invoiceId: invoice.invoiceId })
            }).then(resolve, reject);
          });
        });
      });
    },
    syncState(state) {
      const payload = { ...state, clientRequestId: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random()}`, timestamp: new Date().toISOString() };
      return request('/api/sync', {
        method: 'POST',
        body: JSON.stringify(payload),
        keepalive: true,
        mock: () => {
          updateCache({ me: { ...cache.me, ...state } });
          return Promise.resolve(cache.me);
        }
      });
    },
    saveLocalState(state) {
      updateCache({ me: { ...cache.me, ...state } });
    }
  };
  const api = {
    setTelegramContext(user, initData) {
      telegramUser = user;
      telegramInitData = initData || '';
    },
    async getMe() {
      const stored = await request('/api/me');
      const cachedGame = readCache().gameState;
      const user = telegramUser || {};
      return {
        id: user.id || 0,
        username: user.username || '',
        first_name: user.first_name || 'Gość',
        photo_url: user.photo_url || '',
        language_code: user.language_code || 'pl',
        ...(stored || {}),
        ...(CONFIG.USE_MOCK_API ? cachedGame || {} : {})
      };
    },
    async getRig() {
      return (await request('/api/rig')) || { ownedParts: [] };
    },
    async saveRig(ownedParts) {
      return request('/api/rig', {
        method: 'POST',
        body: JSON.stringify({ ownedParts, updatedAt: new Date().toISOString() })
      });
    },
    async getTasks() {
      return (await request('/api/tasks')) || [
        { title: 'Aktywność w kanale', reward: 25, label: 'Kanał' },
        { title: 'Wspólnota: post do grupy', reward: 40, label: 'Grupa' },
        { title: 'Mining boost', reward: 60, label: 'TP' },
        { title: 'Referral invite', reward: 100, label: 'Referral' }
      ];
    },
    async getLeaderboard() {
      return (await request('/api/leaderboard')) || [];
    },
    async getReferrals() {
      return (await request('/api/referrals')) || { count: 0, stars: 0 };
    },
    async getNotifications() {
      return (await request('/api/notifications')) || [
        { title: 'Powiadomienie systemowe', message: 'Witaj w TechnixPro! Połączyliśmy Twoje konto z interfejsem Telegram Mini App.' }
      ];
    },
    async getWallet() {
      return (await request('/api/wallet')) || { balance: '0,00 PLN' };
    },
    async sync(gameState, keepalive = false) {
      const payload = {
        ...gameState,
        clientRequestId: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        updatedAt: new Date().toISOString()
      };
      writeCache('gameState', payload);
      if (!CONFIG.USE_MOCK_API) {
        await request('/api/sync', {
          method: 'POST',
          body: JSON.stringify(payload),
          keepalive
        });
      }
    }
  };

  window.TechnixAPI = api;
})();
