// ========== CONFIG ==========
const TELEGRAM_ADMIN_IDS = (window.TECHNIX_CONFIG && window.TECHNIX_CONFIG.ADMIN_IDS) || [];

const RANKS = [
  { name: '🥉 Brązowy Rekrut', min: 0, max: 999, icon: '🥉', color: 'border-amber-700 bg-amber-900/30' },
  { name: '🥈 Srebrny Operat', min: 1000, max: 4999, icon: '🥈', color: 'border-slate-600 bg-slate-800/30' },
  { name: '🥇 Złoty Mistrz', min: 5000, max: 19999, icon: '🥇', color: 'border-yellow-700 bg-yellow-900/30' },
  { name: '💎 Diamentowy Lider', min: 20000, max: Infinity, icon: '💎', color: 'border-cyan-700 bg-cyan-900/30' }
];

const TASKS = [
  { id: 'daily_login', name: 'Logowanie', xp: 25, icon: '📱' },
  { id: 'chat_msg', name: 'Wiadomość w czacie', xp: 10, icon: '💬' },
  { id: 'invite_3', name: 'Zaproś 3 osoby', xp: 50, icon: '🔗' },
  { id: 'unlock_badge', name: 'Odblokuj odznaką', xp: 100, icon: '🏆' }
];

const BADGES = [
  { id: 'pionier', name: 'Pionier', icon: '🚀', xp: 0 },
  { id: 'chat_master', name: 'Master Czatu', icon: '💬', xp: 100 },
  { id: 'referral_king', name: 'Referral King', icon: '👑', xp: 500 },
  { id: 'ton_partner', name: 'TON Partner', icon: '⛓️', xp: 1000 },
  { id: 'legend', name: 'Legenda', icon: '⭐', xp: 50000 }
];

// ========== STATE ==========
const TelegramApp = window.Telegram?.WebApp;
let currentUserId = 'guest';
let userState = {
  xp: 0,
  completedTasks: [],
  unlockedBadges: [],
  posts: [],
  referrals: [],
  avatar: null
};

// ========== LOCAL STORAGE ==========
function getTelegramUserId() {
  if (TelegramApp?.initDataUnsafe?.user?.id) return String(TelegramApp.initDataUnsafe.user.id);
  return localStorage.getItem('tp_last_user_id') || 'guest';
}

function loadUserState() {
  currentUserId = getTelegramUserId();
  const stored = localStorage.getItem(`tp_user_${currentUserId}`);
  if (stored) userState = { ...userState, ...JSON.parse(stored) };
  localStorage.setItem('tp_last_user_id', currentUserId);
  saveUserState();
}

function saveUserState() {
  localStorage.setItem(`tp_user_${currentUserId}`, JSON.stringify(userState));
}

// ========== XP & LEVELS ==========
function addXP(amount, reason) {
  userState.xp += Number(amount || 0);
  saveUserState();
  renderStats();
  showToast(`+${amount} XP: ${reason}`);
}

function getCurrentRank() {
  return RANKS.find(r => userState.xp >= r.min && userState.xp <= r.max) || RANKS[RANKS.length - 1];
}

function getLevelFromXP() {
  return Math.floor(userState.xp / 1000) + 1;
}

function renderStats() {
  const level = getLevelFromXP();
  const rank = getCurrentRank();
  const progress = Math.min((userState.xp / 3000) * 100, 100);

  document.getElementById('xp-display').textContent = Number(userState.xp).toLocaleString('pl-PL');
  document.getElementById('progress-text').textContent = `${Number(userState.xp).toLocaleString('pl-PL')} / 3000 XP`;
  document.getElementById('progress-bar').style.width = `${progress}%`;
  document.getElementById('level-badge').textContent = `LEVEL ${level}`;
  document.getElementById('profile-xp').textContent = Number(userState.xp).toLocaleString('pl-PL');
  document.getElementById('profile-level').textContent = String(level);
}

// ========== RANKS RENDER ==========
function renderRanks() {
  const list = document.getElementById('rank-list');
  if (!list) return;
  const active = getCurrentRank();
  list.innerHTML = RANKS.map(rank => `
    <div class="rounded-xl border ${rank.color} ${active.name === rank.name ? 'ring-2 ring-cyan-400' : ''} p-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-lg">${rank.icon}</span>
          <span class="text-xs font-bold text-white">${rank.name}</span>
        </div>
        <span class="text-[10px] text-slate-400">${rank.min} - ${rank.max === Infinity ? '∞' : rank.max} XP</span>
      </div>
    </div>
  `).join('');
}

// ========== TASKS RENDER ==========
function renderTasks() {
  const list = document.getElementById('task-list');
  if (!list) return;
  list.innerHTML = TASKS.map(task => {
    const done = userState.completedTasks.includes(task.id);
    return `
      <div class="rounded-xl bg-slate-900/70 border border-slate-800 p-2.5 flex justify-between items-center">
        <div class="flex items-center gap-2 text-xs">
          <span>${task.icon}</span>
          <span class="text-slate-200">${task.name}</span>
        </div>
        <button onclick="completeTask('${task.id}', ${task.xp}, '${task.name}')" class="${done ? 'text-slate-500 cursor-default' : 'text-emerald-400 cursor-pointer'} text-[10px] font-bold">
          ${done ? '✓ Wykonane' : `+${task.xp} XP`}
        </button>
      </div>
    `;
  }).join('');
}

function completeTask(taskId, xp, name) {
  if (userState.completedTasks.includes(taskId)) return;
  userState.completedTasks.push(taskId);
  addXP(xp, name);
  renderTasks();
  checkBadges();
}

// ========== BADGES RENDER ==========
function renderBadges() {
  const list = document.getElementById('badge-list');
  if (!list) return;
  list.innerHTML = BADGES.map(badge => {
    const unlocked = userState.xp >= badge.xp || userState.unlockedBadges.includes(badge.id);
    return `
      <div class="rounded-xl border ${unlocked ? 'border-amber-700 bg-amber-900/25' : 'border-slate-700 bg-slate-900/50 opacity-50'} p-2 text-center">
        <div class="text-xl">${badge.icon}</div>
        <div class="text-[9px] font-bold text-slate-200 mt-1">${badge.name}</div>
        <div class="text-[8px] text-slate-400">${badge.xp} XP</div>
      </div>
    `;
  }).join('');
}

function checkBadges() {
  BADGES.forEach(badge => {
    if (userState.xp >= badge.xp && !userState.unlockedBadges.includes(badge.id)) {
      userState.unlockedBadges.push(badge.id);
      showToast(`🏆 Odznaka: ${badge.name}`);
    }
  });
  renderBadges();
  saveUserState();
}

// ========== CHANNEL & ADMIN ==========
function renderChannelFeed() {
  const feed = document.getElementById('channel-feed');
  if (!feed) return;
  feed.innerHTML = userState.posts.length ? userState.posts.map(post => `
    <article class="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs space-y-2">
      <div class="flex justify-between items-center">
        <span class="font-bold text-cyan-400">${post.author}</span>
        <span class="text-[10px] text-slate-400">${post.date}</span>
      </div>
      <p class="text-slate-200 leading-relaxed">${post.text}</p>
      ${post.media ? `<img src="${post.media}" class="w-full max-h-48 rounded-lg object-cover" onerror="this.style.display='none'">` : ''}
      <div class="flex gap-3 text-[10px] text-slate-400">
        <span>❤️ ${post.likes}</span>
        <span>💬 ${post.comments}</span>
      </div>
    </article>
  `).join('') : '<div class="rounded-xl bg-slate-900/60 border border-slate-800 p-3 text-xs text-slate-300">Brak postów. Administrator może dodać nowy wpis.</div>';
}

function publishAdminPost() {
  const isAdmin = TELEGRAM_ADMIN_IDS.some(id => String(id) === String(currentUserId));
  if (!isAdmin) return showToast('❌ Tylko administrator może publikować posty');

  const text = document.getElementById('admin-post-input').value.trim();
  const media = document.getElementById('admin-media-url').value.trim();
  if (!text) return showToast('Wpisz treść posta');

  const post = {
    id: Date.now(),
    author: 'Admin',
    text,
    media,
    date: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
    likes: 0,
    comments: 0
  };

  userState.posts.unshift(post);
  saveUserState();
  renderChannelFeed();
  document.getElementById('admin-post-input').value = '';
  document.getElementById('admin-media-url').value = '';
  showToast('📢 Post opublikowany');
}

// ========== REFERRAL ==========
function copyReferral() {
  const input = document.getElementById('referral-link');
  input.select();
  navigator.clipboard.writeText(input.value).then(() => showToast('✅ Link skopiowany')).catch(() => showToast('❌ Błąd kopiowania'));
}

// ========== TELEGRAM STARS PAYMENTS ==========
function buyWithStars(invoiceLink, itemName) {
  if (TelegramApp) {
    showToast(`Inicjalizacja płatności: ${itemName || 'przedmiot'}`);
    TelegramApp.openInvoice(invoiceLink, function(status) {
      if (status === 'paid') {
        showToast(`✅ Zakupiono: ${itemName || 'Przedmiot'}`);
      } else if (status === 'failed') {
        showToast('❌ Płatność nie powiodła się');
      } else {
        showToast('ℹ️ Płatność anulowana');
      }
    });
  } else {
    showToast('❌ Telegram WebApp niedostępny');
  }
}

// ========== UI & INIT ==========
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.classList.add('hidden'), 2200);
}

function showScreen(screen, title) {
  document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
  document.getElementById(`screen-${screen}`)?.classList.remove('hidden');
  document.getElementById('header-title').textContent = title;
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = [...document.querySelectorAll('.nav-btn')].find(btn => btn.textContent.includes(title.split(' ')[0]));
  if (activeBtn) activeBtn.classList.add('active');
}

function initApp() {
  loadUserState();
  const currentUser = TelegramApp?.initDataUnsafe?.user;
  const userName = currentUser?.username || currentUser?.first_name || 'user';
  const displayName = userName.startsWith('@') ? userName : `@${userName}`;

  document.getElementById('profile-name').textContent = displayName;
  document.getElementById('profile-username').textContent = displayName;
  document.getElementById('profile-username-inline').textContent = displayName;
  document.getElementById('profile-id').textContent = `TG ID: #${currentUser?.id || currentUserId}`;
  document.getElementById('show-id').textContent = currentUser?.id || currentUserId;
  document.getElementById('referral-link').value = `${window.location.origin}${window.location.pathname}?ref=${currentUserId}`;

  if (TELEGRAM_ADMIN_IDS.some(id => String(id) === String(currentUserId))) {
    document.getElementById('admin-panel').classList.remove('hidden');
  }

  renderStats();
  renderRanks();
  renderTasks();
  renderBadges();
  renderChannelFeed();
  checkBadges();
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  showScreen('home', 'Start');
});

if (TelegramApp) {
  TelegramApp.ready();
  TelegramApp.expand();
}

window.showToast = showToast;
window.publishAdminPost = publishAdminPost;
window.showScreen = showScreen;
window.copyReferral = copyReferral;
window.completeTask = completeTask;
window.buyWithStars = buyWithStars;
