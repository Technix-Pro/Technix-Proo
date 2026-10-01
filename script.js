function getTelegramUserId() {
  const tg = window.Telegram?.WebApp;
  if (tg?.initDataUnsafe?.user?.id) {
    return String(tg.initDataUnsafe.user.id);
  }

  const saved = localStorage.getItem('tp_last_tg_user_id');
  if (saved) {
    return String(saved);
  }

  return 'guest';
}

function getUserStorageKey(key) {
  const userId = getTelegramUserId();
  return `tp_user_${userId}_${key}`;
}

function initializeUserState(userId = getTelegramUserId()) {
  const initializedKey = `tp_user_${userId}_initialized`;
  if (localStorage.getItem(initializedKey) === 'true') {
    return;
  }

  localStorage.setItem(`tp_user_${userId}_xp`, '0');
  localStorage.setItem(`tp_user_${userId}_posts`, JSON.stringify([]));
  localStorage.setItem(`tp_user_${userId}_tasks`, JSON.stringify([]));
  localStorage.setItem(`tp_user_${userId}_reward_logs`, JSON.stringify([]));
  localStorage.setItem(`tp_user_${userId}_lastClaimTime`, '0');
  localStorage.setItem(`tp_user_${userId}_initialized`, 'true');
  localStorage.setItem('tp_last_tg_user_id', String(userId));
}

function getXP() {
  const userId = getTelegramUserId();
  initializeUserState(userId);
  return Number(localStorage.getItem(`tp_user_${userId}_xp`) || 0);
}

function updateXPDisplay() {
  const xp = getXP();
  const xpTotal = document.getElementById('xp-total');
  const xpProgressText = document.getElementById('xp-progress-text');
  const rankDisplay = document.getElementById('rank-xp-display');
  const progressBar = document.getElementById('xp-progress-bar');
  const pointsEl = document.getElementById('user-points');

  if (xpTotal) xpTotal.textContent = xp.toLocaleString('pl-PL');
  if (xpProgressText) xpProgressText.textContent = `${xp.toLocaleString('pl-PL')} / 3 000 XP`;
  if (rankDisplay) rankDisplay.textContent = `${xp.toLocaleString('pl-PL')} XP`;
  if (pointsEl) pointsEl.textContent = xp.toLocaleString('pl-PL');

  if (progressBar) {
    const percentage = Math.min((xp / 3000) * 100, 100);
    progressBar.style.width = `${percentage}%`;
  }
}

function addXP(amount, reason) {
  const userId = getTelegramUserId();
  const current = getXP();
  const updated = current + amount;

  localStorage.setItem(`tp_user_${userId}_xp`, String(updated));

  const logs = JSON.parse(localStorage.getItem(`tp_user_${userId}_reward_logs`) || '[]');
  logs.unshift({ reason, amount, date: new Date().toLocaleString('pl-PL') });
  localStorage.setItem(`tp_user_${userId}_reward_logs`, JSON.stringify(logs.slice(0, 100)));

  updateXPDisplay();

  if (typeof window.showToast === 'function') {
    window.showToast(`+${amount} XP: ${reason}`);
  }

  return updated;
}

function createNewPost() {
  const input = document.getElementById('post-input');
  const content = input?.value.trim();
  if (!content) return window.showToast?.('Wpisz treść posta przed publikacją.');

  const userId = getTelegramUserId();
  const posts = JSON.parse(localStorage.getItem(`tp_user_${userId}_posts`) || '[]');
  posts.unshift({ content, date: new Date().toLocaleString('pl-PL') });
  localStorage.setItem(`tp_user_${userId}_posts`, JSON.stringify(posts));
  input.value = '';
  renderPosts();
  window.showToast?.('Post został pomyślnie opublikowany.');
}

function renderPosts() {
  const feed = document.getElementById('posts-feed');
  if (!feed) return;

  const userId = getTelegramUserId();
  const posts = JSON.parse(localStorage.getItem(`tp_user_${userId}_posts`) || '[]');

  if (!posts.length) {
    feed.innerHTML = '<div class="panel p-4 text-center text-xs muted">Brak postów. Bądź pierwszy!</div>';
    return;
  }

  feed.innerHTML = posts.map((p, idx) => `
    <article class="panel p-4 space-y-2">
      <div class="flex justify-between items-center text-xs">
        <span class="font-bold text-violet-300">TechnixUser</span>
        <span class="text-[10px] muted">${p.date}</span>
      </div>
      <p class="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">${String(p.content).replace(/[&<>"']/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match]))}</p>
      <div class="flex justify-end pt-1">
        <button onclick="removePost(${idx})" class="text-[10px] text-slate-500 hover:text-red-400 transition">
          <i class="fa-regular fa-trash-can"></i> Usuń
        </button>
      </div>
    </article>
  `).join('');
}

function removePost(index) {
  const userId = getTelegramUserId();
  const posts = JSON.parse(localStorage.getItem(`tp_user_${userId}_posts`) || '[]');
  posts.splice(index, 1);
  localStorage.setItem(`tp_user_${userId}_posts`, JSON.stringify(posts));
  renderPosts();
  window.showToast?.('Post usunięty.');
}

function claimReward(name, amount) {
  const userId = getTelegramUserId();
  const claimedKey = `tp_user_${userId}_claimed_${name.replace(/\s+/g, '_')}`;

  if (localStorage.getItem(claimedKey)) {
    return window.showToast?.('Ta nagroda została już odebrana.');
  }

  localStorage.setItem(claimedKey, 'true');
  addXP(amount, name);
}

function renderTaskList() {
  const userId = getTelegramUserId();
  const completed = JSON.parse(localStorage.getItem(`tp_user_${userId}_tasks`) || '[]');
  const tasks = [
    ['login', 'Zaloguj się codziennie', 25],
    ['post', 'Opublikuj post w Grupie', 50],
    ['visit_info', 'Odwiedź zakładkę Info', 25]
  ];

  const taskList = document.getElementById('task-list');
  if (!taskList) return;

  taskList.innerHTML = tasks.map(t => {
    const isDone = completed.includes(t[0]);
    return `
      <div class="flex items-center justify-between bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs">
        <div class="flex items-center gap-2.5">
          <i class="fa-solid ${isDone ? 'fa-circle-check text-emerald-400' : 'fa-circle text-slate-700'} text-sm"></i>
          <div>
            <span class="block font-bold text-slate-200">${t[1]}</span>
            <span class="text-[10px] muted">+${t[2]} XP</span>
          </div>
        </div>
        <button onclick="triggerTaskAction('${t[0]}', ${t[2]}, '${t[1]}')" class="text-[11px] font-semibold ${isDone ? 'muted cursor-default' : 'text-violet-400 hover:text-violet-300'}">
          ${isDone ? 'Wykonane' : 'Wykonaj'}
        </button>
      </div>
    `;
  }).join('');
}

function triggerTaskAction(id, xpVal = 50, title = 'Zadanie') {
  const userId = getTelegramUserId();
  const completed = JSON.parse(localStorage.getItem(`tp_user_${userId}_tasks`) || '[]');
  if (completed.includes(id)) return window.showToast?.('Zadanie zostało już zaliczone.');

  completed.push(id);
  localStorage.setItem(`tp_user_${userId}_tasks`, JSON.stringify(completed));
  addXP(xpVal, title);
  renderTaskList();
}

function renderRewardHistory() {
  const userId = getTelegramUserId();
  const logs = JSON.parse(localStorage.getItem(`tp_user_${userId}_reward_logs`) || '[]');
  const container = document.getElementById('reward-log');
  if (!container) return;

  if (!logs.length) {
    container.innerHTML = '<p class="text-xs muted">Brak odnotowanej aktywności XP.</p>';
    return;
  }

  container.innerHTML = logs.slice(0, 10).map(l => `
    <div class="flex justify-between items-center bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-xs">
      <div>
        <span class="block font-semibold text-slate-200">${String(l.reason).replace(/[&<>"']/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match]))}</span>
        <span class="text-[9px] muted">${l.date}</span>
      </div>
      <span class="font-bold text-emerald-400">+${l.amount} XP</span>
    </div>
  `).join('');
}

function initBonusTimer() {
  const userId = getTelegramUserId();
  const button = document.getElementById('claim-bonus-btn');
  const timer = document.getElementById('bonus-timer');
  if (!button || !timer) return;

  const key = `tp_user_${userId}_lastClaimTime`;
  const CLAIM_INTERVAL = 4 * 60 * 60 * 1000;

  function updateBonusTimer() {
    const lastClaim = Number(localStorage.getItem(key) || 0);
    const now = Date.now();
    const remaining = CLAIM_INTERVAL - (now - lastClaim);

    if (remaining <= 0) {
      timer.textContent = '00:00:00';
      button.disabled = false;
      button.classList.remove('bg-slate-700', 'text-slate-400', 'cursor-not-allowed');
      button.classList.add('bg-cyan-500', 'hover:bg-cyan-400', 'text-slate-950', 'shadow-lg', 'shadow-cyan-500/20');
      button.textContent = 'Odbierz +50 TechnixCoins';
      return;
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    const pad = (value) => String(value).padStart(2, '0');
    timer.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    button.disabled = true;
    button.classList.add('bg-slate-700', 'text-slate-400', 'cursor-not-allowed');
    button.classList.remove('bg-cyan-500', 'hover:bg-cyan-400', 'text-slate-950', 'shadow-lg', 'shadow-cyan-500/20');
    button.textContent = `Dostępne za ${pad(hours)}h ${pad(minutes)}m`;
  }

  button.addEventListener('click', () => {
    if (button.disabled) return;
    localStorage.setItem(key, String(Date.now()));
    addXP(50, 'Bonus Czasowy');
    updateBonusTimer();
  });

  updateBonusTimer();
  setInterval(updateBonusTimer, 1000);
}

function displayPoints(userId = getTelegramUserId()) {
  if (!userId || userId === 'guest') {
    updateXPDisplay();
    return 0;
  }

  initializeUserState(userId);
  localStorage.setItem('tp_last_tg_user_id', String(userId));

  const xp = getXP();
  const pointsEl = document.getElementById('user-points');
  if (pointsEl) {
    pointsEl.textContent = xp.toLocaleString('pl-PL');
  }

  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const userName = tgUser?.username
    ? `@${tgUser.username}`
    : `${tgUser?.first_name || 'User'} ${tgUser?.last_name || ''}`.trim();

  const telegramUsername = document.getElementById('telegram-username');
  const profileName = document.getElementById('profile-name');
  const profileId = document.getElementById('profile-id');
  const rankUserLabel = document.getElementById('rank-user-label');

  if (telegramUsername) telegramUsername.textContent = userName || '@User';
  if (profileName) profileName.textContent = userName || 'TechnixUser';
  if (profileId) profileId.textContent = `TG ID: #${userId}`;
  if (rankUserLabel) rankUserLabel.textContent = `12. ${userName || 'User'}`;

  updateXPDisplay();
  return xp;
}

window.getTelegramUserId = getTelegramUserId;
window.getUserStorageKey = getUserStorageKey;
window.initializeUserState = initializeUserState;
window.getXP = getXP;
window.updateXPDisplay = updateXPDisplay;
window.addXP = addXP;
window.createNewPost = createNewPost;
window.renderPosts = renderPosts;
window.removePost = removePost;
window.claimReward = claimReward;
window.renderTaskList = renderTaskList;
window.triggerTaskAction = triggerTaskAction;
window.renderRewardHistory = renderRewardHistory;
window.initBonusTimer = initBonusTimer;
window.displayPoints = displayPoints;

window.TechnixDebug = {
  getTelegramUserId,
  getUserStorageKey,
  initializeUserState,
  getXP,
  updateXPDisplay,
  addXP,
  resetUserPoints: () => {
    const userId = getTelegramUserId();
    localStorage.setItem(`tp_user_${userId}_xp`, '0');
    localStorage.setItem(`tp_user_${userId}_posts`, JSON.stringify([]));
    localStorage.setItem(`tp_user_${userId}_tasks`, JSON.stringify([]));
    localStorage.setItem(`tp_user_${userId}_reward_logs`, JSON.stringify([]));
    localStorage.setItem(`tp_user_${userId}_lastClaimTime`, '0');
    localStorage.setItem(`tp_user_${userId}_initialized`, 'true');
    updateXPDisplay();
    return true;
  },
  displayPoints
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const userId = getTelegramUserId();
    initializeUserState(userId);
    updateXPDisplay();
    renderPosts();
    renderTaskList();
    renderRewardHistory();
    initBonusTimer();
    displayPoints(userId);
  });
} else {
  const userId = getTelegramUserId();
  initializeUserState(userId);
  updateXPDisplay();
  renderPosts();
  renderTaskList();
  renderRewardHistory();
  initBonusTimer();
  displayPoints(userId);
}

console.log('[TechnixPro] Per-user points system loaded.');
