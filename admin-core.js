// Pure admin logic (phases, feature flags, permissions, validation, stats). No DOM access, unit-tested in test/admin-core.test.js.
(function (root) {
  var CFG = root.TP_CONFIG || (typeof require === 'function' ? require('./app-config.js') : null);

  var FEATURES = ['chat', 'bonus', 'rig', 'wallet', 'shop', 'airdrop'];
  var METRICS = ['xp_total', 'tasks_completed', 'referral_count', 'in_top10', 'level', 'clicks'];

  function flagSet(on) {
    var o = {};
    FEATURES.forEach(function (f) { o[f] = on.indexOf(f) !== -1; });
    return Object.freeze(o);
  }

  var PHASES = Object.freeze({
    1: Object.freeze({ number: 1, name: 'Stealth Launch', features: flagSet([]) }),
    2: Object.freeze({ number: 2, name: 'Community Launch', features: flagSet(['chat', 'bonus', 'rig']) }),
    3: Object.freeze({ number: 3, name: 'Token & Wallet Launch', features: flagSet(['chat', 'bonus', 'rig', 'wallet', 'shop', 'airdrop']) })
  });

  var DEFAULT_CONFIG = Object.freeze({
    xp_timer_hours: CFG.XP_TIMER_HOURS,
    xp_timer_reward: CFG.XP_TIMER_REWARD,
    daily_reward: CFG.DAILY_REWARD_XP,
    xp_multiplier: 1,
    referral_scale: 1,
    referral_rewards: CFG.REFERRAL_MILESTONES.map(function (m) { return m.rewardXp; }),
    rig_prices: {},
    animation_speed: 1,
    debug: false,
    airdrop_pool: 100000000,
    airdrop_rate: 1000,
    click_thresholds: Object.freeze({ small: 100, smallXp: 5, big: 1000, bigXp: 50, special: 10000 })
  });

  function num(v, min, max, fallback) {
    var n = Number(v);
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function defaultState() {
    var flags = {};
    FEATURES.forEach(function (f) { flags[f] = true; });
    // phase 0 = no phase deployed yet: everything stays available (backward compatible with older installs).
    return { phase: 0, flags: flags, config: {}, tasks: null, events: null };
  }

  function normalizeState(raw) {
    var s = defaultState();
    if (!raw || typeof raw !== 'object') return s;
    var p = Math.floor(Number(raw.phase));
    s.phase = p >= 1 && p <= 3 ? p : 0;
    FEATURES.forEach(function (f) { if (raw.flags && typeof raw.flags[f] === 'boolean') s.flags[f] = raw.flags[f]; });
    s.config = raw.config && typeof raw.config === 'object' ? raw.config : {};
    s.tasks = Array.isArray(raw.tasks) ? raw.tasks : null;
    s.events = Array.isArray(raw.events) ? raw.events : null;
    return s;
  }

  function isAdminId(id, adminIds) {
    var n = Number(id);
    if (!n || !Array.isArray(adminIds)) return false;
    return adminIds.map(Number).indexOf(n) !== -1;
  }

  function featureVisible(state, feature, adminView) {
    if (adminView) return true;
    if (FEATURES.indexOf(feature) === -1) return true;
    return !state || !state.flags || state.flags[feature] !== false;
  }

  function deployPhase(state, number, ctx) {
    ctx = ctx || {};
    if (!ctx.isAdmin) return { ok: false, reason: 'forbidden' };
    var phase = PHASES[number];
    if (!phase) return { ok: false, reason: 'unknown_phase' };
    var next = normalizeState(state);
    next.phase = phase.number;
    FEATURES.forEach(function (f) { next.flags[f] = phase.features[f]; });
    var record = { id: ctx.id || String(Date.now()), number: phase.number, name: phase.name, config: JSON.parse(JSON.stringify(phase.features)), deployed_at: ctx.now || new Date().toISOString(), deployed_by: Number(ctx.adminId) || 0 };
    return { ok: true, state: next, record: record };
  }

  function setFlag(state, feature, value, ctx) {
    if (!ctx || !ctx.isAdmin) return { ok: false, reason: 'forbidden' };
    if (FEATURES.indexOf(feature) === -1) return { ok: false, reason: 'unknown_feature' };
    var next = normalizeState(state);
    next.flags[feature] = !!value;
    return { ok: true, state: next };
  }

  function effectiveConfig(state) {
    var c = (state && state.config) || {};
    var d = DEFAULT_CONFIG;
    var rewards = Array.isArray(c.referral_rewards) ? c.referral_rewards : d.referral_rewards;
    var prices = {};
    CFG.RIG_PARTS.forEach(function (p) {
      var v = c.rig_prices && c.rig_prices[p.key];
      prices[p.key] = p.key === 'desk' ? 0 : Math.round(num(v, 0, 100000, p.price));
    });
    var t = c.click_thresholds || {};
    return {
      xpTimerHours: num(c.xp_timer_hours, 1, 48, d.xp_timer_hours),
      xpTimerReward: Math.round(num(c.xp_timer_reward, 0, 100000, d.xp_timer_reward)),
      dailyReward: Math.round(num(c.daily_reward, 0, 100000, d.daily_reward)),
      xpMultiplier: num(c.xp_multiplier, 0.5, 2, 1),
      referralScale: num(c.referral_scale, 0.1, 10, 1),
      milestones: CFG.REFERRAL_MILESTONES.map(function (m, i) {
        return { count: m.count, rewardXp: Math.round(num(rewards[i], 0, 1000000, m.rewardXp) * num(c.referral_scale, 0.1, 10, 1)) };
      }),
      rigPrices: prices,
      animationSpeed: num(c.animation_speed, 0.25, 3, 1),
      debug: c.debug === true,
      airdropPool: Math.round(num(c.airdrop_pool, 0, 1e12, d.airdrop_pool)),
      airdropRate: Math.round(num(c.airdrop_rate, 1, 1e9, d.airdrop_rate)),
      clicks: {
        small: Math.round(num(t.small, 1, 1e6, d.click_thresholds.small)), smallXp: Math.round(num(t.smallXp, 0, 1e5, d.click_thresholds.smallXp)),
        big: Math.round(num(t.big, 1, 1e6, d.click_thresholds.big)), bigXp: Math.round(num(t.bigXp, 0, 1e5, d.click_thresholds.bigXp)),
        special: Math.round(num(t.special, 1, 1e7, d.click_thresholds.special))
      }
    };
  }

  function scaleXp(amount, multiplier) {
    return Math.max(0, Math.round((Number(amount) || 0) * num(multiplier, 0.5, 2, 1)));
  }

  // Bonus for going from prev to next total clicks. Higher tiers replace (not add to) the lower tier at the same count.
  function clickReward(prev, next, thr) {
    thr = thr || DEFAULT_CONFIG.click_thresholds;
    prev = Math.max(0, Math.floor(prev)); next = Math.max(prev, Math.floor(next));
    function crossed(n) { return Math.floor(next / n) - Math.floor(prev / n); }
    var nSpecial = crossed(thr.special), nBig = crossed(thr.big), nSmall = crossed(thr.small);
    var big = Math.max(0, nBig - nSpecial), small = Math.max(0, nSmall - nBig);
    return { xp: small * thr.smallXp + (big + nSpecial) * thr.bigXp, lootbox: nBig > 0, achievement: nSpecial > 0 };
  }

  /* ---------- posts ---------- */
  function postVisible(post, adminView, nowMs) {
    if (adminView) return true;
    if (post.published) return true;
    var t = Date.parse(post.scheduled_at);
    return !isNaN(t) && t <= (nowMs == null ? Date.now() : nowMs);
  }

  function safeImage(u) {
    var s = String(u == null ? '' : u).trim();
    if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) return s;
    if (/\.svg(\?|#|$)/i.test(s)) return null;
    return root.TPCore ? root.TPCore.safeUrl(s) : null;
  }

  function safeVideo(u) {
    var url = root.TPCore ? root.TPCore.safeUrl(u) : null;
    return url && /\.(mp4|webm)(\?|#|$)/i.test(url) ? url : null;
  }

  function parseLines(text, fn, max) {
    var out = [], bad = 0;
    String(text || '').split('\n').forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var v = fn(line);
      if (v) out.push(v); else bad++;
    });
    return { items: out.slice(0, max || 5), invalid: bad };
  }

  function validatePost(input, max) {
    var Core = root.TPCore;
    var content = Core.cleanText(input.content, max || 2000);
    var images = parseLines(input.images, safeImage).items.concat((input.attachments || []).filter(safeImage)).slice(0, 5);
    var videos = parseLines(input.videos, safeVideo);
    var links = parseLines(input.links, Core.safeUrl);
    var invalid = videos.invalid + links.invalid + parseLines(input.images, safeImage).invalid;
    if (!content && !images.length && !videos.items.length && !links.items.length) return { ok: false, error: 'empty' };
    var scheduled = null;
    if (input.scheduled_at) {
      var t = Date.parse(input.scheduled_at);
      if (isNaN(t)) return { ok: false, error: 'bad_date' };
      scheduled = new Date(t).toISOString();
    }
    return { ok: true, invalid: invalid, post: { content: content, images: images, videos: videos.items, links: links.items, scheduled_at: scheduled } };
  }

  function trashPost(posts, trash, postId, adminId, now, id) {
    var post = posts.filter(function (p) { return p.id === postId; })[0];
    if (!post) return { posts: posts, trash: trash, ok: false };
    return {
      ok: true,
      posts: posts.filter(function (p) { return p.id !== postId; }),
      trash: [{ id: id, original_post_id: postId, post: post, deleted_by: Number(adminId) || 0, deleted_at: now, restored_at: null }].concat(trash)
    };
  }

  function restorePost(posts, trash, trashId, now) {
    var item = trash.filter(function (t) { return t.id === trashId && !t.restored_at; })[0];
    if (!item) return { posts: posts, trash: trash, ok: false };
    var exists = posts.some(function (p) { return p.id === item.original_post_id; });
    return {
      ok: true,
      posts: exists ? posts : posts.concat([item.post]),
      trash: trash.map(function (t) { return t === item ? Object.assign({}, t, { restored_at: now }) : t; })
    };
  }

  /* ---------- tasks / events / notifications ---------- */
  function validateTask(t) {
    var Core = root.TPCore;
    var title = Core.cleanText(t.title, 80);
    if (!title) return { ok: false, error: 'title' };
    if (METRICS.indexOf(t.metric) === -1) return { ok: false, error: 'metric' };
    var goal = Math.floor(Number(t.goal));
    if (!isFinite(goal) || goal < 1 || goal > 1e9) return { ok: false, error: 'goal' };
    var xp = Math.floor(Number(t.rewardXp) || 0), stars = Math.floor(Number(t.rewardStars) || 0);
    if (xp < 0 || stars < 0 || xp > 1e6 || stars > 1e6) return { ok: false, error: 'reward' };
    var id = String(t.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
    if (!id) return { ok: false, error: 'id' };
    return { ok: true, task: { id: id, title: title, desc: Core.cleanText(t.desc, 200), goal: goal, metric: t.metric, rewardXp: xp, rewardStars: stars, enabled: t.enabled !== false } };
  }

  function validateEvent(e) {
    var Core = root.TPCore;
    var title = Core.cleanText(e.title, 80);
    if (!title) return { ok: false, error: 'title' };
    var id = String(e.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
    if (!id) return { ok: false, error: 'id' };
    var dates = {};
    ['starts_at', 'ends_at'].forEach(function (k) {
      var v = e[k];
      if (!v) { dates[k] = null; return; }
      var t = Date.parse(v);
      dates[k] = isNaN(t) ? undefined : new Date(t).toISOString();
    });
    if (dates.starts_at === undefined || dates.ends_at === undefined) return { ok: false, error: 'date' };
    if (dates.starts_at && dates.ends_at && Date.parse(dates.ends_at) < Date.parse(dates.starts_at)) return { ok: false, error: 'date_order' };
    return { ok: true, event: { id: id, title: title, desc: Core.cleanText(e.desc, 200), reward: Core.cleanText(e.reward, 40), live: !!e.live, starts_at: dates.starts_at, ends_at: dates.ends_at } };
  }

  function validateNotification(n) {
    var Core = root.TPCore;
    var title = Core.cleanText(n.title, 80), message = Core.cleanText(n.message, 300);
    if (!title || !message) return { ok: false, error: 'empty' };
    var link = null;
    if (n.link && String(n.link).trim()) {
      link = Core.safeUrl(n.link);
      if (!link) return { ok: false, error: 'link' };
    }
    var scheduled = null;
    if (n.scheduled_at) {
      var t = Date.parse(n.scheduled_at);
      if (isNaN(t)) return { ok: false, error: 'date' };
      scheduled = new Date(t).toISOString();
    }
    return { ok: true, notification: { title: title, message: message, link: link, scheduled_at: scheduled } };
  }

  function notificationStatus(n, nowMs) {
    var t = Date.parse(n.scheduled_at);
    return !isNaN(t) && t > (nowMs == null ? Date.now() : nowMs) ? 'scheduled' : 'sent';
  }

  function pendingNotifications(list, seen, nowMs) {
    return list.filter(function (n) { return n.status !== 'cancelled' && notificationStatus(n, nowMs) === 'sent' && seen.indexOf(n.id) === -1; });
  }

  /* ---------- stats ---------- */
  function computeStats(input, nowMs) {
    nowMs = nowMs == null ? Date.now() : nowMs;
    var users = input.users || [], activity = input.activity || {}, txs = input.transactions || [], taskStats = input.taskStats || {}, phases = input.phases || [];
    function within(ms) { return Object.keys(activity).filter(function (k) { return nowMs - Date.parse(activity[k]) <= ms; }).length; }
    var totalXp = users.reduce(function (s, u) { return s + (Number(u.xp_total) || 0); }, 0);
    var totalBalance = users.reduce(function (s, u) { return s + (Number(u.wallet_balance) || 0); }, 0);
    var completed = users.reduce(function (s, u) { return s + (Number(u.tasks_completed) || 0); }, 0);
    var referrals = users.reduce(function (s, u) { return s + (Number(u.referral_count) || 0); }, 0);
    var n = users.length;
    var last = phases.length ? phases[0] : null;
    var adopted = last ? Object.keys(activity).filter(function (k) { return Date.parse(activity[k]) >= Date.parse(last.deployed_at); }).length : 0;
    return {
      users: n,
      online: input.online || 0,
      active24h: within(86400000),
      active7d: within(7 * 86400000),
      avgXp: n ? Math.round(totalXp / n) : 0,
      tasksCompleted: completed,
      referrals: referrals,
      totalXp: totalXp,
      avgBalance: n ? Math.round((totalBalance / n) * 1e9) / 1e9 : 0,
      txVolume: Math.round(txs.reduce(function (s, t) { return s + (Number(t.amount) || 0); }, 0) * 1e9) / 1e9,
      topTasks: Object.keys(taskStats).map(function (k) { return { id: k, count: taskStats[k] }; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 5),
      lastPhase: last,
      adoption: last && n ? Math.min(100, Math.round(adopted / Math.max(1, Object.keys(activity).length) * 100)) : 0
    };
  }

  /* ---------- backup ---------- */
  function validateBackup(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, error: 'format' };
    if (obj.app !== 'technixpro-admin' || obj.version !== 1) return { ok: false, error: 'version' };
    if (!obj.admin || typeof obj.admin !== 'object') return { ok: false, error: 'admin' };
    if (!Array.isArray(obj.posts)) return { ok: false, error: 'posts' };
    var bad = obj.posts.some(function (p) { return !p || typeof p !== 'object' || typeof p.id !== 'string'; });
    return bad ? { ok: false, error: 'posts' } : { ok: true };
  }

  var api = {
    FEATURES: FEATURES, METRICS: METRICS, PHASES: PHASES, DEFAULT_CONFIG: DEFAULT_CONFIG,
    defaultState: defaultState, normalizeState: normalizeState, isAdminId: isAdminId, featureVisible: featureVisible,
    deployPhase: deployPhase, setFlag: setFlag, effectiveConfig: effectiveConfig, scaleXp: scaleXp, clickReward: clickReward,
    postVisible: postVisible, safeImage: safeImage, safeVideo: safeVideo, validatePost: validatePost,
    trashPost: trashPost, restorePost: restorePost, validateTask: validateTask, validateEvent: validateEvent,
    validateNotification: validateNotification, notificationStatus: notificationStatus, pendingNotifications: pendingNotifications,
    computeStats: computeStats, validateBackup: validateBackup
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TPAdmin = api;
})(typeof window !== 'undefined' ? window : globalThis);
