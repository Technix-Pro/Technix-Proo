function getTelegramUserId() {
  const tg = window.Telegram?.WebApp;
  if (tg?.initDataUnsafe?.user?.id) {
    return String(tg.initDataUnsafe.user.id);
  }

  const saved = localStorage.getItem('tp_last_tg_user_id');
  if (saved) return String(saved);

  return 'guest';
}

function getUserStorageKey(name) {
  const userId = getTelegramUserId();
  return `tp_user_${userId}_${name}`;
}

function initializeUserState(userId = getTelegramUserId()) {
  const initializedKey = `tp_user_${userId}_initialized`;

  if (localStorage.getItem(initializedKey) === 'true') {
    return;
  }

  localStorage.setItem(`tp_user_${userId}_xp`, '0');
  localStorage.setItem(`tp_user_${userId}_tasks`, JSON.stringify([]));
  localStorage.setItem(`tp_user_${userId}_reward_logs`, JSON.stringify([]));
  localStorage.setItem(`tp_user_${userId}_lastClaimTime`, '0');
  localStorage.setItem(initializedKey, 'true');
  localStorage.setItem('tp_last_tg_user_id', String(userId));
}

function getUserXP() {
  const userId = getTelegramUserId();
  initializeUserState(userId);
  return Number(localStorage.getItem(`tp_user_${userId}_xp`) || 0);
}

function setUserXP(value) {
  const userId = getTelegramUserId();
  localStorage.setItem(`tp_user_${userId}_xp`, String(value));
  updateUserXPDisplay();
}

function resetUserPoints() {
  const userId = getTelegramUserId();
  localStorage.setItem(`tp_user_${userId}_xp`, '0');
  localStorage.setItem(`tp_user_${userId}_tasks`, JSON.stringify([]));
  localStorage.setItem(`tp_user_${userId}_reward_logs`, JSON.stringify([]));
  localStorage.setItem(`tp_user_${userId}_lastClaimTime`, '0');
  localStorage.setItem(`tp_user_${userId}_initialized`, 'true');
  updateUserXPDisplay();
  if (typeof window.showToast === 'function') {
    window.showToast('Punkty użytkownika zostały zresetowane do zera.');
  }
  return true;
}

function updateUserXPDisplay() {
  const xp = getUserXP();

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
  const current = getUserXP();
  const updated = current + amount;
  localStorage.setItem(`tp_user_${userId}_xp`, String(updated));

  const logs = JSON.parse(localStorage.getItem(`tp_user_${userId}_reward_logs`) || '[]');
  logs.unshift({ reason, amount, date: new Date().toLocaleString('pl-PL') });
  localStorage.setItem(`tp_user_${userId}_reward_logs`, JSON.stringify(logs.slice(0, 100)));

  updateUserXPDisplay();

  if (typeof window.showToast === 'function') {
    window.showToast(`+${amount} XP: ${reason}`);
  }
}

function displayPoints(userId = getTelegramUserId()) {
  if (!userId || userId === 'guest') {
    console.warn('[TechnixPro] Brak ID Telegram użytkownika, używam danych lokalnych.');
    updateUserXPDisplay();
    return 0;
  }

  initializeUserState(userId);
  localStorage.setItem('tp_last_tg_user_id', String(userId));

  const xp = Number(localStorage.getItem(`tp_user_${userId}_xp`) || 0);

  const pointsEl = document.getElementById('user-points');
  if (pointsEl) {
    pointsEl.textContent = xp.toLocaleString('pl-PL');
  }

  const telegramUsername = document.getElementById('telegram-username');
  const profileName = document.getElementById('profile-name');
  const profileId = document.getElementById('profile-id');
  const rankUserLabel = document.getElementById('rank-user-label');

  if (telegramUsername || profileName || profileId || rankUserLabel) {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const name = tgUser?.username
      ? `@${tgUser.username}`
      : `${tgUser?.first_name || 'User'} ${tgUser?.last_name || ''}`.trim();

    if (telegramUsername) telegramUsername.textContent = name || '@User';
    if (profileName) profileName.textContent = name || 'TechnixUser';
    if (profileId) profileId.textContent = `TG ID: #${userId}`;
    if (rankUserLabel) rankUserLabel.textContent = `12. ${name || 'User'}`;
  }

  updateUserXPDisplay();
  return xp;
}

window.getTelegramUserId = getTelegramUserId;
window.getUserStorageKey = getUserStorageKey;
window.initializeUserState = initializeUserState;
window.getUserXP = getUserXP;
window.setUserXP = setUserXP;
window.resetUserPoints = resetUserPoints;
window.addXP = addXP;
window.displayPoints = displayPoints;
window.updateUserXPDisplay = updateUserXPDisplay;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const userId = getTelegramUserId();
    initializeUserState(userId);
    updateUserXPDisplay();
    displayPoints(userId);
  });
} else {
  const userId = getTelegramUserId();
  initializeUserState(userId);
  updateUserXPDisplay();
  displayPoints(userId);
}

console.log('[TechnixPro] points system loaded');
