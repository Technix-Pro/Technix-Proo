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
      postsFeed.innerHTML = state.posts.map(post => `
        <div class="panel p-3 space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-[10px] font-black text-slate-950">${(post.author || 'T').slice(0, 1).toUpperCase()}</div>
              <div>
                <div class="text-[10px] font-semibold text-white">${post.author}</div>
                <div class="text-[9px] muted">${post.time}</div>
              </div>
            </div>
            <span class="text-[9px] text-cyan-300">#${post.author === 'System' ? 'tech' : 'crew'}</span>
          </div>
          <p class="text-xs text-slate-200 leading-relaxed">${post.text}</p>
          ${post.media ? `<img src="${post.media}" alt="media" class="w-full rounded-xl border border-slate-800 object-cover max-h-48" />` : ''}
          <div class="flex items-center gap-3 text-[10px] text-slate-400">
            <span><i class="fa-regular fa-heart"></i> 42</span>
            <span><i class="fa-regular fa-comment"></i> 9</span>
            <span><i class="fa-regular fa-share-from-square"></i> 3</span>
          </div>
        </div>
      `).join('');
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
      showToast('Post został dodany do grupy.');
      addStars(12, 'Nowy post');
    }

    // Panel Admina - Przełączanie podzakładek
    window.switchAdminTab = function(tabKey) {
      document.querySelectorAll('.admin-sub-view').forEach(v => v.classList.add('hidden'));
      document.getElementById(`admin-sub-${tabKey}`).classList.remove('hidden');

      document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('text-violet-400', 'border-violet-500', 'border-b-2');
        btn.classList.add('text-slate-400', 'border-transparent');
      });
      event.target.classList.remove('text-slate-400', 'border-transparent');
      event.target.classList.add('text-violet-400', 'border-violet-500', 'border-b-2');
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
      renderRigShop();
      initTelegramProfile();
      renderHomeSubtabs();
      renderRewardTabs();
      bindGlobalActions();
      initCryptoGame();
      show('home', 'Sieć społeczna');
    }

    window.addEventListener('load', seedInitialState);
