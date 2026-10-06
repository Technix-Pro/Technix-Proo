// Pure game logic (levels, referrals, tasks, achievements, validation). No DOM access, unit-tested in test/core.test.js.
(function (root) {
  var CFG = root.TP_CONFIG || (typeof require === 'function' ? require('./app-config.js') : null);

  function levelFor(xp) {
    var levels = CFG.LEVELS, cur = levels[0];
    xp = Math.max(0, Number(xp) || 0);
    for (var i = 0; i < levels.length; i++) if (xp >= levels[i].xp) cur = levels[i];
    return cur;
  }

  function progress(xp) {
    xp = Math.max(0, Number(xp) || 0);
    var cur = levelFor(xp), next = CFG.LEVELS[cur.level] || null;
    if (!next) return { level: cur, next: null, xpToNext: 0, percent: 100 };
    var span = next.xp - cur.xp;
    return { level: cur, next: next, xpToNext: next.xp - xp, percent: Math.min(100, Math.round(((xp - cur.xp) / span) * 100)) };
  }

  function referralCode(id) {
    var n = Math.abs(parseInt(id, 10)) || 0;
    return 'TP' + n.toString(36).toUpperCase();
  }

  function parseReferralCode(code) {
    var m = /^TP([0-9A-Z]{1,12})$/.exec(String(code || '').toUpperCase());
    return m ? parseInt(m[1].toLowerCase(), 36) : null;
  }

  function referralLink(id, bot) {
    return 'https://t.me/' + (bot || 'TechnixProBot') + '?start=ref_' + referralCode(id);
  }

  function nextReferralMilestone(count) {
    for (var i = 0; i < CFG.REFERRAL_MILESTONES.length; i++) if (count < CFG.REFERRAL_MILESTONES[i].count) return CFG.REFERRAL_MILESTONES[i];
    return null;
  }

  function newUser(tgUser, now) {
    now = now || new Date().toISOString();
    var id = Number(tgUser.id) || 0;
    return {
      id: id,
      username: tgUser.username || [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'Guest',
      avatar_url: tgUser.photo_url || '',
      level: 1,
      xp_total: 0,
      xp_to_next_level: progress(0).xpToNext,
      stars: 0,
      rig_parts: ['desk'],
      tasks_completed: 0,
      wallet_balance: 0,
      referral_code: referralCode(id),
      referral_count: 0,
      referral_claimed: [],
      ton_keeper_connected: false,
      created_at: now,
      last_active: now,
      last_xp_claim: null,
      last_daily: null,
      settings: { notifications: { posts: true, chat: false, rewards: true }, privacy: { show_online: true, show_in_ranking: true }, language: 'pl' }
    };
  }

  function addXp(user, amount) {
    amount = Math.max(0, Math.floor(Number(amount) || 0));
    user.xp_total += amount;
    var p = progress(user.xp_total);
    user.level = p.level.level;
    user.xp_to_next_level = p.xpToNext;
    return p;
  }

  function metricValue(user, metric, ctx) {
    if (metric === 'in_top10') return ctx && ctx.rank && ctx.rank <= 10 ? 1 : 0;
    return Number(user[metric]) || 0;
  }

  function taskStatus(user, task, claimed, ctx) {
    var value = metricValue(user, task.metric, ctx);
    var done = claimed.indexOf(task.id) !== -1;
    return { value: Math.min(value, task.goal), goal: task.goal, completable: !done && value >= task.goal, done: done };
  }

  function claimTask(user, task, claimed, ctx) {
    var st = taskStatus(user, task, claimed, ctx);
    if (!st.completable) return { ok: false, reason: st.done ? 'already_claimed' : 'not_ready' };
    claimed.push(task.id);
    user.stars += task.rewardStars;
    user.tasks_completed += 1;
    if (task.rewardXp) addXp(user, task.rewardXp);
    return { ok: true };
  }

  // Cooldown helpers (4h XP timer, daily bonus). Return ms remaining until next claim.
  function msUntil(lastIso, hours, nowMs) {
    if (!lastIso) return 0;
    var t = Date.parse(lastIso);
    if (isNaN(t)) return 0;
    return Math.max(0, t + hours * 3600000 - (nowMs || Date.now()));
  }

  function claimTimer(user, nowMs) {
    nowMs = nowMs || Date.now();
    if (msUntil(user.last_xp_claim, CFG.XP_TIMER_HOURS, nowMs) > 0) return { ok: false };
    user.last_xp_claim = new Date(nowMs).toISOString();
    addXp(user, CFG.XP_TIMER_REWARD);
    return { ok: true, xp: CFG.XP_TIMER_REWARD };
  }

  function claimDaily(user, nowMs) {
    nowMs = nowMs || Date.now();
    if (msUntil(user.last_daily, 24, nowMs) > 0) return { ok: false };
    user.last_daily = new Date(nowMs).toISOString();
    addXp(user, CFG.DAILY_REWARD_XP);
    user.tasks_completed += 1;
    return { ok: true, xp: CFG.DAILY_REWARD_XP };
  }

  function claimReferralMilestones(user) {
    var gained = [];
    CFG.REFERRAL_MILESTONES.forEach(function (m) {
      if (user.referral_count >= m.count && user.referral_claimed.indexOf(m.count) === -1) {
        user.referral_claimed.push(m.count);
        addXp(user, m.rewardXp);
        gained.push(m);
      }
    });
    return gained;
  }

  function achievements(user, ctx) {
    var list = [{ id: 'first_login', title: 'Pierwsze logowanie', icon: 'fa-door-open', unlocked: true }];
    CFG.LEVELS.slice(1).forEach(function (l) {
      list.push({ id: 'level_' + l.level, title: 'Poziom ' + l.level + ' — ' + l.name, icon: l.icon, unlocked: user.level >= l.level });
    });
    [10, 50, 100].forEach(function (n) {
      list.push({ id: 'tasks_' + n, title: n + ' zadań', icon: 'fa-list-check', unlocked: user.tasks_completed >= n });
    });
    CFG.REFERRAL_MILESTONES.forEach(function (m) {
      list.push({ id: 'ref_' + m.count, title: m.count + ' poleconych', icon: 'fa-user-plus', unlocked: user.referral_count >= m.count });
    });
    [[10, 'Top 10'], [3, 'Top 3'], [1, 'Nr 1']].forEach(function (p) {
      list.push({ id: 'top_' + p[0], title: p[1] + ' rankingu', icon: 'fa-trophy', unlocked: !!(ctx && ctx.rank && ctx.rank <= p[0]) });
    });
    return list;
  }

  function rankOf(user, others) {
    var better = others.filter(function (o) { return o.id !== user.id && o.xp_total > user.xp_total; }).length;
    return better + 1;
  }

  function safeUrl(u) {
    try {
      var p = new URL(String(u).trim());
      return p.protocol === 'https:' || p.protocol === 'http:' ? p.href : null;
    } catch (e) { return null; }
  }

  function cleanText(s, max) {
    return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
  }

  function parseInitData(initData) {
    if (!initData) return null;
    try {
      var u = new URLSearchParams(initData).get('user');
      var user = u ? JSON.parse(u) : null;
      return user && Number(user.id) ? user : null;
    } catch (e) { return null; }
  }

  function validateAmount(raw, max) {
    var n = Number(raw);
    if (!isFinite(n) || n <= 0) return { ok: false, error: 'Podaj poprawną kwotę.' };
    if (max != null && n > max) return { ok: false, error: 'Niewystarczające środki.' };
    return { ok: true, value: Math.round(n * 1e9) / 1e9 };
  }

  var api = {
    levelFor: levelFor, progress: progress, referralCode: referralCode, parseReferralCode: parseReferralCode,
    referralLink: referralLink, nextReferralMilestone: nextReferralMilestone, newUser: newUser, addXp: addXp,
    taskStatus: taskStatus, claimTask: claimTask, msUntil: msUntil, claimTimer: claimTimer, claimDaily: claimDaily,
    claimReferralMilestones: claimReferralMilestones, achievements: achievements, rankOf: rankOf, safeUrl: safeUrl,
    cleanText: cleanText, parseInitData: parseInitData, validateAmount: validateAmount
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TPCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
