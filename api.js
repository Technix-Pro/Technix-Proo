(function () {
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
