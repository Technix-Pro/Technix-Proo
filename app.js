    tailwind.config = {
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

    const defaultUser = {
      first_name: 'Guest',
      last_name: '',
      username: 'guest',
      id: 0,
      photo_url: ''
    };

    // WPISZ TUTAJ SWOJE TELEGRAM ID, ABY WIDZIEĆ PANEL ADMINA
    const ADMIN_TELEGRAM_ID = 0; // np. 123456789

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

      taskList.innerHTML = state.tasks.map(task => `
        <button data-task="${task.label.toLowerCase()}" data-reward="${task.reward}" data-label="${task.title}" class="task-action w-full text-left panel px-3 py-3 rounded-xl flex items-center justify-between gap-3">
          <div>
            <div class="text-xs font-semibold text-white">${task.title}</div>
            <div class="text-[10px] muted">+${task.reward} ★</div>
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
          <span class="text-slate-300">${item.label}</span>
          <span class="font-bold text-emerald-400">+${item.value} ★</span>
        </div>
      `).join('');
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
      postsFeed.innerHTML = state.posts.slice().reverse().map(post => {
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
      feed.innerHTML = state.channelPosts.map(post => `
        <article class="panel p-3.5">
          <div class="flex items-center justify-between gap-3 mb-2">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-[10px] font-bold text-slate-950">${(post.author || 'T').slice(0, 1).toUpperCase()}</div>
              <div>
                <div class="text-[10px] font-semibold text-white">${post.author}</div>
                <div class="text-[9px] muted">${post.time}</div>
              </div>
            </div>
            <span class="text-[10px] text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5">Official</span>
          </div>
          <p class="text-xs text-slate-200 leading-relaxed">${post.text}</p>
          ${post.media ? `<img src="${post.media}" class="mt-3 rounded-xl w-full object-cover max-h-44 border border-slate-800" alt="channel" />` : ''}
          ${post.link ? `<a href="${post.link}" target="_blank" class="block mt-2 text-xs text-cyan-400 underline">${post.link}</a>` : ''}
        </article>
      `).join('');
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
      if (headerAvatar) headerAvatar.textContent = name.slice(0, 2).toUpperCase();

      // Sprawdzenie uprawnień administratora wg ID (lub jeśli ADMIN_TELEGRAM_ID to 0 dla testów lokalnych możesz dostosować)
      // Jeśli chcesz, aby na testach lokalnych panel był widoczny, zmień warunek lub ustaw ADMIN_TELEGRAM_ID równe Twojemu ID.
      const isOwner = (user.id === ADMIN_TELEGRAM_ID) || (ADMIN_TELEGRAM_ID === 0); 
      if (adminPanelContainer && isOwner) {
        adminPanelContainer.classList.remove('hidden');
      }

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
          syncCryptoUI();
        });
      }

      function tap() {
        if (energyExact < 15) {
          showToast('Brakuje energii! Poczekaj na regenerację.');
          if (energyBar && fx) fx.pop(energyBar);
          return { ok: false };
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

    function seedInitialState() {
      updateStarsDisplay();
      renderTaskList();
      renderRewardLog();
      renderPostsFeed();
      renderChannelFeed();
      initShop();
      initTelegramProfile();
      renderHomeSubtabs();
      initChatViewport();
      renderRewardTabs();
      bindGlobalActions();
      initCryptoGame();
      if (window.FX) window.FX.bindRipples();
      show('home', 'Sieć społeczna');
    }

    window.addEventListener('load', seedInitialState);
