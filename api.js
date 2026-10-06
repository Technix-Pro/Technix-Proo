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
})();
