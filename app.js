    if (window.tailwind) window.tailwind.config = {
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

    const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
    if (tg) {
      tg.ready();
      tg.expand();
    }

    const telegramUser = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : {};
    const currentUser = {
      id: telegramUser.id || 0,
      username: telegramUser.username || '',
      first_name: telegramUser.first_name || 'Gość',
      photo_url: telegramUser.photo_url || '',
      language_code: telegramUser.language_code || 'pl'
    };
    window.currentUser = currentUser;

    // WPISZ TUTAJ SWOJE TELEGRAM ID, ABY WIDZIEĆ PANEL ADMINA
    const ADMIN_TELEGRAM_ID = 0; // np. 123456789

    const state = {
      stars: 1280,
      level: 1,
      energy: 1000,
      energyMax: 1000,
      tp: 240,
      taps: 0,
      mined: 0,
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
        { key: 'mouse', name: 'Myszka', icon: 'fa-computer-mouse', cost: 40 },
        { key: 'keyboard', name: 'Klawiatura', icon: 'fa-keyboard', cost: 60 },
        { key: 'monitor', name: 'Monitor', icon: 'fa-display', cost: 180 },
        { key: 'case', name: 'Obudowa', icon: 'fa-cube', cost: 100 },
        { key: 'ram', name: 'RAM', icon: 'fa-memory', cost: 80 },
        { key: 'gpu', name: 'GPU', icon: 'fa-microchip', cost: 270 },
        { key: 'fan', name: 'Chłodzenie', icon: 'fa-fan', cost: 120 }
      ]
    };
    const dataLoads = new Map();
    let syncTimer;
    let syncInFlight = false;
    let syncPending = false;

    function formatK(value) {
      return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
    }

    function escapeHTML(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[character]));
    }

    function safeMediaURL(value) {
      if (typeof value !== 'string' || !value.trim()) return '';
      try {
        const url = new URL(value, window.location.href);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
      } catch (error) {
        return '';
      }
    }

    function parseTelegramUser() {
      return currentUser;
    }

    function gameStateSnapshot() {
      return {
        stars: Number.isFinite(state.stars) ? state.stars : 0,
        energy: Number.isFinite(state.energy) ? state.energy : 0,
        energyMax: Number.isFinite(state.energyMax) ? state.energyMax : 1000,
        tp: Number.isFinite(state.tp) ? state.tp : 0,
        taps: Number.isFinite(state.taps) ? state.taps : 0,
        mined: Number.isFinite(state.mined) ? state.mined : 0,
        rigParts: Object.fromEntries(state.rigCatalog.map(item => [item.key, Boolean(state.rigParts[item.key])]))
      };
    }

    function flushGameState(keepalive = false) {
      clearTimeout(syncTimer);
      const payload = {
        clientRequestId: window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: new Date().toISOString(),
        state: gameStateSnapshot()
      };
      window.TechnixAPI.cacheState(payload.state);
      if (syncInFlight) { syncPending = true; return; }
      syncInFlight = true;
      window.TechnixAPI.syncState(payload, keepalive).catch(() => {}).finally(() => {
        syncInFlight = false;
        if (syncPending) {
          syncPending = false;
          flushGameState();
        }
      });
    }

    function scheduleGameSync() {
      window.TechnixAPI.cacheState(gameStateSnapshot());
      clearTimeout(syncTimer);
      syncTimer = setTimeout(flushGameState, 3000);
    }

    function applyMeData(me) {
      if (!me || typeof me !== 'object') return;
      const game = me.gameState || {};
      ['stars', 'energy', 'energyMax', 'tp', 'taps', 'mined'].forEach(key => {
        if (Number.isFinite(Number(game[key]))) state[key] = Number(game[key]);
      });
      if (game.rigParts && typeof game.rigParts === 'object') {
        state.rigParts = { ...state.rigParts, ...game.rigParts };
      }
      updateStarsDisplay();
    }

    function setApiStatus(screenName, status, message = '') {
      const screen = document.getElementById(`screen-${screenName}`);
      if (!screen) return;
      let host = screen.querySelector('.api-state');
      if (!host) {
        host = document.createElement('div');
        host.className = 'api-state';
        host.setAttribute('aria-live', 'polite');
        screen.prepend(host);
      }
      host.replaceChildren();
      if (status === 'ready') return host.remove();
      const card = document.createElement('div');
      card.className = `api-state-card ${status}`;
      if (status === 'loading') {
        card.innerHTML = '<span class="api-skeleton"></span><span class="api-skeleton short"></span><span class="sr-only">Ładowanie danych…</span>';
      } else {
        const text = document.createElement('span');
        text.textContent = status === 'error' ? message || 'Nie udało się pobrać danych.' : 'Brak danych do wyświetlenia.';
        card.append(text);
        if (status === 'error') {
          const retry = document.createElement('button');
          retry.type = 'button';
          retry.className = 'api-retry';
          retry.textContent = 'Spróbuj ponownie';
          retry.dataset.retryScreen = screenName;
          card.append(retry);
        }
      }
      host.append(card);
    }

    async function loadScreenData(screenName, force = false) {
      if (!window.TechnixAPI) return;
      if (!force && dataLoads.has(screenName)) return dataLoads.get(screenName);
      const requests = {
        home: () => [window.TechnixAPI.getPosts(), window.TechnixAPI.getChannelPosts()],
        crypto: () => [window.TechnixAPI.getRig()],
        gift: () => [window.TechnixAPI.getTasks(), window.TechnixAPI.getLeaderboard(), window.TechnixAPI.getReferrals()],
        wallet: () => [window.TechnixAPI.getWallet()],
        profile: () => [window.TechnixAPI.getMe()],
        notifications: () => [window.TechnixAPI.getNotifications()]
      }[screenName];
      if (!requests) return;
      setApiStatus(screenName, 'loading');
      const requestPromise = Promise.all(requests()).then(results => {
        let empty = false;
        if (screenName === 'home') {
          state.posts = Array.isArray(results[0]) ? results[0] : [];
          state.channelPosts = Array.isArray(results[1]) ? results[1] : [];
          renderPostsFeed();
          renderChannelFeed();
          empty = state.posts.length === 0 && state.channelPosts.length === 0;
        } else if (screenName === 'crypto') {
          const rig = results[0] || {};
          state.rigParts = { ...state.rigParts, ...(rig.parts || rig.rigParts || {}) };
          window.rigBuilder.renderRig(state.rigParts);
          renderRigShop();
          empty = false;
        } else if (screenName === 'gift') {
          state.tasks = Array.isArray(results[0]) ? results[0] : [];
          state.leaderboard = Array.isArray(results[1]) ? results[1] : [];
          state.referrals = results[2] || { count: 0, rewards: 0, items: [] };
          renderTaskList();
          renderLeaderboard();
          renderReferrals();
          empty = !state.tasks.length && !state.leaderboard.length;
        } else if (screenName === 'wallet') {
          renderWallet(results[0] || {});
          empty = !results[0] || !Object.keys(results[0]).length;
        } else if (screenName === 'profile') {
          applyMeData(results[0]);
          empty = !results[0] || !Object.keys(results[0]).length;
        } else if (screenName === 'notifications') {
          renderNotifications(Array.isArray(results[0]) ? results[0] : []);
          empty = !results[0] || !results[0].length;
        }
        setApiStatus(screenName, empty ? 'empty' : 'ready');
      }).catch(error => setApiStatus(screenName, 'error', error.message));
      dataLoads.set(screenName, requestPromise);
      return requestPromise;
    }

    document.addEventListener('click', event => {
      const retry = event.target.closest('[data-retry-screen]');
      if (retry) loadScreenData(retry.dataset.retryScreen, true);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flushGameState();
    });
    window.addEventListener('beforeunload', () => flushGameState(true));

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

      taskList.innerHTML = state.tasks.map(task => `
        <button data-task="${escapeHTML(task.label).toLowerCase()}" data-reward="${Number(task.reward) || 0}" data-label="${escapeHTML(task.title)}" class="task-action w-full text-left panel px-3 py-3 rounded-xl flex items-center justify-between gap-3">
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

      rewardLog.innerHTML = items.map(item => `
        <div class="flex items-center justify-between text-xs rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2">
          <span class="text-slate-300">${escapeHTML(item.label)}</span>
          <span class="font-bold text-emerald-400">+${Number(item.value) || 0} ★</span>
        </div>
      `).join('');
    }

    function addStars(amount, label) {
      state.stars += amount;
      state.taskHistory.unshift({ label, value: amount, time: 'teraz' });
      updateStarsDisplay();
      renderRewardLog();
      scheduleGameSync();
      showToast(`Dodano ${amount} ★ do profilu (${label})`);
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add('show');
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
      postsFeed.replaceChildren();
      const roles = {
        user: 'Użytkownik',
        moderator: 'Moderator',
        admin: 'Administrator',
        system: 'System'
      };
      state.posts.slice().reverse().forEach(post => {
        const author = String(post.author || 'Użytkownik');
        const mediaURL = safeMediaURL(post.media);
        const requestedRole = post.role;
        const role = Object.prototype.hasOwnProperty.call(roles, requestedRole) ? requestedRole
          : author === 'System' ? 'system'
          : author.toLowerCase().includes('admin') ? 'admin'
          : author.toLowerCase().includes('moderator') ? 'moderator'
          : 'user';
        const article = document.createElement('article');
        article.className = 'panel chat-message space-y-2';
        article.dataset.messageRole = role;
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between';
        const authorGroup = document.createElement('div');
        authorGroup.className = 'flex items-center gap-2';
        const avatar = document.createElement('div');
        avatar.className = 'w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-[10px] font-black text-slate-950';
        avatar.textContent = author.slice(0, 1).toUpperCase();
        const details = document.createElement('div');
        const authorNode = document.createElement('div');
        authorNode.className = 'text-[10px] font-semibold text-white';
        authorNode.textContent = author;
        const time = document.createElement('div');
        time.className = 'text-[9px] muted';
        time.textContent = post.time || '';
        details.append(authorNode, time);
        authorGroup.append(avatar, details);
        const roleNode = document.createElement('span');
        roleNode.className = 'text-[9px] text-cyan-300';
        roleNode.dataset.role = role;
        roleNode.textContent = roles[role];
        header.append(authorGroup, roleNode);
        const content = document.createElement('p');
        content.className = 'text-xs text-slate-200 leading-relaxed';
        content.textContent = post.text || '';
        article.append(header, content);
        if (mediaURL) {
          const image = document.createElement('img');
          image.src = mediaURL;
          image.alt = 'media';
          image.className = 'w-full rounded-xl border border-slate-800 object-cover max-h-48';
          article.append(image);
        }
        const actions = document.createElement('div');
        actions.className = 'flex items-center gap-3 text-[10px] text-slate-400';
        [['fa-heart', '42'], ['fa-comment', '9'], ['fa-share-from-square', '3']].forEach(([iconName, count]) => {
          const item = document.createElement('span');
          const icon = document.createElement('i');
          icon.className = `fa-regular ${iconName}`;
          item.append(icon, document.createTextNode(` ${count}`));
          actions.append(item);
        });
        const moderation = document.createElement('div');
        moderation.className = 'chat-message-actions';
        moderation.dataset.messageActions = '';
        moderation.setAttribute('aria-label', 'Przyszłe akcje moderacyjne');
        article.append(actions, moderation);
        postsFeed.append(article);
      });
      if (!state.posts.length) {
        const empty = document.createElement('p');
        empty.textContent = 'Nie ma jeszcze wiadomości.';
        postsFeed.append(empty);
      }
      postsFeed.scrollTop = postsFeed.scrollHeight;
    }

    function renderChannelFeed() {
      const feed = document.getElementById('channel-feed');
      if (!feed) return;
      feed.replaceChildren();
      state.channelPosts.forEach(post => {
        const article = document.createElement('article');
        article.className = 'panel p-3.5';
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between gap-3 mb-2';
        const identity = document.createElement('div');
        identity.className = 'flex items-center gap-2';
        const avatar = document.createElement('div');
        avatar.className = 'w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-[10px] font-bold text-slate-950';
        avatar.textContent = String(post.author || 'T').slice(0, 1).toUpperCase();
        const details = document.createElement('div');
        const author = document.createElement('div');
        author.className = 'text-[10px] font-semibold text-white';
        author.textContent = post.author || '';
        const time = document.createElement('div');
        time.className = 'text-[9px] muted';
        time.textContent = post.time || '';
        details.append(author, time);
        identity.append(avatar, details);
        const official = document.createElement('span');
        official.className = 'text-[10px] text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5';
        official.textContent = 'Official';
        header.append(identity, official);
        const content = document.createElement('p');
        content.className = 'text-xs text-slate-200 leading-relaxed';
        content.textContent = post.text || '';
        article.append(header, content);
        const mediaURL = safeMediaURL(post.media);
        if (mediaURL) {
          const image = document.createElement('img');
          image.src = mediaURL;
          image.className = 'mt-3 rounded-xl w-full object-cover max-h-44 border border-slate-800';
          image.alt = 'channel';
          article.append(image);
        }
        const linkURL = safeMediaURL(post.link);
        if (linkURL) {
          const link = document.createElement('a');
          link.href = linkURL;
          link.rel = 'noopener noreferrer';
          link.target = '_blank';
          link.className = 'block mt-2 text-xs text-cyan-400 underline';
          link.textContent = post.link;
          article.append(link);
        }
        feed.append(article);
      });
      if (!state.channelPosts.length) feed.textContent = 'Brak postów kanałowych.';
    }

    function createNewPost() {
      const input = document.getElementById('post-input');
      const text = input.value.trim();
      if (!text) { showToast('Napisz treść posta zanim opublikujesz.'); return; }
      state.posts.unshift({
        author: currentUser.username ? `@${currentUser.username}` : currentUser.first_name,
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
      const user = parseTelegramUser();
      const username = document.getElementById('telegram-username');
      const profileName = document.getElementById('profile-name');
      const profileId = document.getElementById('profile-id');
      const avatarFallback = document.getElementById('profile-avatar-fallback');
      const avatarImg = document.getElementById('profile-avatar-img');
      const headerAvatar = document.getElementById('header-avatar');
      const adminPanelContainer = document.getElementById('admin-panel-container');

      const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Guest';
      const usernameText = user.username ? `@${user.username}` : '@guest';

      if (username) username.textContent = usernameText;
      if (profileName) profileName.textContent = name;
      if (profileId) profileId.textContent = user.id ? `TG ID: ${user.id}` : 'TG ID: brak danych';
      const rankUserLabel = document.getElementById('rank-user-label');
      if (rankUserLabel) rankUserLabel.textContent = `Ty (${usernameText})`;
      const refLink = document.getElementById('ref-link-input');
      if (refLink) refLink.value = user.id ? `https://t.me/${window.CONFIG.BOT_USERNAME}?start=ref_${encodeURIComponent(user.id)}` : '';
      if (headerAvatar) headerAvatar.textContent = name.slice(0, 2).toUpperCase();

      // Sprawdzenie uprawnień administratora wg ID (lub jeśli ADMIN_TELEGRAM_ID to 0 dla testów lokalnych możesz dostosować)
      // Jeśli chcesz, aby na testach lokalnych panel był widoczny, zmień warunek lub ustaw ADMIN_TELEGRAM_ID równe Twojemu ID.
      const isOwner = (user.id === ADMIN_TELEGRAM_ID) || (ADMIN_TELEGRAM_ID === 0); 
      if (adminPanelContainer && isOwner) {
        adminPanelContainer.classList.remove('hidden');
      }

      const photoURL = safeMediaURL(user.photo_url);
      if (photoURL && avatarImg && avatarFallback && headerAvatar) {
        avatarImg.src = photoURL;
        avatarImg.classList.remove('hidden');
        avatarFallback.classList.add('hidden');
        headerAvatar.textContent = '';
        headerAvatar.style.backgroundImage = `url("${photoURL}")`;
        headerAvatar.style.backgroundSize = 'cover';
        headerAvatar.style.backgroundPosition = 'center';
      }
    }

    function renderLeaderboard() {
      const container = document.querySelector('#reward-leaderboard .space-y-2');
      if (!container) return;
      container.replaceChildren();
      const rows = state.leaderboard || [];
      if (!rows.length) {
        const empty = document.createElement('p');
        empty.className = 'api-empty-note';
        empty.textContent = 'Ranking pojawi się, gdy będą dostępne wyniki.';
        container.append(empty);
        return;
      }
      rows.forEach((row, index) => {
        const line = document.createElement('div');
        line.className = 'flex items-center justify-between bg-violet-900/30 p-2.5 rounded-xl border border-violet-500/30 text-xs font-semibold';
        const name = document.createElement('span');
        name.textContent = row.username ? `@${row.username}` : row.name || `Gracz ${index + 1}`;
        const score = document.createElement('span');
        score.className = 'font-bold text-violet-300';
        score.textContent = `${formatK(row.stars)} ★`;
        line.append(name, score);
        container.append(line);
      });
    }

    function renderReferrals() {
      const card = document.querySelector('#reward-referrals .panel');
      if (!card) return;
      const labels = card.querySelectorAll('.border-t span.font-bold');
      const referralData = state.referrals || {};
      if (labels[0]) labels[0].textContent = `${formatK(referralData.count)} osób`;
      if (labels[1]) labels[1].textContent = `+${formatK(referralData.rewards)} ★`;
    }

    function renderNotifications(items) {
      const list = document.getElementById('notification-list');
      if (!list) return;
      list.replaceChildren();
      items.forEach(item => {
        const card = document.createElement('article');
        card.className = 'panel p-4 text-xs space-y-2';
        const title = document.createElement('div');
        title.className = 'font-bold text-white';
        title.textContent = item.title || 'Powiadomienie';
        const text = document.createElement('p');
        text.className = 'muted';
        text.textContent = item.text || '';
        card.append(title, text);
        list.append(card);
      });
    }

    function renderWallet(wallet) {
      const balance = document.getElementById('wallet-balance');
      if (balance) balance.textContent = `${formatK(wallet.balance)} ${wallet.currency || 'PLN'}`;
    }

    function buyRigPartWithStars(itemKey, cost) {
      if (state.stars < cost) {
        showToast(`Masz za mało gwiazdek! Potrzebujesz ${cost} ★.`);
        return;
      }
      state.stars -= cost;
      updateStarsDisplay();
      completePurchase(itemKey);
    }

    function completePurchase(key) {
      const item = state.rigCatalog.find(i => i.key === key);
      state.rigParts[key] = true;
      if (window.rigBuilder) window.rigBuilder.renderRig(state.rigParts, { animateNew: true });
      renderRigShop();
      if (item) showToast(`${item.name} została pomyślnie kupiona!`);
      const scene = document.getElementById('rig-scene');
      if (scene && document.getElementById('screen-crypto').classList.contains('hidden')) {
        show('crypto', 'TechnixPro');
      }
      if (scene && (scene.getBoundingClientRect().top < 0 || scene.getBoundingClientRect().bottom > window.innerHeight)) {
        scene.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (scene) scene.focus({ preventScroll: true });
      window.TechnixAPI.saveRig(state.rigParts).catch(() => {});
      scheduleGameSync();
    }

    function renderRigShop() {
      const rigShop = document.getElementById('rig-shop');
      if (!rigShop) return;
      rigShop.innerHTML = state.rigCatalog.map(item => {
        const owned = state.rigParts[item.key];
        return `
          <div class="shop-item ${owned ? 'is-owned' : ''}">
            <div class="shop-item-icon">${window.rigBuilder ? window.rigBuilder.preview(item.key) : `<i class="fa-solid ${item.icon}"></i>`}</div>
            <div>
              <div class="text-[10px] font-semibold text-white">${escapeHTML(item.name)}</div>
              <div class="text-[9px] text-amber-400 font-bold">${item.cost} ★ Telegram Stars</div>
              <div class="shop-owned-label">${owned ? 'Zamontowano' : 'Do zbudowania'}</div>
            </div>
            <button type="button" data-rig="${item.key}" data-cost="${item.cost}" ${owned ? 'disabled' : ''} class="${owned ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20' : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-extrabold'} px-2 py-2 rounded-lg transition active:scale-95">
              ${owned ? 'Zamontowano' : 'Kup (Stars)'}
            </button>
          </div>
        `;
      }).join('');

      document.querySelectorAll('[data-rig]').forEach(button => {
        button.addEventListener('click', () => {
          const key = button.dataset.rig;
          const cost = Number(button.dataset.cost || 0);
          if (state.rigParts[key]) {
            showToast(`${state.rigCatalog.find(item => item.key === key).name} jest już odblokowany.`);
            return;
          }
          buyRigPartWithStars(key, cost);
        });
      });
    }

    function initCryptoGame() {
      const techTokenCount = document.getElementById('tech-token-count');
      const techProgressFill = document.getElementById('tech-progress-fill');
      const techProgressText = document.getElementById('tech-progress-text');
      const techRemaining = document.getElementById('tech-remaining-time');
      const techMinedValue = document.getElementById('tech-mined-value');
      const energyValue = document.getElementById('energyValue');
      const energyMax = document.getElementById('energyMax');
      const energyFill = document.getElementById('energyFill');
      const tpBalance = document.getElementById('tpBalance');
      const techTokenFill = document.getElementById('tech-capsule-fill');
      const coreClicker = document.getElementById('tech-core-clicker');

      let mined = Number(state.mined) || 0;
      let totalSupply = 100000000;
      let currentCycle = 60 * 60 * 24 * 60;

      function syncCryptoUI() {
        const ratio = mined / totalSupply;
        if (techProgressFill) techProgressFill.style.width = `${Math.min(ratio * 100, 100)}%`;
        if (techTokenFill) techTokenFill.style.width = `${Math.min(ratio * 100, 100)}%`;

        const remainingSeconds = Math.max(0, currentCycle);
        const days = Math.floor(remainingSeconds / 86400);
        const hrs = Math.floor((remainingSeconds % 86400) / 3600);
        const mins = Math.floor((remainingSeconds % 3600) / 60);
        const secs = remainingSeconds % 60;

        if (techRemaining) techRemaining.textContent = `${days}d ${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        if (techTokenCount) techTokenCount.textContent = formatK(Math.round(mined));
        if (techMinedValue) techMinedValue.textContent = formatK(Math.round(mined));
        if (techProgressText) techProgressText.textContent = `${formatK(mined)} / ${formatK(totalSupply)}`;
        if (energyValue) energyValue.textContent = state.energy;
        if (energyMax) energyMax.textContent = state.energyMax;
        if (tpBalance) tpBalance.textContent = formatK(state.tp);
        if (energyFill) energyFill.style.width = `${(state.energy / state.energyMax) * 100}%`;
      }

      if (coreClicker) {
        coreClicker.addEventListener('click', () => {
          if (state.energy < 15) {
            showToast('Brakuje energii! Poczekaj na regenerację.');
            return;
          }
          state.energy = Math.max(0, state.energy - 15);
          state.tp += 25;
          mined = Math.min(totalSupply, mined + 25);
          state.mined = mined;
          state.taps += 1;
          syncCryptoUI();
          scheduleGameSync();
        });
      }

      syncCryptoUI();

      setInterval(() => {
        currentCycle = Math.max(0, currentCycle - 1);
        if (state.energy < state.energyMax) {
          state.energy = Math.min(state.energyMax, state.energy + 5);
        }
        syncCryptoUI();
      }, 1000);
      setInterval(flushGameState, 10000);
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
    }

    async function seedInitialState() {
      try {
        applyMeData(await window.TechnixAPI.getMe());
      } catch (error) {
        setApiStatus('profile', 'error', error.message);
      }
      updateStarsDisplay();
      renderTaskList();
      renderRewardLog();
      renderPostsFeed();
      renderChannelFeed();
      if (window.rigBuilder) {
        window.rigBuilder.renderRig(state.rigParts);
      }
      renderRigShop();
      initTelegramProfile();
      renderHomeSubtabs();
      initChatViewport();
      renderRewardTabs();
      bindGlobalActions();
      initCryptoGame();
      show('home', 'Sieć społeczna');
    }

    window.addEventListener('load', seedInitialState);
