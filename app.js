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
      last_name: '',
      username: 'guest',
      id: 0,
      photo_url: ''
    };
    let communityConfig = null;
    let communityPreview = false;

    const state = {
      stars: 1280,
      level: 1,
      energy: 1000,
      energyMax: 1000,
      tp: 240,
      taskHistory: [
        { label: 'Pierwsze logowanie', value: 25, time: 'dziś' }
      ],
      posts: [
        { author: 'System', text: 'TechnixPro Core Engine online. Wersja 2.7 Edge aktywna.', media: '', time: '2 min temu' },
        { author: 'System', text: 'Nowa seria zadań społecznościowych została dodana do sekcji gwiazd.', media: '', time: '12 min temu' }
      ],
      channelPosts: [],
      tasks: [],
      liveEvent: null,
      rigParts: {
        mouse: false,
        keyboard: false,
        monitor: false,
        case: false,
        ram: false,
        gpu: false
      },
      rigCatalog: [
        { key: 'mouse', name: 'Myszka', icon: 'fa-computer-mouse', cost: 40 },
        { key: 'keyboard', name: 'Klawiatura', icon: 'fa-keyboard', cost: 60 },
        { key: 'monitor', name: 'Monitor', icon: 'fa-display', cost: 180 },
        { key: 'case', name: 'Obudowa', icon: 'fa-cube', cost: 100 },
        { key: 'ram', name: 'RAM', icon: 'fa-memory', cost: 80 },
        { key: 'gpu', name: 'GPU', icon: 'fa-microchip', cost: 270 }
      ]
    };

    function formatK(value) {
      return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(value);
    }

    function parseTelegramUser() {
      const raw = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : defaultUser;
      return {
        ...defaultUser,
        ...raw
      };
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
      state.tasks.filter(task => task.active !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0)).forEach(task => {
        const button = document.createElement('button');
        button.className = 'task-action w-full text-left panel px-3 py-3 rounded-xl flex items-center justify-between gap-3';
        button.dataset.task = String(task.label || 'zadanie').toLowerCase();
        button.dataset.reward = String(task.reward);
        button.dataset.label = task.title;
        const details = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'text-xs font-semibold text-white';
        title.textContent = task.title;
        const reward = document.createElement('div');
        reward.className = 'text-[10px] muted';
        reward.textContent = `+${task.reward} ★`;
        details.append(title, reward);
        const action = document.createElement('span');
        action.className = 'text-[10px] text-violet-300 font-bold';
        action.textContent = 'Złap';
        button.append(details, action);
        button.addEventListener('click', () => addStars(Number(task.reward), task.title));
        taskList.append(button);
      });
    }

    function renderRewardLog() {
      const rewardLog = document.getElementById('reward-log');
      if (!rewardLog) return;
      rewardLog.replaceChildren();
      state.taskHistory.slice(0, 5).forEach(item => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between text-xs rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2';
        const label = document.createElement('span');
        label.className = 'text-slate-300';
        label.textContent = item.label;
        const reward = document.createElement('span');
        reward.className = 'font-bold text-emerald-400';
        reward.textContent = `+${item.value} ★`;
        row.append(label, reward);
        rewardLog.append(row);
      });
    }

    function addStars(amount, label) {
      state.stars += amount;
      state.taskHistory.unshift({ label, value: amount, time: 'teraz' });
      updateStarsDisplay();
      renderRewardLog();
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

    function renderRewardTabs() {
      document.querySelectorAll('[data-reward-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.rewardTab;
          if (btn.style.display === 'none') return;
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
      state.posts.forEach(post => postsFeed.append(createPostCard(post, false)));
    }

    function renderChannelFeed() {
      const feed = document.getElementById('channel-feed');
      if (!feed) return;
      feed.replaceChildren();
      state.channelPosts.filter(post => post.visible !== false).forEach(post => feed.append(createPostCard(post, true)));
    }

    function safeWebUrl(value) {
      try {
        const url = new URL(value, window.location.href);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
      } catch (error) {
        return '';
      }
    }

    function createPostCard(post, channel) {
      const article = document.createElement(channel ? 'article' : 'div');
      article.className = `panel ${channel ? 'p-3.5' : 'p-3 space-y-2'}`;
      const heading = document.createElement('div');
      heading.className = 'flex items-center justify-between gap-3 mb-2';
      const identity = document.createElement('div');
      identity.className = 'flex items-center gap-2';
      const avatar = document.createElement('div');
      avatar.className = 'w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-[10px] font-bold text-slate-950';
      avatar.textContent = (post.author || 'T').slice(0, 1).toUpperCase();
      const identityText = document.createElement('div');
      const author = document.createElement('div');
      author.className = 'text-[10px] font-semibold text-white';
      author.textContent = post.author || 'TechnixPro';
      const time = document.createElement('div');
      time.className = 'text-[9px] muted';
      time.textContent = post.time || '';
      identityText.append(author, time);
      identity.append(avatar, identityText);
      heading.append(identity);
      if (channel) {
        const badge = document.createElement('span');
        badge.className = 'text-[10px] text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5';
        badge.textContent = post.pinned ? 'Przypięty' : 'Official';
        heading.append(badge);
      }
      const text = document.createElement('p');
      text.className = 'text-xs text-slate-200 leading-relaxed';
      text.textContent = post.text || '';
      article.append(heading, text);
      const mediaUrl = safeWebUrl(post.media || '');
      if (mediaUrl) {
        const image = document.createElement('img');
        image.src = mediaUrl;
        image.alt = 'Post';
        image.className = 'mt-3 rounded-xl w-full object-cover max-h-44 border border-slate-800';
        article.append(image);
      }
      const linkUrl = safeWebUrl(post.link || '');
      if (channel && linkUrl) {
        const link = document.createElement('a');
        link.href = linkUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'block mt-2 text-xs text-cyan-400 underline';
        link.textContent = post.link;
        article.append(link);
      }
      return article;
    }

    function renderNotifications() {
      const list = document.getElementById('notification-list');
      if (!list) return;
      list.replaceChildren();
      const config = window.TechnixStore.getVisible(communityPreview);
      const notifications = config.notifications.filter(item => item.sent
        && (!item.scheduledAt || new Date(item.scheduledAt).getTime() <= Date.now())
        && (item.audience === 'all' || item.audience === `phase-${config.activePhase}`));
      if (!notifications.length) {
        const empty = document.createElement('div');
        empty.className = 'panel p-4 text-xs muted';
        empty.textContent = 'Brak nowych powiadomień.';
        list.append(empty);
      }
      notifications.forEach(item => {
        const card = document.createElement('article');
        card.className = 'panel p-4 text-xs space-y-2';
        const title = document.createElement('div');
        title.className = 'font-bold text-white';
        title.textContent = item.title;
        const text = document.createElement('p');
        text.className = 'muted';
        text.textContent = item.text;
        card.append(title, text);
        list.append(card);
      });
    }

    function createNewPost() {
      const input = document.getElementById('post-input');
      const text = input.value.trim();
      if (!text) { showToast('Napisz treść posta zanim opublikujesz.'); return; }
      state.posts.unshift({
        author: 'Ty',
        text,
        media: '',
        time: 'teraz'
      });
      renderPostsFeed();
      input.value = '';
      showToast('Post został dodany do grupy.');
      addStars(12, 'Nowy post');
    }

    function initTelegramProfile() {
      const user = parseTelegramUser();
      const username = document.getElementById('telegram-username');
      const profileName = document.getElementById('profile-name');
      const profileId = document.getElementById('profile-id');
      const avatarFallback = document.getElementById('profile-avatar-fallback');
      const avatarImg = document.getElementById('profile-avatar-img');
      const headerAvatar = document.getElementById('header-avatar');

      const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Guest';
      const usernameText = user.username ? `@${user.username}` : '@guest';

      if (username) username.textContent = usernameText;
      if (profileName) profileName.textContent = name;
      if (profileId) profileId.textContent = user.id ? `TG ID: ${user.id}` : 'TG ID: brak danych';
      if (headerAvatar) headerAvatar.textContent = name.slice(0, 2).toUpperCase();

      window.AdminControlCenter.initialize(window.applyCommunityConfig, user.id);

      if (user.photo_url && avatarImg && avatarFallback && headerAvatar) {
        avatarImg.src = user.photo_url;
        avatarImg.classList.remove('hidden');
        avatarFallback.classList.add('hidden');
        headerAvatar.textContent = '';
        headerAvatar.style.backgroundImage = `url(${user.photo_url})`;
        headerAvatar.style.backgroundSize = 'cover';
        headerAvatar.style.backgroundPosition = 'center';
      }
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
      const partElement = document.querySelector(`.station-part[data-part="${key}"]`);
      if (partElement) {
        partElement.classList.add('active');
      }
      renderRigShop();
      showToast(`${item ? item.name : 'Część'} została pomyślnie kupiona!`);
    }

    function renderRigShop() {
      const rigShop = document.getElementById('rig-shop');
      if (!rigShop) return;
      rigShop.innerHTML = state.rigCatalog.map(item => {
        const owned = state.rigParts[item.key];
        return `
          <div class="shop-item">
            <div class="shop-item-icon"><i class="fa-solid ${item.icon}"></i></div>
            <div>
              <div class="text-[10px] font-semibold text-white">${item.name}</div>
              <div class="text-[9px] text-amber-400 font-bold">${item.cost} ★ Telegram Stars</div>
            </div>
            <button data-rig="${item.key}" data-cost="${item.cost}" class="${owned ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20' : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-extrabold'} px-2 py-2 rounded-lg transition active:scale-95">
              ${owned ? 'Kupione' : 'Kup (Stars)'}
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

      let mined = 0;
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
          syncCryptoUI();
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
    }

    function bindGlobalActions() {
      document.querySelectorAll('[data-screen]').forEach(button => {
        button.addEventListener('click', () => {
          const key = button.dataset.screen;
          if (key === 'home') show('home', 'Sieć społeczna');
          if (key === 'crypto' && (communityConfig.features.clicker || communityConfig.features.rigBuilder)) show('crypto', 'TechnixPro');
          if (key === 'gift') show('gift', 'Bonusy');
          if (key === 'wallet' && communityConfig.features.wallet) show('wallet', 'Portfel');
          if (key === 'profile') show('profile', 'Profil');
          if (key === 'menu') show('menu', 'Menu Główne');
          if (key === 'search') show('search', 'Wyszukiwarka');
          if (key === 'notifications' && communityConfig.features.notifications) show('notifications', 'Powiadomienia');
        });
      });
      const eventButton = document.getElementById('live-event-action-btn');
      if (eventButton) eventButton.addEventListener('click', () => {
        if (state.liveEvent) addStars(Number(state.liveEvent.reward), state.liveEvent.title);
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

      const createPostBtn = document.getElementById('create-post-btn');
      if (createPostBtn) createPostBtn.addEventListener('click', createNewPost);

      document.querySelectorAll('.wallet-toast-btn, .profile-toast-btn').forEach(button => {
        button.addEventListener('click', () => {
          const msg = button.textContent.trim() || 'Akcja aktywowana';
          showToast(`${msg}: moduł w fazie 3.`);
        });
      });
    }

    window.applyCommunityConfig = function (config, preview) {
      communityConfig = config;
      communityPreview = Boolean(preview);
      state.tasks = config.tasks;
      state.channelPosts = config.posts;
      const now = Date.now();
      state.liveEvent = config.events.find(event => event.active !== false
        && (!event.startAt || new Date(event.startAt).getTime() <= now)
        && (!event.endAt || new Date(event.endAt).getTime() >= now)) || null;
      document.querySelectorAll('[data-feature]').forEach(element => {
        element.style.display = config.features[element.dataset.feature] === false ? 'none' : '';
      });
      const cryptoEnabled = config.features.clicker || config.features.rigBuilder;
      document.querySelector('[data-screen="crypto"]').style.display = cryptoEnabled ? '' : 'none';
      document.getElementById('screen-crypto').style.display = cryptoEnabled ? '' : 'none';
      document.querySelectorAll('[data-reward-tab="events"]').forEach(element => {
        element.style.display = config.features.events && Boolean(state.liveEvent) ? '' : 'none';
      });
      document.getElementById('reward-events').style.display = config.features.events && Boolean(state.liveEvent) ? '' : 'none';
      const title = document.getElementById('live-event-title');
      const description = document.getElementById('live-event-desc');
      const eventButton = document.getElementById('live-event-action-btn');
      if (state.liveEvent) {
        title.textContent = state.liveEvent.title;
        description.textContent = state.liveEvent.desc;
        eventButton.textContent = `Dodaj +${state.liveEvent.reward} ★`;
      }
      const statusBanner = document.getElementById('system-status-banner');
      const statusText = document.getElementById('system-status-text');
      statusBanner.style.display = config.statusBanner.visible ? '' : 'none';
      statusBanner.dataset.statusLevel = config.statusBanner.level;
      statusText.textContent = config.statusBanner.text;
      document.querySelectorAll('.phase-label').forEach(label => { label.textContent = `Faza ${config.activePhase}`; });
      Object.entries(config.animations).forEach(([key, enabled]) => {
        if (key === 'reduceMotion') return;
        const cssKey = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
        document.body.classList.toggle(`no-${cssKey}`, !enabled);
      });
      document.body.classList.toggle('reduce-motion', Boolean(config.animations.reduceMotion));
      renderTaskList();
      renderChannelFeed();
      renderNotifications();
      const selectedView = document.querySelector('.reward-view:not(.hidden)');
      if (selectedView && selectedView.style.display === 'none') {
        document.querySelector('[data-reward-tab="overview"]').click();
      }
    };

    function seedInitialState() {
      window.TechnixStore.init().then(initial => {
        window.applyCommunityConfig(initial.published, false);
        updateStarsDisplay();
        renderRewardLog();
        renderPostsFeed();
        renderRigShop();
        initTelegramProfile();
        renderHomeSubtabs();
        renderRewardTabs();
        bindGlobalActions();
        initCryptoGame();
        show('home', 'Sieć społeczna');
      }).catch(error => showToast(`Nie udało się wczytać konfiguracji: ${error.message}`));
    }

    window.addEventListener('load', seedInitialState);
