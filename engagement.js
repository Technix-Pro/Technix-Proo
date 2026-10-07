// Fair-engagement logic (streaks, weekly leaderboard, community milestones, anti-bot cooldown, sponsors, cosmetics, CSV). Pure, unit-tested in test/engagement.test.js.
(function (root) {
  'use strict';
  var CFG = root.TP_CONFIG || (typeof require === 'function' ? require('./app-config.js') : {});
  var Core = root.TPCore || (typeof require === 'function' ? require('./core.js') : null);

  var DAY = 86400000;
  var STREAK_BONUSES = Object.freeze({ 7: 25, 14: 60, 30: 150 });
  var COSMETIC_TYPES = ['border', 'theme', 'bubble'];
  var BOT_RULES = Object.freeze({ windowMs: 10000, maxInWindow: 80, regularSamples: 25, regularStdMs: 3, regularMeanMs: 400, cooldownMs: 60000 });

  function toMs(v) { var t = v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(v); return isFinite(t) ? t : Date.now(); }
  function dayKey(v) { return new Date(toMs(v)).toISOString().slice(0, 10); }
  function dayDiff(a, b) { return Math.round((Date.parse(dayKey(b)) - Date.parse(dayKey(a))) / DAY); }

  /* ---------- streaks (user_streaks) ---------- */
  function blankStreak(userId) { return { user_id: userId == null ? null : userId, current_streak: 0, max_streak: 0, last_login: null, reset_at: null }; }

  // +1 per calendar day (UTC) with a login; a missed day quietly restarts at 1. Bonus XP only at day 7/14/30.
  function updateStreak(rec, now) {
    var r = Object.assign(blankStreak(), rec || {});
    var iso = new Date(toMs(now)).toISOString();
    r.current_streak = Math.max(0, Math.floor(Number(r.current_streak)) || 0);
    r.max_streak = Math.max(r.current_streak, Math.floor(Number(r.max_streak)) || 0);
    var status;
    if (!r.last_login || !r.current_streak) { r.current_streak = 1; status = 'new'; }
    else {
      var d = dayDiff(r.last_login, iso);
      if (d <= 0) return { record: r, status: 'same', bonusXp: 0, milestone: null };
      if (d === 1) { r.current_streak += 1; status = 'continued'; }
      else { r.current_streak = 1; r.reset_at = iso; status = 'reset'; }
    }
    r.last_login = iso;
    r.max_streak = Math.max(r.max_streak, r.current_streak);
    var bonus = STREAK_BONUSES[r.current_streak] || 0;
    return { record: r, status: status, bonusXp: bonus, milestone: bonus ? r.current_streak : null };
  }

  /* ---------- weekly leaderboard (leaderboard_history) ---------- */
  function weekKey(now) {
    var d = new Date(Date.parse(dayKey(now)));
    var back = (d.getUTCDay() + 6) % 7;
    return new Date(d.getTime() - back * DAY).toISOString().slice(0, 10);
  }

  function weeklyScores(users, state) {
    var base = (state && state.baseline) || {};
    return (users || []).map(function (u) {
      var b = Number(base[u.id]);
      return { id: u.id, username: u.username || String(u.id), score: Math.max(0, (Number(u.xp_total) || 0) - (isFinite(b) ? b : 0)) };
    }).sort(function (a, b) { return b.score - a.score || String(a.username).localeCompare(String(b.username)); });
  }

  // Everyone starts each week at 0 (baseline = XP at week start). On a new week the old ranking is returned as a snapshot.
  function rotateLeaderboard(state, users, now) {
    var week = weekKey(now), list = users || [];
    var s = state && state.week && state.baseline ? { week: state.week, baseline: Object.assign({}, state.baseline) } : { week: week, baseline: {} };
    var snapshot = null;
    if (s.week !== week) {
      snapshot = { week_start: s.week, rows: weeklyScores(list, s).slice(0, 20), created_at: new Date(toMs(now)).toISOString() };
      s = { week: week, baseline: {} };
      list.forEach(function (u) { s.baseline[u.id] = Number(u.xp_total) || 0; });
    } else {
      list.forEach(function (u) { if (s.baseline[u.id] == null) s.baseline[u.id] = Number(u.xp_total) || 0; });
    }
    return { state: s, snapshot: snapshot, rotated: !!snapshot };
  }

  /* ---------- community milestones (community_milestones) ---------- */
  function detectMilestones(defs, stored, totals, now) {
    var by = {};
    (stored || []).forEach(function (m) { if (m && m.id) by[m.id] = m; });
    var unlocked = [];
    var list = (defs || []).map(function (d) {
      var prev = by[d.id] || {};
      var cur = Math.max(0, Number(totals && totals[d.metric]) || 0);
      var rec = { id: d.id, metric: d.metric, target: d.target, current: Math.max(cur, Number(prev.current) || 0), unlocked_at: prev.unlocked_at || null };
      if (!rec.unlocked_at && rec.current >= d.target) { rec.unlocked_at = new Date(toMs(now)).toISOString(); unlocked.push(rec); }
      return rec;
    });
    return { milestones: list, unlocked: unlocked };
  }

  /* ---------- anti-bot: simple pattern check + temporary cooldown (never a ban) ---------- */
  function checkAction(state, now) {
    var t = toMs(now), s = { times: ((state && state.times) || []).slice(-100), cooldown_until: Number(state && state.cooldown_until) || 0 };
    if (s.cooldown_until > t) return { allowed: false, state: s, retryAfterMs: s.cooldown_until - t, reason: 'cooldown' };
    s.cooldown_until = 0;
    s.times = s.times.filter(function (x) { return t - x <= BOT_RULES.windowMs; });
    s.times.push(t);
    var reason = null;
    if (s.times.length > BOT_RULES.maxInWindow) reason = 'rate';
    else if (s.times.length > BOT_RULES.regularSamples) {
      var recent = s.times.slice(-BOT_RULES.regularSamples - 1), gaps = [];
      for (var i = 1; i < recent.length; i++) gaps.push(recent[i] - recent[i - 1]);
      var mean = gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length;
      var sd = Math.sqrt(gaps.reduce(function (a, g) { return a + (g - mean) * (g - mean); }, 0) / gaps.length);
      if (mean < BOT_RULES.regularMeanMs && sd < BOT_RULES.regularStdMs) reason = 'regular';
    }
    if (reason) { s.cooldown_until = t + BOT_RULES.cooldownMs; s.times = []; return { allowed: false, state: s, retryAfterMs: BOT_RULES.cooldownMs, reason: reason }; }
    return { allowed: true, state: s, retryAfterMs: 0, reason: null };
  }

  /* ---------- sponsors ---------- */
  function validateSponsor(input, now) {
    var i = input || {}, errors = [];
    var name = Core.cleanText(i.name, 60);
    var link = Core.safeUrl(i.link || '');
    var logo = i.logo_url ? Core.safeUrl(i.logo_url) : '';
    var start = Date.parse(i.start_date), end = Date.parse(i.end_date);
    if (!name) errors.push('name');
    if (!link) errors.push('link');
    if (i.logo_url && !logo) errors.push('logo');
    if (!isFinite(start)) errors.push('start');
    if (!isFinite(end)) errors.push('end');
    if (isFinite(start) && isFinite(end) && end < start) errors.push('range');
    if (errors.length) return { ok: false, errors: errors };
    return { ok: true, sponsor: { id: i.id || null, name: name, logo_url: logo || '', link: link, start_date: new Date(start).toISOString(), end_date: new Date(end).toISOString(), created_by: i.created_by == null ? null : i.created_by } };
  }
  function sponsorActive(s, now) { var t = toMs(now); return !!s && Date.parse(s.start_date) <= t && t <= Date.parse(s.end_date); }
  function activeSponsors(list, now) { return (list || []).filter(function (s) { return sponsorActive(s, now); }); }
  function sponsorFor(post, list, now) {
    if (!post || !post.sponsor_id) return null;
    var s = (list || []).filter(function (x) { return x.id === post.sponsor_id; })[0];
    return s && sponsorActive(s, now) ? s : null;
  }
  function disclosure(sponsor) { return 'Wspierane przez ' + sponsor.name; }

  /* ---------- premium cosmetics (premium_cosmetics / user_premium) ---------- */
  function validateCosmetic(input) {
    var i = input || {}, name = Core.cleanText(i.name, 40);
    if (!name) return { ok: false, error: 'name' };
    if (COSMETIC_TYPES.indexOf(i.type) === -1) return { ok: false, error: 'type' };
    var cfg = i.config;
    if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg || '{}'); } catch (e) { return { ok: false, error: 'config' }; } }
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return { ok: false, error: 'config' };
    var clean = {};
    Object.keys(cfg).slice(0, 8).forEach(function (k) {
      var v = cfg[k];
      if (typeof v === 'string' && /^[#\w\s.,()%-]{1,40}$/.test(v)) clean[k] = v;
      else if (typeof v === 'number' && isFinite(v)) clean[k] = v;
    });
    return { ok: true, cosmetic: { id: i.id || null, name: name, type: i.type, config: clean } };
  }
  function premiumActive(rec, now) { return !!rec && !!rec.tier && (!rec.expires_at || Date.parse(rec.expires_at) > toMs(now)); }

  /* ---------- analytics + CSV ---------- */
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(header, rows) {
    return [header].concat(rows).map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }
  function inMonth(iso, month) { return typeof iso === 'string' && iso.slice(0, 7) === month; }

  function dailyActive(activity, month) {
    var days = {};
    Object.keys(activity || {}).forEach(function (id) { var a = activity[id]; if (inMonth(a, month)) { var d = a.slice(0, 10); days[d] = (days[d] || 0) + 1; } });
    return Object.keys(days).sort().map(function (d) { return [d, days[d]]; });
  }
  // Retention: share of users created before the month who were active in it. Aggregates only.
  function retention(users, activity, month) {
    var cohort = (users || []).filter(function (u) { return u.created_at && u.created_at.slice(0, 7) < month; });
    var kept = cohort.filter(function (u) { return inMonth((activity || {})[u.id], month); }).length;
    return { cohort: cohort.length, retained: kept, percent: cohort.length ? Math.round(kept / cohort.length * 100) : 0 };
  }
  function sponsorReportCsv(sponsors, month, stats) {
    var st = stats || {};
    return toCsv(['sponsor', 'link', 'start_date', 'end_date', 'active_in_month', 'sponsored_posts', 'likes', 'comments', 'active_users'],
      (sponsors || []).map(function (s) {
        var first = month + '-01', last = month + '-31', x = (st[s.id] || {});
        var active = s.start_date.slice(0, 10) <= last && s.end_date.slice(0, 10) >= first;
        return [s.name, s.link, s.start_date.slice(0, 10), s.end_date.slice(0, 10), active ? 'yes' : 'no', x.posts || 0, x.likes || 0, x.comments || 0, x.activeUsers || 0];
      }));
  }
  function sponsorPostStats(posts, month) {
    var out = {};
    (posts || []).forEach(function (p) {
      if (!p.sponsor_id || !inMonth(p.created_at, month)) return;
      var o = out[p.sponsor_id] = out[p.sponsor_id] || { posts: 0, likes: 0, comments: 0 };
      o.posts++; o.likes += (p.likes || []).length; o.comments += (p.comments || []).length;
    });
    return out;
  }
  function analyticsCsv(month, users, activity) {
    var r = retention(users, activity, month);
    var rows = dailyActive(activity, month).map(function (d) { return ['daily_active_users', d[0], d[1]]; });
    rows.push(['retention_cohort', month, r.cohort], ['retention_retained', month, r.retained], ['retention_percent', month, r.percent]);
    return toCsv(['metric', 'key', 'value'], rows);
  }

  var api = {
    STREAK_BONUSES: STREAK_BONUSES, COSMETIC_TYPES: COSMETIC_TYPES, BOT_RULES: BOT_RULES,
    dayKey: dayKey, blankStreak: blankStreak, updateStreak: updateStreak, weekKey: weekKey, weeklyScores: weeklyScores,
    rotateLeaderboard: rotateLeaderboard, detectMilestones: detectMilestones, checkAction: checkAction,
    validateSponsor: validateSponsor, sponsorActive: sponsorActive, activeSponsors: activeSponsors, sponsorFor: sponsorFor, disclosure: disclosure,
    validateCosmetic: validateCosmetic, premiumActive: premiumActive, csvCell: csvCell, toCsv: toCsv,
    dailyActive: dailyActive, retention: retention, sponsorReportCsv: sponsorReportCsv, sponsorPostStats: sponsorPostStats, analyticsCsv: analyticsCsv
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TPEngage = api;
})(typeof window !== 'undefined' ? window : globalThis);
