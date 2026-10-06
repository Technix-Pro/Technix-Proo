(function () {
  const CONFIG = window.CONFIG || {
    USE_MOCK_API: true,
    API_BASE_URL: '',
    BOT_USERNAME: 'TechnixProBot',
    ANIMATIONS_ENABLED: true
  };
  window.CONFIG = CONFIG;

  const storageKey = () => `technixpro-api-state:${window.currentUser && window.currentUser.id ? window.currentUser.id : 'guest'}`;
  const defaultGameState = {
    stars: 1280,
    level: 1,
    energy: 1000,
    energyMax: 1000,
    tp: 240,
    rigParts: { mouse: false, keyboard: false, monitor: false, case: false, ram: false, gpu: false, fan: false }
  };

  function readCache() {
    try {
      return JSON.parse(localStorage.getItem(storageKey()) || '{}');
    } catch (error) {
      return {};
    }
  }

  function writeCache(value) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(value));
    } catch (error) {
      // Storage can be unavailable in private browsing; the in-memory app remains usable.
    }
  }

  function request(path, options = {}) {
    if (CONFIG.USE_MOCK_API) return Promise.resolve(mockResponse(path, options));
    if (!CONFIG.API_BASE_URL) return Promise.reject(new Error('Brak adresu API.'));
    const tg = window.Telegram && window.Telegram.WebApp;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    // The backend must validate initData; initDataUnsafe is only used for display.
    if (tg && tg.initData) headers.Authorization = `tma ${tg.initData}`;
    return fetch(`${CONFIG.API_BASE_URL.replace(/\/$/, '')}${path}`, { ...options, headers })
      .then(response => {
        if (!response.ok) throw new Error(`Błąd API (${response.status}).`);
        return response.status === 204 ? null : response.json();
      });
  }

  function mockResponse(path, options) {
    const cache = readCache();
    const user = window.currentUser || {};
    const saved = cache.gameState || {};
    if (path === '/api/me') {
      return {
        user,
        gameState: { ...defaultGameState, ...saved, rigParts: { ...defaultGameState.rigParts, ...(saved.rigParts || {}) } }
      };
    }
    if (path === '/api/rig') {
      if (options.method === 'POST') {
        cache.rig = JSON.parse(options.body || '{}');
        writeCache(cache);
      }
      return cache.rig || { parts: saved.rigParts || defaultGameState.rigParts };
    }
    if (path === '/api/tasks') return cache.tasks || [
      { title: 'Aktywność w kanale', reward: 25, label: 'Kanał' },
      { title: 'Wspólnota: post do grupy', reward: 40, label: 'Grupa' },
      { title: 'Mining boost', reward: 60, label: 'TP' },
      { title: 'Referral invite', reward: 100, label: 'Referral' }
    ];
    if (path === '/api/posts') return cache.posts || [
      { author: 'System', text: 'TechnixPro Core Engine online. Wersja 2.7 Edge aktywna.', media: '', time: '2 min temu' },
      { author: 'System', text: 'Nowa seria zadań społecznościowych została dodana do sekcji gwiazd.', media: '', time: '12 min temu' }
    ];
    if (path === '/api/channel-posts') return cache.channelPosts || [
      { author: 'TechnixPro', text: 'Nowa wersja systemu nagród trafiła do mini app. Włącz tryb aktywności i zbieraj gwiazdki.', media: '', time: '8 min temu' },
      { author: 'Core Team', text: 'Mining Engine osiągnął 64% wydajności. Kolejny etap odblokowuje automatyczne pakiety TP.', media: '', time: '23 min temu' }
    ];
    if (path === '/api/leaderboard') return cache.leaderboard || [];
    if (path === '/api/referrals') return cache.referrals || { count: 0, rewards: 0, items: [] };
    if (path === '/api/notifications') return cache.notifications || [
      { title: 'Powiadomienie systemowe', text: 'Witaj w TechnixPro! Połączyliśmy Twoje konto z interfejsem Telegram Mini App.' }
    ];
    if (path === '/api/wallet') return cache.wallet || { balance: 0, currency: 'PLN' };
    if (path === '/api/sync') {
      cache.gameState = JSON.parse(options.body || '{}').state || {};
      writeCache(cache);
      return { ok: true };
    }
    return {};
  }

  window.TechnixAPI = {
    getMe: () => request('/api/me'),
    getRig: () => request('/api/rig'),
    saveRig: parts => request('/api/rig', { method: 'POST', body: JSON.stringify({ parts }) }),
    getTasks: () => request('/api/tasks'),
    getPosts: () => request('/api/posts'),
    getChannelPosts: () => request('/api/channel-posts'),
    getLeaderboard: () => request('/api/leaderboard'),
    getReferrals: () => request('/api/referrals'),
    getNotifications: () => request('/api/notifications'),
    getWallet: () => request('/api/wallet'),
    cacheState: state => {
      const cache = readCache();
      cache.gameState = state;
      writeCache(cache);
    },
    syncState: (payload, keepalive = false) => request('/api/sync', { method: 'POST', body: JSON.stringify(payload), keepalive })
  };
})();
