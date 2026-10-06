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
8      channelPosts: [
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
      channelPosts: [],
      tasks: [],
      liveEvent: null,
      owned: {},
      purchases: []
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
      const roles = {
        user: 'Użytkownik',
        moderator: 'Moderator',
        admin: 'Administrator',
        system: 'System'
      };
      postsFeed.innerHTML = state.posts.filter(post => post.visible !== false).slice().reverse().map(post => {
        const author = post.author || 'Użytkownik';
        const requestedRole = post.role;
        const role = roles[requestedRole] ? requestedRole
          : author === 'System' ? 'system'
          : author.toLowerCase().includes('admin') ? 'admin'
          : author.toLowerCase().includes('moderator') ? 'moderator'
          : 'user';
        return `
        <article class="panel chat-message space-y-2" data-message-role="${role}">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-[10px] font-black text-slate-950">${author.slice(0, 1).toUpperCase()}</div>
              <div>
                <div class="text-[10px] font-semibold text-white">${author}</div>
                <div class="text-[9px] muted">${post.time}</div>
              </div>
            </div>
            <span class="text-[9px] text-cyan-300" data-role="${role}">${roles[role]}</span>
          </div>
          <p class="text-xs text-slate-200 leading-relaxed">${post.text}</p>
          ${post.media ? `<img src="${post.media}" alt="media" class="w-full rounded-xl border border-slate-800 object-cover max-h-48" />` : ''}
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
      input.style.height = '';
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
          syncCryptoUI();
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
        initShop();
        initTelegramProfile();
        renderHomeSubtabs();
        initChatViewport();
        renderRewardTabs();
        bindGlobalActions();
        initCryptoGame();
        if (window.FX) window.FX.bindRipples();
        show('home', 'Sieć społeczna');
      }).catch(error => showToast(`Nie udało się wczytać konfiguracji: ${error.message}`));
    }

    window.addEventListener('load', seedInitialState);
