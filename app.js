    if (window.tailwind) {
      window.tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            colors: {
              brand: {
                bg: '#080b14',
                panel: '#111827',
                border: '#1f293d',
                accent: '#8b5cf6',
                cyan: '#22d3ee',
                pink: '#ec4899'
              }
            },
            fontFamily: {
              sans: ['Inter', 'sans-serif']
            }
          }
        }
      }
    }

    const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
    if (tg) {
      tg.ready();
      tg.expand();
    }

    const defaultUser = {
      first_name: 'Guest',
      username: 'guest',
      id: 0,
      photo_url: '',
      language_code: 'pl'
    };
    let currentUser = defaultUser;
    let minedAmount = 0;
    let emissionEndsAt = 0;
    let syncTimer = null;
    let currentUser = { ...defaultUser };
    let syncTimer;

    // WPISZ TUTAJ SWOJE TELEGRAM ID, ABY WIDZIEĆ PANEL ADMINA
    const ADMIN_TELEGRAM_ID = 0; // np. 123456789

    const state = {
      stars: 1280,
      level: 1,
      energy: 1000,
      energyMax: 1000,
      tp: 240,
      taps: 0,
      taskHistory: [
        { label: 'Pierwsze logowanie', value: 25, time: 'dziś' }
      ],
      posts: [
        { author: 'System', text: 'TechnixPro Core Engine online. Wersja 2.7 Edge aktywna.', media: '', time: '2 min temu' },
        { author: 'System', text: 'Nowa seria zadań społecznościowych została dodana do sekcji gwiazd.', media: '', time: '12 min temu' }
      ],
      channelPosts: [
        { author: 'TechnixPro', text: 'Nowa wersja systemu nagród trafiła do mini app. Włącz tryb aktywności i zbieraj gwiazdki.', media: '', time: '8 min temu' },
        { author: 'Core Team', text: 'Mining Engine osiągnął 64% wydajności. Kolejny etap odblokowuje automatyczne pakiety TP.', media: '', time: '23 min temu' }
      ],
      tasks: [
        { title: 'Aktywność w kanale', reward: 25, label: 'Kanał' },
        { title: 'Wspólnota: post do grupy', reward: 40, label: 'Grupa' },
        { title: 'Mining boost', reward: 60, label: 'TP' },
        { title: 'Referral invite', reward: 100, label: 'Referral' }
      ],
      liveEvent: {
        title: 'Cyber Week — Community Sprint',
        desc: 'Wykonuj zadania społecznościowe, zbieraj gwiazdki i odblokuj limitowaną odznakę.',
        reward: 50
      },
      owned: {},
      purchases: []
      rigParts: {
        mouse: false,
        keyboard: false,
        monitor: false,
        case: false,
        ram: false,
        gpu: false,
        fan: false
      },
      rigCatalog: [
        { key: 'mouse', name: 'Mysz', cost: 40 },
        { key: 'keyboard', name: 'Klawiatura', cost: 60 },
        { key: 'monitor', name: 'Monitor', cost: 180 },
        { key: 'case', name: 'Obudowa', cost: 100 },
        { key: 'ram', name: 'RAM', cost: 80 },
        { key: 'gpu', name: 'GPU', cost: 270 },
        { key: 'fan', name: 'Chłodzenie', cost: 90 }
        { key: 'mouse', name: 'Mysz', icon: 'fa-computer-mouse', cost: 40 },
        { key: 'keyboard', name: 'Klawiatura', icon: 'fa-keyboard', cost: 60 },
        { key: 'monitor', name: 'Monitor', icon: 'fa-display', cost: 180 },
        { key: 'case', name: 'Obudowa', icon: 'fa-cube', cost: 100 },
        { key: 'ram', name: 'RAM', icon: 'fa-memory', cost: 80 },
        { key: 'gpu', name: 'GPU', icon: 'fa-microchip', cost: 270 },
        { key: 'fan', name: 'Chłodzenie', icon: 'fa-fan', cost: 120 }
      ]
    };
    window.getOwnedRigParts = () => Object.keys(state.rigParts).filter(key => state.rigParts[key]);

    function formatK(value) {
      const number = Number(value);
      return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(Number.isFinite(number) ? number : 0);
    }

    function parseTelegramUser() {
      const raw = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : defaultUser;
      const telegramId = Number(raw.id);
      currentUser = {
        id: Number.isFinite(telegramId) ? telegramId : 0,
        username: String(raw.username || 'guest'),
        first_name: String(raw.first_name || 'Guest'),
        photo_url: String(raw.photo_url || ''),
        language_code: String(raw.language_code || 'pl')
      return {
        id: raw.id || 0,
        username: raw.username || '',
        first_name: raw.first_name || 'Gość',
        photo_url: raw.photo_url || '',
        language_code: raw.language_code || 'pl',
        last_name: raw.last_name || ''
      };
      window.currentUser = currentUser;
      return currentUser;
    }

    currentUser = parseTelegramUser();
    if (window.TechnixAPI) window.TechnixAPI.setTelegramContext(currentUser, tg?.initData || '');

    function escapeHTML(value) {
      return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[character]);
    }

    function safeMediaURL(value) {
      if (!String(value || '').trim()) return '';
      try {
        const url = new URL(value, window.location.href);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
      } catch (error) {
        return '';
      }
    }

    function scheduleStateSync() {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => syncGameState(), 4000);
    }

    function syncGameState(keepalive = false) {
      if (!window.TechnixAPI) return;
      const gameState = {
        stars: Number(state.stars) || 0,
        energy: Number(state.energy) || 0,
        energyMax: Number(state.energyMax) || 0,
        tp: Number(state.tp) || 0,
        taps: Number(state.taps) || 0,
        ownedParts: Object.keys(state.rigParts).filter(key => state.rigParts[key])
      };
      return window.TechnixAPI.sync(gameState, keepalive).catch(() => {});
    }

    function computeLevel(stars) {
      if (stars < 1500) return 1;
      if (stars < 5000) return 2;
      if (stars < 12000) return 3;
      if (stars < 25000) return 4;
      return 5;
    }

    function buildLevelLabel(level) {
      return `LEVEL ${level}`;
    }

    function getNextLevelTarget(level) {
      const targets = [1500, 5000, 12000, 25000, Number.MAX_SAFE_INTEGER];
      return targets[level - 1] || 25000;
    }

    function updateStarsDisplay() {
      const starsTotal = document.getElementById('stars-total');
      const progress = document.getElementById('stars-progress-bar');
      const progressText = document.getElementById('stars-progress-text');
      const profileStars = document.getElementById('profile-stars');
      const rankLabel = document.getElementById('rank-stars-display');
      const levelBadge = document.getElementById('user-level-badge');
      const profileLevel = document.getElementById('profile-level');
      const adminStatStars = document.getElementById('admin-total-stars-stat');

      state.level = computeLevel(state.stars);
      const nextTarget = getNextLevelTarget(state.level);
      const currentLevelBase = state.level === 1 ? 0 : [0, 1500, 5000, 12000, 25000][state.level - 1];
      const progressValue = Math.min((state.stars - currentLevelBase) / (nextTarget - currentLevelBase || 1), 1);

      if (starsTotal) starsTotal.textContent = formatK(state.stars);
      if (progressText) progressText.textContent = `${formatK(state.stars)} / ${formatK(nextTarget)} ★`;
      if (progress) progress.style.width = `${(progressValue * 100).toFixed(0)}%`;
      if (profileStars) profileStars.textContent = `${formatK(state.stars)} ★`;
      if (rankLabel) rankLabel.textContent = `${formatK(state.stars)} ★`;
      if (levelBadge) levelBadge.textContent = buildLevelLabel(state.level);
      if (profileLevel) profileLevel.textContent = `Level ${state.level}`;
      if (adminStatStars) adminStatStars.textContent = `${formatK(state.stars)} ★`;
    }

    function renderTaskList() {
      const taskList = document.getElementById('task-list');
      if (!taskList) return;

      taskList.replaceChildren();
      if (!state.tasks.length) {
        taskList.textContent = 'Brak dostępnych zadań.';
        return;
      }
      state.tasks.forEach(task => {
        const reward = Number(task.reward);
        const safeReward = Number.isFinite(reward) ? reward : 0;
        const title = String(task.title || 'Zadanie');
        const button = document.createElement('button');
        button.className = 'task-action w-full text-left panel px-3 py-3 rounded-xl flex items-center justify-between gap-3';
        button.dataset.task = String(task.label || 'zadanie').toLowerCase();
        button.dataset.reward = String(safeReward);
        button.dataset.label = title;
        button.innerHTML = '<div><div class="task-title text-xs font-semibold text-white"></div><div class="task-reward text-[10px] muted"></div></div><span class="text-[10px] text-violet-300 font-bold">Złap</span>';
        button.querySelector('.task-title').textContent = title;
        button.querySelector('.task-reward').textContent = `+${safeReward} ★`;
        taskList.appendChild(button);
      });
      taskList.innerHTML = state.tasks.map(task => `
        <button data-task="${escapeHTML(String(task.label || 'zadanie').toLowerCase())}" data-reward="${Number(task.reward) || 0}" data-label="${escapeHTML(task.title)}" class="task-action w-full text-left panel px-3 py-3 rounded-xl flex items-center justify-between gap-3">
          <div>
            <div class="text-xs font-semibold text-white">${escapeHTML(task.title)}</div>
            <div class="text-[10px] muted">+${Number(task.reward) || 0} ★</div>
          </div>
          <span class="text-[10px] text-violet-300 font-bold">Złap</span>
        </button>
      `).join('');

      document.querySelectorAll('#task-list .task-action').forEach(button => {
        button.addEventListener('click', () => {
          const reward = Number(button.dataset.reward || 0);
          const label = button.dataset.label || 'Zadanie';
          addStars(reward, label);
        });
      });
    }

    function renderRewardLog() {
      const rewardLog = document.getElementById('reward-log');
      if (!rewardLog) return;
      const items = state.taskHistory.slice(0, 5);

      rewardLog.replaceChildren();
      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between text-xs rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2';
        const label = document.createElement('span');
        label.className = 'text-slate-300';
        label.textContent = String(item.label || '');
        const value = document.createElement('span');
        value.className = 'font-bold text-emerald-400';
        value.textContent = `+${Number(item.value) || 0} ★`;
        row.append(label, value);
        rewardLog.appendChild(row);
      });
      rewardLog.innerHTML = items.map(item => `
        <div class="flex items-center justify-between text-xs rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2">
          <span class="text-slate-300">${escapeHTML(item.label)}</span>
          <span class="font-bold text-emerald-400">+${Number(item.value) || 0} ★</span>
        </div>
      `).join('');
    }

    function addStars(amount, label) {
      amount = Number(amount);
      if (!Number.isFinite(amount) || amount <= 0) return;
      state.stars += amount;
      state.taskHistory.unshift({ label, value: amount, time: 'teraz' });
      updateStarsDisplay();
      renderRewardLog();
      scheduleStateSync();
      showToast(`Dodano ${amount} ★ do profilu (${label})`);
    }

    function snapshotGameState() {
      return {
        stars: Number(state.stars) || 0,
        energy: Number(state.energy) || 0,
        energyMax: Number(state.energyMax) || 0,
        tp: Number(state.tp) || 0,
        rigParts: { ...state.rigParts },
        mined: Number(minedAmount) || 0,
        emissionEndsAt
      };
    }

    function scheduleStateSync() {
      if (!window.TechnixAPI) return;
      const snapshot = snapshotGameState();
      TechnixAPI.saveLocalState(snapshot);
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => TechnixAPI.syncState(snapshot).catch(() => {}), 2500);
    }

    function flushState() {
      if (!window.TechnixAPI) return;
      clearTimeout(syncTimer);
      const snapshot = snapshotGameState();
      TechnixAPI.saveLocalState(snapshot);
      TechnixAPI.syncState(snapshot).catch(() => {});
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add('show');
      if (window.FX) window.FX.toastIn(toast);
      clearTimeout(window.toastTimer);
      window.toastTimer = setTimeout(() => toast.classList.remove('show'), 1700);
    }

    function show(screenName, title = 'TechnixPro') {
      const screens = document.querySelectorAll('.screen');
      screens.forEach(screen => screen.classList.add('hidden'));
      const active = document.getElementById(`screen-${screenName}`);
      if (active) active.classList.remove('hidden');

      const titleNode = document.getElementById('header-title');
      if (titleNode) titleNode.textContent = title;

      const homeSubtabs = document.getElementById('home-subtabs');
      const giftSubtabs = document.getElementById('gift-subtabs');

      if (homeSubtabs) homeSubtabs.classList.toggle('hidden', screenName !== 'home');
      if (giftSubtabs) giftSubtabs.classList.toggle('hidden', screenName !== 'gift');

      document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.screen === screenName));
      if (window.rigBuilder) window.rigBuilder.setVisible(screenName === 'crypto');
      loadScreenData(screenName);
    }

    const SCREEN_LOADERS = {
      home: () => TechnixAPI.getNotifications(),
      crypto: () => TechnixAPI.getRig(),
      gift: () => Promise.all([TechnixAPI.getTasks(), TechnixAPI.getLeaderboard(), TechnixAPI.getReferrals()]),
      wallet: () => TechnixAPI.getWallet(),
      profile: () => TechnixAPI.getMe(),
      menu: () => TechnixAPI.getMe(),
      search: () => TechnixAPI.getLeaderboard(),
      notifications: () => TechnixAPI.getNotifications()
    };

    function getScreenStatus(screen) {
      let status = screen.querySelector('.screen-data-status');
      if (!status) {
        status = document.createElement('div');
        status.className = 'screen-data-status hidden';
        status.setAttribute('aria-live', 'polite');
        status.setAttribute('role', 'status');
        screen.prepend(status);
      }
      return status;
    }

    function showScreenStatus(screen, type, message) {
      const status = getScreenStatus(screen);
      status.replaceChildren();
      status.className = `screen-data-status ${type === 'loading' ? 'rig-loading' : type === 'error' ? 'rig-error panel p-3' : 'muted text-xs'}`;
      if (type === 'loading') {
        status.innerHTML = '<div class="space-y-2" aria-hidden="true"><div class="h-3 w-2/5 rounded bg-slate-700 animate-pulse"></div><div class="h-2 w-4/5 rounded bg-slate-800 animate-pulse"></div></div><span class="sr-only"></span>';
        status.querySelector('.sr-only').textContent = message || 'Ładowanie danych…';
      } else {
        const text = document.createElement('span');
        text.textContent = message;
        status.appendChild(text);
        if (type === 'error') {
          const retry = document.createElement('button');
          retry.type = 'button';
          retry.className = 'ml-2 text-cyan-300 underline';
          retry.textContent = 'Spróbuj ponownie';
          retry.addEventListener('click', () => loadScreenData(screen.id.replace('screen-', '')));
          status.appendChild(retry);
        }
      }
    }

    function loadScreenData(screenName) {
      const loader = SCREEN_LOADERS[screenName];
      const screen = document.getElementById(`screen-${screenName}`);
      if (!loader || !screen || !window.TechnixAPI) return;
      const token = Number(screen.dataset.loadToken || 0) + 1;
      screen.dataset.loadToken = String(token);
      showScreenStatus(screen, 'loading', 'Ładowanie danych…');
      loader().then(data => {
        if (Number(screen.dataset.loadToken) !== token) return;
        applyScreenData(screenName, data);
        const status = getScreenStatus(screen);
        status.className = 'screen-data-status hidden';
        const notifications = Array.isArray(data) ? data : data && data.notifications;
        if ((screenName === 'gift' && !state.tasks.length) || (screenName === 'notifications' && Array.isArray(notifications) && !notifications.length)) {
          showScreenStatus(screen, 'empty', 'Brak danych do wyświetlenia.');
        }
      }).catch(() => {
        if (Number(screen.dataset.loadToken) === token) showScreenStatus(screen, 'error', 'Nie udało się pobrać danych.');
      });
    }

    function applyScreenData(screenName, data) {
      if (screenName === 'crypto') {
        const parts = data && (data.parts || data.rigParts) || {};
        state.rigParts = { ...state.rigParts, ...parts };
        window.rigBuilder.renderRig(state.rigParts);
      } else if (screenName === 'gift') {
        const [tasks, leaderboard, referrals] = data;
        const taskList = Array.isArray(tasks) ? tasks : (tasks && tasks.tasks);
        state.tasks = Array.isArray(taskList) ? taskList.filter(task => task && typeof task === 'object') : [];
        renderTaskList();
        const rankName = document.getElementById('rank-user-label');
        if (rankName) rankName.textContent = `Ty (@${currentUser.username})`;
        const count = document.getElementById('referral-count');
        const rewards = document.getElementById('referral-rewards');
        const referralCount = Number(referrals?.count);
        const referralRewards = Number(referrals?.rewards);
        if (count) count.textContent = `${Number.isFinite(referralCount) ? Math.max(0, referralCount) : 0} osób`;
        if (rewards) rewards.textContent = `+${Number.isFinite(referralRewards) ? Math.max(0, referralRewards) : 0} ★`;
        const firstRank = Array.isArray(leaderboard) ? leaderboard[0] : null;
        const rankingData = Array.isArray(leaderboard) ? leaderboard : leaderboard && leaderboard.items;
        const ranking = Array.isArray(rankingData) ? rankingData.filter(entry => entry && typeof entry === 'object') : [];
        const leaderboardList = document.getElementById('leaderboard-list');
        const leaderboardEmpty = document.getElementById('leaderboard-empty');
        if (leaderboardList) {
          leaderboardList.replaceChildren();
          ranking.slice(0, 10).forEach((entry, index) => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between bg-slate-900/70 p-2.5 rounded-xl border border-slate-800 text-xs font-semibold';
            const name = document.createElement('span');
            const username = String(entry.username || 'użytkownik');
            name.textContent = `${index + 1}. ${Number(entry.id) === currentUser.id ? `Ty (@${currentUser.username})` : `@${username}`}`;
            const score = document.createElement('span');
            score.className = 'font-bold text-violet-300';
            score.textContent = `${formatK(Number(entry.stars) || 0)} ★`;
            row.append(name, score);
            leaderboardList.appendChild(row);
          });
        }
        if (leaderboardEmpty) leaderboardEmpty.classList.toggle('hidden', ranking.length > 0);
        if (firstRank && Number(firstRank.id) === currentUser.id && document.getElementById('rank-stars-display')) {
          document.getElementById('rank-stars-display').textContent = `${formatK(Number(firstRank.stars) || 0)} ★`;
        }
      } else if (screenName === 'profile') {
        if (data?.stars != null && Number.isFinite(Number(data.stars))) state.stars = Math.max(0, Number(data.stars));
        if (data?.energyMax != null && Number.isFinite(Number(data.energyMax)) && Number(data.energyMax) > 0) state.energyMax = Number(data.energyMax);
        if (data?.energy != null && Number.isFinite(Number(data.energy))) state.energy = Math.min(Math.max(Number(data.energy), 0), state.energyMax);
        if (data?.tp != null && Number.isFinite(Number(data.tp))) state.tp = Math.max(0, Number(data.tp));
        updateStarsDisplay();
      } else if (screenName === 'wallet') {
        const balance = document.getElementById('wallet-balance');
        const amount = Number(data?.balance);
        if (balance) balance.textContent = `${(Number.isFinite(amount) ? amount : 0).toFixed(2).replace('.', ',')} ${String(data?.currency || 'PLN')}`;
      } else if (screenName === 'notifications' || screenName === 'home') {
        const notifications = Array.isArray(data) ? data : data && data.notifications;
        if (screenName === 'notifications' && Array.isArray(notifications)) {
          const container = document.getElementById('notifications-list');
          if (container) {
            container.replaceChildren();
            notifications.filter(item => item && typeof item === 'object').forEach(item => {
              const entry = document.createElement('article');
              entry.className = 'panel p-4 text-xs space-y-2';
              const title = document.createElement('div');
              title.className = 'font-bold text-white';
              title.textContent = String(item.title || 'Powiadomienie');
              const body = document.createElement('p');
              body.className = 'muted';
              body.textContent = String(item.text || '');
              entry.append(title, body);
              container.appendChild(entry);
            });
          }
        }
      document.dispatchEvent(new CustomEvent('rig-screen-visibility', { detail: screenName === 'crypto' }));
      if (screenName === 'wallet') loadApiView('wallet');
      if (screenName === 'notifications') loadApiView('notifications');
    }

    const apiViewConfig = {
      tasks: { target: 'reward-tasks', load: () => TechnixAPI.getTasks() },
      leaderboard: { target: 'reward-leaderboard', load: () => TechnixAPI.getLeaderboard() },
      referrals: { target: 'reward-referrals', load: () => TechnixAPI.getReferrals() },
      notifications: { target: 'screen-notifications', load: () => TechnixAPI.getNotifications() },
      wallet: { target: 'screen-wallet', load: () => TechnixAPI.getWallet() }
    };

    function setApiViewState(target, message, type = 'loading', retry) {
      let status = target.querySelector('.api-view-state');
      if (!status) {
        status = document.createElement('div');
        status.className = 'api-view-state panel p-4 text-center text-xs muted';
        target.append(status);
      }
      [...target.children].filter(child => child !== status).forEach(child => child.classList.add('hidden'));
      status.className = `api-view-state panel p-4 text-center text-xs ${type === 'error' ? 'text-rose-300' : 'muted'}`;
      status.replaceChildren();
      if (type === 'loading') {
        const skeleton = document.createElement('div');
        skeleton.className = 'api-skeleton';
        skeleton.setAttribute('aria-label', 'Ładowanie danych');
        status.append(skeleton);
      } else {
        const text = document.createElement('p');
        text.textContent = message;
        status.append(text);
      }
      if (type === 'error') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mt-3 rounded-lg bg-violet-600 px-3 py-2 font-semibold text-white';
        button.textContent = 'Spróbuj ponownie';
        button.addEventListener('click', retry);
        status.append(button);
      }
    }

    function resetApiView(target) {
      target.querySelector('.api-view-state')?.remove();
      [...target.children].forEach(child => child.classList.remove('hidden'));
    }

    function renderLeaderboard(entries) {
      const list = document.getElementById('leaderboard-list');
      if (!list) return;
      const currentRow = list.querySelector('.current-user-rank') || list.firstElementChild;
      if (currentRow) currentRow.classList.add('current-user-rank');
      const preserved = currentRow?.cloneNode(true);
      list.replaceChildren();
      if (preserved) list.append(preserved);
      entries.forEach(entry => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 text-xs';
        const name = document.createElement('span');
        name.className = 'text-slate-200';
        name.textContent = entry.username ? `@${entry.username}` : entry.first_name || 'Użytkownik';
        const score = document.createElement('span');
        score.className = 'font-bold text-cyan-300';
        score.textContent = `${Number(entry.stars) || 0} ★`;
        row.append(name, score);
        list.append(row);
      });
    }

    async function loadApiView(key) {
      const config = apiViewConfig[key];
      if (!config || !window.TechnixAPI) return;
      const target = document.getElementById(config.target);
      if (!target) return;
      setApiViewState(target, '', 'loading');
      try {
        const data = await config.load();
        resetApiView(target);
        if (key === 'tasks') {
          state.tasks = Array.isArray(data) ? data.filter(task => task && typeof task === 'object').map(task => ({
            title: String(task.title || 'Zadanie'),
            reward: Math.max(0, Number(task.reward) || 0),
            label: String(task.label || 'Zadanie')
          })) : [];
          renderTaskList();
        } else if (key === 'leaderboard') {
          const entries = Array.isArray(data) ? data.filter(entry => entry && typeof entry === 'object') : [];
          renderLeaderboard(entries);
          if (!entries.length) setApiViewState(target, 'Brak danych rankingu. Wróć później, aby sprawdzić wyniki.', 'empty');
        } else if (key === 'referrals') {
          const count = Math.max(0, Number(data?.count) || 0);
          const stars = Math.max(0, Number(data?.stars) || 0);
          document.getElementById('referral-count').textContent = `${count} osób`;
          document.getElementById('referral-stars').textContent = `+${stars} ★`;
        } else if (key === 'wallet') {
          const balance = document.getElementById('wallet-balance');
          if (balance) balance.textContent = typeof data?.balance === 'string' ? data.balance : '0,00 PLN';
        } else if (key === 'notifications') {
          const notifications = Array.isArray(data) ? data.filter(item => item && typeof item === 'object') : [];
          const title = document.getElementById('notification-title');
          const message = document.getElementById('notification-message');
          if (!notifications.length) {
            setApiViewState(target, 'Nie masz nowych powiadomień.', 'empty');
          } else {
            if (title) title.textContent = String(notifications[0].title || 'Powiadomienie');
            if (message) message.textContent = String(notifications[0].message || '');
          }
        }
        if (key === 'tasks' && !state.tasks.length) setApiViewState(target, 'Brak dostępnych zadań. Zajrzyj ponownie później.', 'empty');
      } catch (error) {
        setApiViewState(target, 'Nie udało się pobrać danych. Sprawdź połączenie i spróbuj ponownie.', 'error', () => loadApiView(key));
      }
    }

    function renderHomeSubtabs() {
      document.querySelectorAll('[data-home-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.homeTab;
          document.getElementById('home-channel').classList.toggle('hidden', key !== 'channel');
          document.getElementById('home-group').classList.toggle('hidden', key !== 'group');
          document.getElementById('home-info').classList.toggle('hidden', key !== 'info');

          document.querySelectorAll('[data-home-tab]').forEach(tab => {
            const active = tab === btn;
            tab.classList.toggle('text-[#b9a4ff]', active);
            tab.classList.toggle('muted', !active);
            tab.classList.toggle('border-violet-500', active);
            tab.classList.toggle('border-transparent', !active);
          });
        });
      });
    }

    function initChatViewport() {
      const input = document.getElementById('post-input');
      const chat = document.getElementById('home-group');
      if (!input || !chat) return;

      let baselineHeight = window.innerHeight;
      let blurTimer;

      function updateViewport() {
        const isFocused = document.activeElement === input;
        if (!isFocused) {
          baselineHeight = Math.max(baselineHeight, window.innerHeight);
          document.body.classList.remove('chat-keyboard-open');
          document.documentElement.style.setProperty('--chat-keyboard-inset', '0px');
          return;
        }

        const viewport = window.visualViewport;
        const visibleHeight = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
        const layoutWasResized = baselineHeight - window.innerHeight > 120;
        const keyboardOpen = layoutWasResized || baselineHeight - visibleHeight > 120;
        const wasOpen = document.body.classList.contains('chat-keyboard-open');
        const keyboardInset = layoutWasResized ? 0 : Math.max(0, baselineHeight - visibleHeight);

        document.body.classList.toggle('chat-keyboard-open', keyboardOpen);
        document.documentElement.style.setProperty('--chat-keyboard-inset', `${keyboardInset}px`);
        if (keyboardOpen && !wasOpen) {
          requestAnimationFrame(() => {
            const feed = document.getElementById('posts-feed');
            if (feed) feed.scrollTop = feed.scrollHeight;
          });
        }
      }

      input.addEventListener('focus', () => {
        clearTimeout(blurTimer);
        baselineHeight = Math.max(baselineHeight, window.innerHeight);
        updateViewport();
      });
      input.addEventListener('blur', () => {
        blurTimer = setTimeout(updateViewport, 100);
      });
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
      });
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          createNewPost();
        }
      });
      window.addEventListener('resize', updateViewport);
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateViewport);
        window.visualViewport.addEventListener('scroll', updateViewport);
      }
    }

    function renderRewardTabs() {
      document.querySelectorAll('[data-reward-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.rewardTab;
          document.querySelectorAll('.reward-view').forEach(view => view.classList.add('hidden'));
          const target = document.getElementById(`reward-${key}`);
          if (target) target.classList.remove('hidden');
          if (apiViewConfig[key]) loadApiView(key);

          document.querySelectorAll('[data-reward-tab]').forEach(tab => {
            const active = tab === btn;
            tab.classList.toggle('active-sub', active);
            tab.classList.toggle('muted', !active);
            tab.classList.toggle('border-violet-500', active);
            tab.classList.toggle('border-transparent', !active);
            tab.classList.toggle('text-white', active);
          });
        });
      });
    }

    function renderPostsFeed() {
      const postsFeed = document.getElementById('posts-feed');
      if (!postsFeed) return;
      const roles = {
        user: 'Użytkownik',
        moderator: 'Moderator',
        admin: 'Administrator',
        system: 'System'
      };
      postsFeed.replaceChildren();
      state.posts.slice().reverse().forEach(post => {
      postsFeed.innerHTML = state.posts.slice().reverse().map(post => {
        const author = String(post.author || 'Użytkownik');
        const requestedRole = post.role;
        const role = roles[requestedRole] ? requestedRole
          : author === 'System' ? 'system'
          : author.toLowerCase().includes('admin') ? 'admin'
          : author.toLowerCase().includes('moderator') ? 'moderator'
          : 'user';
        const article = document.createElement('article');
        article.className = 'panel chat-message space-y-2';
        article.dataset.messageRole = role;
        article.innerHTML = '<div class="flex items-center justify-between"><div class="flex items-center gap-2"><div class="post-avatar w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-[10px] font-black text-slate-950"></div><div><div class="post-author text-[10px] font-semibold text-white"></div><div class="post-time text-[9px] muted"></div></div></div><span class="post-role text-[9px] text-cyan-300"></span></div><p class="post-text text-xs text-slate-200 leading-relaxed"></p><div class="post-media"></div><div class="flex items-center gap-3 text-[10px] text-slate-400"><span>♡ 42</span><span>◌ 9</span><span>↗ 3</span></div><div class="chat-message-actions" data-message-actions aria-label="Przyszłe akcje moderacyjne"></div>';
        article.querySelector('.post-avatar').textContent = author.slice(0, 1).toUpperCase();
        article.querySelector('.post-author').textContent = author;
        article.querySelector('.post-time').textContent = String(post.time || '');
        article.querySelector('.post-role').textContent = roles[role];
        article.querySelector('.post-text').textContent = String(post.text || '');
        if (post.media) {
          try {
            const mediaUrl = new URL(post.media, window.location.href);
            if (['http:', 'https:'].includes(mediaUrl.protocol)) {
              const image = document.createElement('img');
              image.src = mediaUrl.href;
              image.alt = 'Załącznik do posta';
              image.className = 'w-full rounded-xl border border-slate-800 object-cover max-h-48';
              article.querySelector('.post-media').appendChild(image);
            }
          } catch (_) {}
        }
        postsFeed.appendChild(article);
      });
        return `
        <article class="panel chat-message space-y-2" data-message-role="${role}">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-[10px] font-black text-slate-950">${escapeHTML(author.slice(0, 1).toUpperCase())}</div>
              <div>
                <div class="text-[10px] font-semibold text-white">${escapeHTML(author)}</div>
                <div class="text-[9px] muted">${escapeHTML(post.time)}</div>
              </div>
            </div>
            <span class="text-[9px] text-cyan-300" data-role="${role}">${roles[role]}</span>
          </div>
          <p class="text-xs text-slate-200 leading-relaxed">${escapeHTML(post.text)}</p>
          ${safeMediaURL(post.media) ? `<img src="${escapeHTML(safeMediaURL(post.media))}" alt="media" class="w-full rounded-xl border border-slate-800 object-cover max-h-48" />` : ''}
          <div class="flex items-center gap-3 text-[10px] text-slate-400">
            <span><i class="fa-regular fa-heart"></i> 42</span>
            <span><i class="fa-regular fa-comment"></i> 9</span>
            <span><i class="fa-regular fa-share-from-square"></i> 3</span>
          </div>
          <div class="chat-message-actions" data-message-actions aria-label="Przyszłe akcje moderacyjne"></div>
        </article>
      `;
      }).join('');
      postsFeed.scrollTop = postsFeed.scrollHeight;
    }

    function renderChannelFeed() {
      const feed = document.getElementById('channel-feed');
      if (!feed) return;
      feed.replaceChildren();
      state.channelPosts.forEach(post => {
        const article = document.createElement('article');
        article.className = 'panel p-3.5';
        article.innerHTML = '<div class="flex items-center justify-between gap-3 mb-2"><div class="flex items-center gap-2"><div class="channel-avatar w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-[10px] font-bold text-slate-950"></div><div><div class="channel-author text-[10px] font-semibold text-white"></div><div class="channel-time text-[9px] muted"></div></div></div><span class="text-[10px] text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5">Official</span></div><p class="channel-text text-xs text-slate-200 leading-relaxed"></p><div class="channel-media"></div><div class="channel-link"></div>';
        const author = String(post.author || 'TechnixPro');
        article.querySelector('.channel-avatar').textContent = author.slice(0, 1).toUpperCase();
        article.querySelector('.channel-author').textContent = author;
        article.querySelector('.channel-time').textContent = String(post.time || '');
        article.querySelector('.channel-text').textContent = String(post.text || '');
        if (post.media) {
          try {
            const mediaUrl = new URL(post.media, window.location.href);
            if (['http:', 'https:'].includes(mediaUrl.protocol)) {
              const image = document.createElement('img');
              image.src = mediaUrl.href;
              image.alt = 'Załącznik kanału';
              image.className = 'mt-3 rounded-xl w-full object-cover max-h-44 border border-slate-800';
              article.querySelector('.channel-media').appendChild(image);
            }
          } catch (_) {}
        }
        if (post.link) {
          try {
            const linkUrl = new URL(post.link, window.location.href);
            if (['http:', 'https:'].includes(linkUrl.protocol)) {
              const link = document.createElement('a');
              link.href = linkUrl.href;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              link.className = 'block mt-2 text-xs text-cyan-400 underline';
              link.textContent = String(post.link);
              article.querySelector('.channel-link').appendChild(link);
            }
          } catch (_) {}
        }
        feed.appendChild(article);
      });
      feed.innerHTML = state.channelPosts.map(post => `
        <article class="panel p-3.5">
          <div class="flex items-center justify-between gap-3 mb-2">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-[10px] font-bold text-slate-950">${escapeHTML(String(post.author || 'T').slice(0, 1).toUpperCase())}</div>
              <div>
                <div class="text-[10px] font-semibold text-white">${escapeHTML(post.author)}</div>
                <div class="text-[9px] muted">${escapeHTML(post.time)}</div>
              </div>
            </div>
            <span class="text-[10px] text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5">Official</span>
          </div>
          <p class="text-xs text-slate-200 leading-relaxed">${escapeHTML(post.text)}</p>
          ${safeMediaURL(post.media) ? `<img src="${escapeHTML(safeMediaURL(post.media))}" class="mt-3 rounded-xl w-full object-cover max-h-44 border border-slate-800" alt="channel" />` : ''}
          ${safeMediaURL(post.link) ? `<a href="${escapeHTML(safeMediaURL(post.link))}" target="_blank" rel="noopener noreferrer" class="block mt-2 text-xs text-cyan-400 underline">${escapeHTML(post.link)}</a>` : ''}
        </article>
      `).join('');
    }

    function createNewPost() {
      const input = document.getElementById('post-input');
      const text = input.value.trim();
      if (!text) { showToast('Napisz treść posta zanim opublikujesz.'); return; }
      state.posts.unshift({
        author: currentUser.first_name || 'Ty',
        text,
        media: '',
        time: 'teraz'
      });
      renderPostsFeed();
      input.value = '';
      input.style.height = '';
      showToast('Post został dodany do grupy.');
      addStars(12, 'Nowy post');
    }

    // Panel Admina - Przełączanie podzakładek
    window.switchAdminTab = function(tabKey, button = document.querySelector(`[data-admin-tab="${tabKey}"]`)) {
      const activeView = document.getElementById(`admin-sub-${tabKey}`);
      if (!activeView) return;

      document.querySelectorAll('.admin-sub-view').forEach(view => view.classList.add('hidden'));
      activeView.classList.remove('hidden');
      document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('text-violet-400', 'border-violet-500', 'border-b-2');
        btn.classList.add('text-slate-400', 'border-transparent');
      });
      if (button) {
        button.classList.remove('text-slate-400', 'border-transparent');
        button.classList.add('text-violet-400', 'border-violet-500', 'border-b-2');
      }
    }

    function publishChannelPost() {
      const input = document.getElementById('admin-post-input');
      const media = document.getElementById('admin-media-input');
      const link = document.getElementById('admin-link-input');
      const text = input.value.trim();
      if (!text) { showToast('Wpisz treść posta kanałowego.'); return; }
      state.channelPosts.unshift({
        author: 'Admin (Ty)',
        text,
        media: media.value.trim(),
        link: link.value.trim(),
        time: 'teraz'
      });
      renderChannelFeed();
      input.value = '';
      media.value = '';
      link.value = '';
      showToast('Opublikowano post, grafikę lub załącznik na kanale.');
      addStars(25, 'Panel Administratora');
    }

    function initTelegramProfile() {
      const user = currentUser;
      const username = document.getElementById('telegram-username');
      const profileName = document.getElementById('profile-name');
      const profileId = document.getElementById('profile-id');
      const avatarFallback = document.getElementById('profile-avatar-fallback');
      const avatarImg = document.getElementById('profile-avatar-img');
      const headerAvatar = document.getElementById('header-avatar');
      const adminPanelContainer = document.getElementById('admin-panel-container');

      const name = user.first_name || 'Guest';
      const usernameText = user.username ? `@${user.username}` : '@guest';
      const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Guest';
      const usernameText = user.username ? `@${user.username}` : (user.first_name || 'Gość');

      if (username) username.textContent = usernameText;
      const rankUserLabel = document.getElementById('rank-user-label');
      if (rankUserLabel) rankUserLabel.textContent = `Ty (${user.username ? `@${user.username}` : user.first_name || 'Gość'})`;
      if (profileName) profileName.textContent = name;
      if (profileId) profileId.textContent = user.id ? `TG ID: ${user.id}` : 'TG ID: brak danych';
      if (headerAvatar) headerAvatar.textContent = name.slice(0, 2).toUpperCase();
      const referralLink = document.getElementById('ref-link-input');
      if (referralLink) {
        const bot = (window.CONFIG && window.CONFIG.TELEGRAM_BOT_USERNAME) || 'TechnixProBot';
        referralLink.value = `https://t.me/${bot}?start=ref_${user.id}`;
      }
      const rankName = document.getElementById('rank-user-label');
      if (rankName) rankName.textContent = `Ty (@${user.username})`;
      const botName = window.CONFIG?.BOT_USERNAME || 'TechnixProBot';
      if (referralLink) referralLink.value = `https://t.me/${encodeURIComponent(botName)}?start=ref_${encodeURIComponent(user.id || 0)}`;

      // Sprawdzenie uprawnień administratora wg ID (lub jeśli ADMIN_TELEGRAM_ID to 0 dla testów lokalnych możesz dostosować)
      // Jeśli chcesz, aby na testach lokalnych panel był widoczny, zmień warunek lub ustaw ADMIN_TELEGRAM_ID równe Twojemu ID.
      const isOwner = (user.id === ADMIN_TELEGRAM_ID) || (ADMIN_TELEGRAM_ID === 0); 
      if (adminPanelContainer && isOwner) {
        adminPanelContainer.classList.remove('hidden');
      }

      if (user.photo_url && avatarImg && avatarFallback && headerAvatar) {
        try {
          const avatarUrl = new URL(user.photo_url);
          if (avatarUrl.protocol === 'https:') {
            avatarImg.src = avatarUrl.href;
            avatarImg.classList.remove('hidden');
            avatarFallback.classList.add('hidden');
            headerAvatar.textContent = '';
            headerAvatar.style.backgroundImage = `url("${avatarUrl.href}")`;
            headerAvatar.style.backgroundSize = 'cover';
            headerAvatar.style.backgroundPosition = 'center';
          }
        } catch (_) {}
      const photoURL = safeMediaURL(user.photo_url);
      if (photoURL && avatarImg && avatarFallback && headerAvatar) {
        avatarImg.src = photoURL;
        avatarImg.classList.remove('hidden');
        avatarFallback.classList.add('hidden');
        headerAvatar.textContent = '';
        headerAvatar.style.backgroundImage = `url("${photoURL.replace(/["\\]/g, '')}")`;
        headerAvatar.style.backgroundSize = 'cover';
        headerAvatar.style.backgroundPosition = 'center';
      }
    }

    const shopUi = { loading: new Set(), errors: new Set() };
    const PURCHASE_STATUS = { paid: 'Opłacone', pending: 'Oczekuje', refunded: 'Zwrot', failed: 'Błąd', cancelled: 'Anulowane' };

    function getCatalog() {
      return Array.isArray(window.SHOP_CATALOG) ? window.SHOP_CATALOG : [];
    }

    function ownedCount(id) {
      return Number(state.owned[id]) || 0;
    }

    function getOwnedRigParts() {
      const parts = {};
      getCatalog().forEach(item => {
        if (item.type === 'rig_part' && item.effect && item.effect.part && ownedCount(item.id) > 0) parts[item.effect.part] = true;
      });
      return parts;
    }

    function applyEffects() {
      let energyBonus = 0;
      let theme = '';
      getCatalog().forEach(item => {
        if (ownedCount(item.id) < 1 || !item.effect) return;
        if (item.effect.type === 'energy_max') energyBonus += Number(item.effect.value) || 0;
        if (item.effect.type === 'cosmetic' && item.effect.theme) theme = item.effect.theme;
      });
      state.energyMax = 1000 + energyBonus;
      if (theme) document.body.dataset.coreTheme = theme; else delete document.body.dataset.coreTheme;
    }

    // Server response ({ owned, purchases }) is the only source of truth for owned goods.
    function applyServerState(data, silent) {
      if (!data) return;
      const owned = {};
      if (data.owned && typeof data.owned === 'object') {
        Object.keys(data.owned).forEach(id => { owned[id] = Number(data.owned[id]) || 0; });
      }
      state.owned = owned;
      state.purchases = Array.isArray(data.purchases) ? data.purchases : [];
      applyEffects();
    async function buyRigPartWithStars(itemKey, cost, button) {
      button.disabled = true;
      button.textContent = 'Łączenie z Telegramem…';
      try {
        const payment = await TechnixAPI.purchaseRigPart(itemKey, cost);
        if (payment && payment.owned) {
          completePurchase(itemKey, payment);
        } else if (payment?.status === 'cancelled') {
          showToast('Płatność została anulowana.');
        } else if (payment?.status === 'failed') {
          showToast('Płatność Telegram Stars nie powiodła się.');
        } else {
          showToast('Płatność oczekuje na potwierdzenie.');
        }
      } catch (error) {
        showToast(error.message || 'Nie udało się rozpocząć płatności Telegram Stars.');
      } finally {
        if (button.isConnected && !state.rigParts[itemKey]) {
          button.disabled = false;
          button.textContent = `Kup za ${cost} ⭐`;
        }
      }
    }

    function completePurchase(key, payment) {
      const item = state.rigCatalog.find(i => i.key === key);
      if (!item || !payment?.owned) return;
      state.rigParts = { ...state.rigParts, ...(payment.parts || {}), [key]: true };
      window.rigBuilder.renderRig(state.rigParts, { animateNew: true });
      scheduleStateSync();
      const scene = document.querySelector('.rig-station');
      if (scene && (scene.getBoundingClientRect().top < 0 || scene.getBoundingClientRect().bottom > window.innerHeight)) {
        scene.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (!item || !Object.prototype.hasOwnProperty.call(state.rigParts, key)) return;
      state.rigParts[key] = true;
      const ownedParts = Object.keys(state.rigParts).filter(part => state.rigParts[part]);
      window.RigBuilder?.renderRig(ownedParts, { animateNew: [key], focus: true });
      window.TechnixAPI?.saveRig(ownedParts).catch(() => {});
      scheduleStateSync();
      renderRigShop();
      renderPurchaseHistory();
      if (window.RigBuilder) window.RigBuilder.setOwned(getOwnedRigParts(), !!silent);
      if (typeof window.syncCryptoUI === 'function') window.syncCryptoUI();
    }

    function makeEl(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function setShopButton(button, item, owned) {
      button.textContent = '';
      if (owned) {
        button.className = 'shop-buy-btn bg-emerald-500/20 text-emerald-300 border border-emerald-500/20';
        button.disabled = true;
        button.appendChild(makeEl('span', '', 'Zakupione'));
      } else if (shopUi.loading.has(item.id)) {
        button.className = 'shop-buy-btn bg-slate-700 text-slate-200';
        button.disabled = true;
        button.appendChild(makeEl('i', 'fa-solid fa-spinner fa-spin'));
        button.appendChild(makeEl('span', '', ' Płatność…'));
      } else if (shopUi.errors.has(item.id)) {
        button.className = 'shop-buy-btn bg-rose-500/20 text-rose-300 border border-rose-500/30';
        button.disabled = false;
        button.appendChild(makeEl('span', '', 'Błąd – spróbuj ponownie'));
      } else {
        button.className = 'shop-buy-btn bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-extrabold';
        button.disabled = false;
        button.appendChild(makeEl('span', '', `Kup za ${item.priceXtr} ⭐ Stars`));
      }
    }

    function renderRigShop() {
      const rigShop = document.getElementById('rig-shop');
      if (!rigShop) return;
      const mockBadge = document.getElementById('shop-mock-badge');
      if (mockBadge) mockBadge.classList.toggle('hidden', !(window.Payments && window.Payments.isMock));
      rigShop.textContent = '';
      getCatalog().forEach(item => {
        const owned = ownedCount(item.id) >= item.maxOwned;
        const card = makeEl('div', 'shop-item');
        card.dataset.product = item.id;

        const icon = makeEl('div', 'shop-item-icon');
        icon.appendChild(makeEl('i', `fa-solid ${item.icon}`));
        card.appendChild(icon);

        const info = makeEl('div');
        info.appendChild(makeEl('div', 'text-[10px] font-semibold text-white', item.title));
        info.appendChild(makeEl('div', 'text-[9px] muted', item.description));
        const price = makeEl('div', 'text-[9px] text-amber-400 font-bold');
        price.appendChild(makeEl('i', 'fa-solid fa-star'));
        price.appendChild(makeEl('span', '', ` ${item.priceXtr} XTR`));
        info.appendChild(price);
        card.appendChild(info);

        const button = makeEl('button');
        button.type = 'button';
        button.dataset.buy = item.id;
        setShopButton(button, item, owned);
        card.appendChild(button);
        rigShop.appendChild(card);
      });
    }

    function renderPurchaseHistory() {
      const box = document.getElementById('purchase-history');
      if (!box) return;
      box.textContent = '';
      if (!state.purchases.length) {
        box.appendChild(makeEl('p', 'text-[10px] muted', 'Brak zakupów.'));
        return;
      }
      state.purchases.forEach(entry => {
        const product = getCatalog().find(item => item.id === entry.productId);
        const date = new Date(entry.createdAt);
        const row = makeEl('div', 'flex items-center justify-between gap-2 text-[10px] bg-slate-900/60 rounded-lg px-3 py-2');
        const left = makeEl('div');
        left.appendChild(makeEl('div', 'font-semibold text-white', product ? product.title : String(entry.productId)));
        left.appendChild(makeEl('div', 'muted', isNaN(date) ? '' : date.toLocaleString('pl-PL')));
        const right = makeEl('div', 'text-right');
        right.appendChild(makeEl('div', 'text-amber-400 font-bold', `${Number(entry.priceXtr) || 0} XTR`));
        right.appendChild(makeEl('div', entry.status === 'paid' ? 'text-emerald-400' : 'muted', PURCHASE_STATUS[entry.status] || String(entry.status)));
        row.appendChild(left);
        row.appendChild(right);
        box.appendChild(row);
      const paymentNote = document.getElementById('rig-payment-note');
      if (paymentNote) paymentNote.textContent = window.CONFIG?.USE_MOCK_API
        ? 'Tryb demonstracyjny — nie jest pobierana rzeczywista płatność.'
        : 'Płatność przez Telegram Stars (XTR).';
      const previewViews = {
        monitor: '170 60 180 160',
        keyboard: '292 214 154 36',
        mouse: '450 210 54 36',
        case: '394 239 142 100',
        fan: '423 256 62 62',
        ram: '414 250 32 68',
        gpu: '404 294 84 36'
      };
      rigShop.replaceChildren();
      state.rigCatalog.forEach(item => {
        const owned = state.rigParts[item.key];
        const card = document.createElement('div');
        card.className = `shop-item${owned ? ' shop-item-owned' : ''}`;
        card.innerHTML = '<div class="shop-item-preview" data-preview><svg viewBox=""><use></use></svg></div><div><div class="shop-item-title text-[10px] font-semibold text-white"></div><div class="shop-item-cost text-[9px] text-amber-400 font-bold"></div><div class="shop-installed hidden text-[9px] font-bold">Zamontowano</div></div><button type="button" data-rig class="px-2 py-2 rounded-lg transition active:scale-95"></button>';
        const preview = card.querySelector('[data-preview]');
        preview.dataset.preview = item.key;
        preview.querySelector('svg').setAttribute('viewBox', previewViews[item.key]);
        preview.querySelector('use').setAttribute('href', `#rig-${item.key}`);
        card.querySelector('.shop-item-title').textContent = item.name;
        card.querySelector('.shop-item-cost').textContent = `${item.cost} ★ Telegram Stars`;
        card.querySelector('.shop-installed').classList.toggle('hidden', !owned);
        const button = card.querySelector('[data-rig]');
        button.dataset.rig = item.key;
        button.dataset.cost = String(item.cost);
        button.className += owned
          ? ' bg-emerald-500/20 text-emerald-300 border border-emerald-500/20'
          : ' bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-extrabold';
        button.textContent = owned ? 'Zamontowano' : `Kup za ${item.cost} ⭐`;
        button.setAttribute('aria-label', owned ? `${item.name}: zamontowano` : `Kup ${item.name} za ${item.cost} Telegram Stars`);
        button.disabled = Boolean(owned);
        rigShop.appendChild(card);
      });
        return `
          <div class="shop-item" data-part="${item.key}" title="${escapeHTML(item.name)}">
            <div class="shop-item-preview" aria-label="${escapeHTML(`Podgląd: ${item.name}`)}"></div>
            <div>
              <div class="text-[10px] font-semibold text-white">${escapeHTML(item.name)}</div>
              <div class="text-[9px] text-amber-400 font-bold">${Number(item.cost) || 0} ★ Telegram Stars</div>
            </div>
            <button type="button" data-rig="${item.key}" data-cost="${Number(item.cost) || 0}" aria-label="${escapeHTML(`${owned ? 'Zamontowano' : 'Kup'}: ${item.name}`)}" ${owned ? 'disabled' : ''} class="${owned ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20' : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-extrabold'} px-2 py-2 rounded-lg transition active:scale-95">
              ${owned ? 'Zamontowano' : 'Kup (Stars)'}
            </button>
          </div>
        `;
      }).join('');

      rigShop.querySelectorAll('.shop-item-preview').forEach(preview => {
        const key = preview.closest('.shop-item')?.dataset.part;
        if (key && window.RigBuilder) preview.replaceChildren(window.RigBuilder.createPreview(key));
      });

      document.querySelectorAll('[data-rig]').forEach(button => {
        button.addEventListener('click', () => {
          const key = button.dataset.rig;
          const cost = Number(button.dataset.cost || 0);
          if (state.rigParts[key]) {
            showToast(`${state.rigCatalog.find(item => item.key === key)?.name || 'Część'} jest już odblokowana.`);
            const item = state.rigCatalog.find(entry => entry.key === key);
            showToast(`${item?.name || 'Ta część'} jest już zamontowana.`);
            return;
          }
          buyRigPartWithStars(key, cost, button);
        });
      });
    }

    async function buyProduct(id) {
      const item = getCatalog().find(p => p.id === id);
      const payments = window.Payments;
      if (!item || !payments) return;
      if (ownedCount(id) >= item.maxOwned) {
        showToast(`${item.title} jest już zakupione.`);
        return;
      }
      if (shopUi.loading.has(id)) return;
      if (!payments.isMock && !payments.inTelegram()) {
        showToast('Zakupy za Telegram Stars działają tylko w aplikacji Telegram.');
        return;
      }
      shopUi.loading.add(id);
      shopUi.errors.delete(id);
      renderRigShop();
      const result = await payments.purchase(id);
      shopUi.loading.delete(id);
      const mockTag = payments.isMock ? ' (MOCK)' : '';
      if (result.status === 'paid') {
        applyServerState(result.data);
        if (window.FX) window.FX.haptic('notify', 'success');
        showToast(`${item.title} zakupione za ${item.priceXtr} XTR!${mockTag}`);
        return;
      }
      if (result.status === 'cancelled') {
        showToast('Płatność anulowana.');
      } else if (result.status === 'pending') {
        if (result.data) applyServerState(result.data, true);
        showToast('Płatność oczekuje na potwierdzenie serwera.');
      } else if (result.status === 'unavailable') {
        showToast('Zakupy za Telegram Stars działają tylko w aplikacji Telegram.');
      } else if (result.status !== 'busy') {
        shopUi.errors.add(id);
        if (window.FX) window.FX.haptic('notify', 'error');
        showToast(`Płatność nie powiodła się.${mockTag}`);
      }
      renderRigShop();
    }

    function initShop() {
      const rigShop = document.getElementById('rig-shop');
      if (rigShop) {
        rigShop.addEventListener('click', event => {
          const button = event.target.closest('[data-buy]');
          if (button && !button.disabled) buyProduct(button.dataset.buy);
        });
      }
      renderRigShop();
      renderPurchaseHistory();
      if (window.RigBuilder) window.RigBuilder.init();
      // Restore owned goods from the server (GET /api/me); mock mode uses localStorage.
      if (window.Payments) {
        window.Payments.loadMe().then(data => applyServerState(data, true)).catch(() => {});
      }
    }

    function renderEmission(snap) {
      const set = (id, text) => { const node = document.getElementById(id); if (node) node.textContent = text; };
      const pct = `${Math.min(snap.ratio * 100, 100).toFixed(2)}%`;
      const fill = document.getElementById('tech-progress-fill');
      const capsule = document.getElementById('tech-capsule-fill');
      if (fill) fill.style.width = pct;
      if (capsule) capsule.style.width = pct;
      set('tech-mined-value', formatK(Math.floor(snap.mined)));
      set('tech-progress-text', `${formatK(Math.floor(snap.mined))} / ${formatK(snap.supply)}`);
      set('tech-supply-limit', formatK(snap.supply));
      set('tech-remaining-time', snap.ended ? 'Cykl zakończony' : snap.remainingText);
      set('tech-daily-rate', formatK(snap.perDay));
      set('tech-status-word', snap.status);
    }

    function initCryptoGame() {
      const techTokenCount = document.getElementById('tech-token-count');
      const energyValue = document.getElementById('energyValue');
      const energyMax = document.getElementById('energyMax');
      const energyFill = document.getElementById('energyFill');
      const energyBar = energyFill ? energyFill.parentElement : null;
      const tpBalance = document.getElementById('tpBalance');
      const coreClicker = document.getElementById('tech-core-clicker');
      const fx = window.FX;

      let mined = 0;
      let energyExact = state.energy;
      let regenRunning = false;

      function syncCryptoUI() {
        state.energy = Math.floor(energyExact);
        const ratio = state.energyMax ? Math.min(1, energyExact / state.energyMax) : 0;
        if (techTokenCount) fx ? fx.countTo(techTokenCount, mined, formatK) : (techTokenCount.textContent = formatK(mined));
        if (energyValue) energyValue.textContent = state.energy;
        if (energyMax) energyMax.textContent = state.energyMax;
        if (tpBalance) fx ? fx.countTo(tpBalance, state.tp, formatK) : (tpBalance.textContent = formatK(state.tp));
        if (energyFill) energyFill.style.transform = `scaleX(${ratio.toFixed(3)})`;
        if (energyBar) energyBar.classList.toggle('energy-low', ratio < 0.2);
        if (energyExact < state.energyMax) ensureRegen();
      }
      window.syncCryptoUI = syncCryptoUI;

      function ensureRegen() {
        if (regenRunning || !fx) return;
        regenRunning = true;
        fx.addTask(dt => {
          if (energyExact >= state.energyMax) { regenRunning = false; syncCryptoUI(); return false; }
          energyExact = Math.min(state.energyMax, energyExact + 5 * dt);
      let totalSupply = 100000000;
      let currentCycle = 60 * 60 * 24 * 60;
      let lastEnergySync = Date.now();

      function syncCryptoUI() {
        const ratio = minedAmount / totalSupply;
        if (techProgressFill) techProgressFill.style.width = `${Math.min(ratio * 100, 100)}%`;
        if (techTokenFill) techTokenFill.style.width = `${Math.min(ratio * 100, 100)}%`;

        const remainingSeconds = Math.max(0, Math.floor((emissionEndsAt - Date.now()) / 1000));
        const days = Math.floor(remainingSeconds / 86400);
        const hrs = Math.floor((remainingSeconds % 86400) / 3600);
        const mins = Math.floor((remainingSeconds % 3600) / 60);
        const secs = remainingSeconds % 60;

        if (techRemaining) techRemaining.textContent = `${days}d ${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        if (techTokenCount) techTokenCount.textContent = formatK(Math.round(minedAmount));
        if (techMinedValue) techMinedValue.textContent = formatK(Math.round(minedAmount));
        if (techProgressText) techProgressText.textContent = `${formatK(minedAmount)} / ${formatK(totalSupply)}`;
        if (energyValue) energyValue.textContent = state.energy;
        if (energyMax) energyMax.textContent = state.energyMax;
        if (tpBalance) tpBalance.textContent = formatK(state.tp);
        if (energyFill) energyFill.style.width = `${Math.min(Math.max((state.energy / state.energyMax) * 100, 0), 100)}%`;
      }

      if (coreClicker) {
        coreClicker.addEventListener('click', () => {
          if (state.energy < 15) {
            showToast('Brakuje energii! Poczekaj na regenerację.');
            return;
          }
          state.energy = Math.max(0, state.energy - 15);
          state.tp += 25;
          minedAmount = Math.min(totalSupply, minedAmount + 25);
          state.taps += 1;
          mined = Math.min(totalSupply, mined + 25);
          syncCryptoUI();
          scheduleStateSync();
        });
      }

      function tap() {
        if (energyExact < 15) {
          showToast('Brakuje energii! Poczekaj na regenerację.');
          if (energyBar && fx) fx.pop(energyBar);
          return { ok: false };
      syncCryptoUI();

      setInterval(() => {
        if (state.energy < state.energyMax) {
          state.energy = Math.min(state.energyMax, state.energy + 5);
        }
        energyExact -= 15;
        state.tp += 25;
        mined += 25;
        syncCryptoUI();
        ensureRegen();
        return { ok: true, label: '+25' };
      }

      if (coreClicker) {
        if (fx) {
          fx.bindTapCore(coreClicker, tap);
        } else {
          coreClicker.addEventListener('pointerdown', tap);
        }
      }

      syncCryptoUI();
      ensureRegen();
      if (!fx) {
        setInterval(() => { energyExact = Math.min(state.energyMax, energyExact + 5); syncCryptoUI(); }, 1000);
      }

      if (window.Emission) {
        window.Emission.subscribe(renderEmission);
        window.Emission.init();
      }
        if (Date.now() % 15000 < 1000) scheduleStateSync();
        if (Date.now() - lastEnergySync >= 10000) {
          lastEnergySync = Date.now();
          scheduleStateSync();
        }
      }, 1000);
    }

    function bindGlobalActions() {
      document.querySelectorAll('[data-admin-tab]').forEach(button => {
        button.addEventListener('click', () => window.switchAdminTab(button.dataset.adminTab, button));
      });

      document.querySelectorAll('[data-screen]').forEach(button => {
        button.addEventListener('click', () => {
          const key = button.dataset.screen;
          if (key === 'home') show('home', 'Sieć społeczna');
          if (key === 'crypto') show('crypto', 'TechnixPro');
          if (key === 'gift') show('gift', 'Bonusy');
          if (key === 'wallet') show('wallet', 'Portfel');
          if (key === 'profile') show('profile', 'Profil');
          if (key === 'menu') show('menu', 'Menu Główne');
          if (key === 'search') show('search', 'Wyszukiwarka');
          if (key === 'notifications') show('notifications', 'Powiadomienia');
        });
      });

      document.querySelectorAll('.claim-reward').forEach(button => {
        button.addEventListener('click', () => {
          const reward = Number(button.dataset.bonus || 0);
          const label = button.dataset.label || 'Nagroda';
          addStars(reward, label);
        });
      });

      const copyRefBtn = document.getElementById('copy-ref-link');
      if (copyRefBtn) {
        copyRefBtn.addEventListener('click', () => {
          const input = document.getElementById('ref-link-input');
          if (input) {
            input.select();
            document.execCommand('copy');
            showToast('Link polecający został skopiowany.');
          }
        });
      }

      const pubPostBtn = document.getElementById('publish-post-btn');
      if (pubPostBtn) pubPostBtn.addEventListener('click', publishChannelPost);

      const createPostBtn = document.getElementById('create-post-btn');
      if (createPostBtn) createPostBtn.addEventListener('click', createNewPost);

      // Obsługa formularza zapisywania eventu live z panelu admina
      const saveEventBtn = document.getElementById('save-event-btn');
      if (saveEventBtn) {
        saveEventBtn.addEventListener('click', () => {
          const titleInput = document.getElementById('admin-event-title').value.trim();
          const descInput = document.getElementById('admin-event-desc').value.trim();
          const rewardInput = Number(document.getElementById('admin-event-reward').value);

          if (titleInput) state.liveEvent.title = titleInput;
          if (descInput) state.liveEvent.desc = descInput;
          if (rewardInput) state.liveEvent.reward = rewardInput;

          // Aktualizacja widoku eventu w sekcji Bonusy -> Eventy Live
          document.getElementById('live-event-title').textContent = state.liveEvent.title;
          document.getElementById('live-event-desc').textContent = state.liveEvent.desc;
          const eventBtn = document.getElementById('live-event-action-btn');
          eventBtn.dataset.reward = state.liveEvent.reward;
          eventBtn.textContent = `Dodaj +${state.liveEvent.reward} ★`;

          showToast('Event live został zaktualizowany.');
        });
      }

      // Obsługa dodawania nowych zadań z panelu admina
      const addTaskBtn = document.getElementById('add-task-btn');
      if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => {
          const titleInput = document.getElementById('admin-new-task-title').value.trim();
          const rewardInput = Number(document.getElementById('admin-new-task-reward').value);

          if (!titleInput || !rewardInput) {
            showToast('Wypełnij pola nowego zadania.');
            return;
          }

          state.tasks.push({ title: titleInput, reward: rewardInput, label: 'Admin' });
          renderTaskList();
          document.getElementById('admin-new-task-title').value = '';
          document.getElementById('admin-new-task-reward').value = '';
          showToast('Nowe zadanie zostało dodane do zakładki Zadania.');
        });
      }

      document.querySelectorAll('.wallet-toast-btn, .profile-toast-btn').forEach(button => {
        button.addEventListener('click', () => {
          const msg = button.textContent.trim() || 'Akcja aktywowana';
          showToast(`${msg}: moduł w fazie 3.`);
        });
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) flushState();
      });
      window.addEventListener('beforeunload', flushState);
    }

    async function seedInitialState() {
      currentUser = parseTelegramUser();
      try {
        const me = await TechnixAPI.getMe();
        if (me?.stars != null && Number.isFinite(Number(me.stars))) state.stars = Math.max(0, Number(me.stars));
        if (me?.energyMax != null && Number.isFinite(Number(me.energyMax)) && Number(me.energyMax) > 0) state.energyMax = Number(me.energyMax);
        if (me?.energy != null && Number.isFinite(Number(me.energy))) state.energy = Math.min(Math.max(Number(me.energy), 0), state.energyMax);
        if (me?.tp != null && Number.isFinite(Number(me.tp))) state.tp = Math.max(0, Number(me.tp));
        state.rigParts = { ...state.rigParts, ...(me?.rigParts || {}) };
        minedAmount = Number.isFinite(Number(me?.mined)) ? Math.min(Math.max(0, Number(me.mined)), 100000000) : 0;
        emissionEndsAt = Number.isFinite(Number(me?.emissionEndsAt)) ? Number(me.emissionEndsAt) : 0;
      } catch (_) {
        showToast('Nie udało się pobrać profilu. Używam danych lokalnych.');
      }
      let storedEmissionEnd = 0;
      try {
        storedEmissionEnd = Number(localStorage.getItem('technixpro-emission-ends-at')) || 0;
      } catch (_) {}
      emissionEndsAt = emissionEndsAt || storedEmissionEnd || Date.now() + 60 * 24 * 60 * 60 * 1000;
      try {
        localStorage.setItem('technixpro-emission-ends-at', String(emissionEndsAt));
      } catch (_) {}
      if (window.TechnixAPI) {
        const [meResult, rigResult] = await Promise.allSettled([
          window.TechnixAPI.getMe(),
          window.TechnixAPI.getRig()
        ]);
        if (meResult.status === 'fulfilled' && meResult.value) {
          const me = meResult.value;
          state.stars = Number.isFinite(Number(me.stars)) ? Math.max(0, Number(me.stars)) : state.stars;
          state.energy = Number.isFinite(Number(me.energy)) ? Math.max(0, Number(me.energy)) : state.energy;
          state.energyMax = Number.isFinite(Number(me.energyMax)) ? Math.max(1, Number(me.energyMax)) : state.energyMax;
          state.tp = Number.isFinite(Number(me.tp)) ? Math.max(0, Number(me.tp)) : state.tp;
          state.taps = Number.isFinite(Number(me.taps)) ? Math.max(0, Number(me.taps)) : state.taps;
        }
        const apiRig = rigResult.status === 'fulfilled' ? rigResult.value : null;
        const owned = Array.isArray(apiRig?.ownedParts) ? apiRig.ownedParts
          : (Array.isArray(meResult.value?.ownedParts) ? meResult.value.ownedParts : []);
        Object.keys(state.rigParts).forEach(key => { state.rigParts[key] = owned.includes(key); });
      }
      updateStarsDisplay();
      renderTaskList();
      renderRewardLog();
      renderPostsFeed();
      renderChannelFeed();
      initShop();
      window.rigBuilder.bindScene();
      window.rigBuilder.renderRig(state.rigParts);
      renderRigShop();
      window.RigBuilder?.renderRig(Object.keys(state.rigParts).filter(key => state.rigParts[key]));
      initTelegramProfile();
      window.rigBuilder.bindThumbnails();
      renderHomeSubtabs();
      initChatViewport();
      renderRewardTabs();
      bindGlobalActions();
      initCryptoGame();
      if (window.FX) window.FX.bindRipples();
      show('home', 'Sieć społeczna');
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) syncGameState(true);
    });
    window.addEventListener('beforeunload', () => syncGameState(true));
    window.addEventListener('load', seedInitialState);
