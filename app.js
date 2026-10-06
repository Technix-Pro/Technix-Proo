(function () {
  'use strict';
  var CFG = window.TP_CONFIG, SEC = window.TECHNIX_CONFIG || {}, Core = window.TPCore, Data = window.TPData;
  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  if (tg) { try { tg.ready(); tg.expand(); } catch (e) { /* ignore */ } }

  var I18N = {
    pl: { channel: 'Kanał', chat: 'Chat', bonus: 'Bonusy', profile: 'Profil' },
    en: { channel: 'Channel', chat: 'Chat', bonus: 'Bonuses', profile: 'Profile' }
  };
  var TABS = [['channel', 'fa-bullhorn'], ['chat', 'fa-comments'], ['bonus', 'fa-gift'], ['profile', 'fa-user']];
  var BONUS_SUBS = [['overview', 'Przegląd'], ['events', 'Live'], ['tasks', 'Zadania'], ['referral', 'Polecenia'], ['badges', 'Odznaki']];
  var PROFILE_SUBS = [['info', 'Profil'], ['wallet', 'Portfel'], ['settings', 'Ustawienia']];
  var SETTINGS_SUBS = [['account', 'Konto'], ['notifications', 'Powiadomienia'], ['privacy', 'Prywatność'], ['language', 'Język']];

  var identity = resolveIdentity();
  var me = Data.loadUser(identity.user);
  var claimed = Data.claimed(me.id);
  var ui = { tab: 'channel', bonus: 'overview', profile: 'info', settings: 'account', preview: false, openComments: {}, chatDraft: '' };
  var content = document.getElementById('app-content');
  var chatTimer = null, lastSend = 0;

  /* ---------- helpers ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { append(el, x); });
    else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  function icon(name, extra) { return h('i', { class: 'fa-solid ' + name + (extra ? ' ' + extra : ''), 'aria-hidden': 'true' }); }
  function fmt(n) { return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 9 }).format(n); }
  function fmtDate(iso) { var d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString(me.settings.language === 'en' ? 'en-GB' : 'pl-PL', { dateStyle: 'short', timeStyle: 'short' }); }
  function fmtDuration(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000)), hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    return [hh, mm, ss].map(function (x) { return String(x).padStart(2, '0'); }).join(':');
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }
  function save() { Data.saveUser(me); Data.saveClaimed(me.id, claimed); }
  function tr(key) { return (I18N[me.settings.language] || I18N.pl)[key]; }

  function resolveIdentity() {
    var u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (!u && tg && tg.initData) u = Core.parseInitData(tg.initData);
    if (u && Number(u.id)) return { user: u, telegram: true };
    var id = null;
    try { id = Number(localStorage.getItem('technixpro-guest-id')); } catch (e) { /* ignore */ }
    if (!id) {
      id = 100000000 + (window.crypto.getRandomValues(new Uint32Array(1))[0] % 899999999);
      try { localStorage.setItem('technixpro-guest-id', String(id)); } catch (e) { /* ignore */ }
    }
    return { user: { id: id, username: 'guest' + String(id).slice(-4), first_name: 'Guest' }, telegram: false };
  }

  function isLocal() { return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:'; }
  function isAdmin() {
    var ids = (SEC.ADMIN_IDS || []).map(Number);
    return ids.indexOf(Number(me.id)) !== -1 || (!!SEC.DEV_MODE && isLocal() && /[?&]admin=1/.test(location.search));
  }

  function rankCtx() {
    var leaders = Data.leaders();
    var rank = Core.rankOf(me, leaders);
    return { rank: rank, leaders: leaders };
  }

  function avatar(user, size) {
    var el = h('span', { class: 'avatar', style: size ? 'width:' + size + 'px;height:' + size + 'px' : null });
    var url = user.avatar_url && (/^data:image\/(jpeg|png|webp);base64,/.test(user.avatar_url) || Core.safeUrl(user.avatar_url));
    if (url) el.appendChild(h('img', { src: user.avatar_url, alt: '', referrerpolicy: 'no-referrer' }));
    else el.textContent = (user.username || '?').charAt(0).toUpperCase();
    return el;
  }

  function levelBadge(user) {
    var l = Core.levelFor(user.xp_total);
    return h('span', { class: 'inline-flex items-center gap-1.5' }, icon(l.icon, 'text-amber-300'), 'Lv ' + l.level + ' · ' + l.name);
  }

  function grantXp(amount) {
    var before = me.level;
    Core.addXp(me, amount);
    var gained = Core.claimReferralMilestones(me);
    gained.forEach(function (m) { toast('Nagroda za ' + m.count + ' poleconych: +' + m.rewardXp + ' XP'); });
    if (me.level > before) toast('Nowy poziom: ' + Core.levelFor(me.xp_total).name + '!');
  }

  /* ---------- shell ---------- */
  function renderShell() {
    var l = Core.levelFor(me.xp_total);
    var hb = document.getElementById('header-avatar');
    hb.replaceChildren(avatar(me, 40));
    hb.onclick = function () { setTab('profile'); };
    document.getElementById('header-title').textContent = me.username;
    document.getElementById('header-sub').textContent = 'ID: ' + me.id + ' · ' + fmt(me.xp_total) + ' XP';
    document.getElementById('header-level').replaceChildren(icon(l.icon), ' Lv ' + l.level);
    document.getElementById('bottom-nav').replaceChildren.apply(document.getElementById('bottom-nav'), TABS.map(function (t) {
      return h('button', { class: 'nav-btn' + (ui.tab === t[0] ? ' active' : ''), type: 'button', onclick: function () { setTab(t[0]); } }, icon(t[1]), tr(t[0]));
    }));
  }

  function setTab(t) { ui.tab = t; render(); window.scrollTo(0, 0); }

  function subtabs(list, current, onPick) {
    return h('div', { class: 'subtabs', role: 'tablist' }, list.map(function (s) {
      return h('button', { type: 'button', role: 'tab', class: 'subtab' + (current === s[0] ? ' active' : ''), onclick: function () { onPick(s[0]); } }, s[1]);
    }));
  }

  function render() {
    clearInterval(chatTimer); chatTimer = null;
    renderShell();
    var view = { channel: viewChannel, chat: viewChat, bonus: viewBonus, profile: viewProfile }[ui.tab]();
    content.replaceChildren(h('section', { class: 'screen space-y-4' }, view));
    tick();
  }

  /* ---------- countdown ticker ---------- */
  function countdown(untilMs, onZero) {
    var el = h('span', { class: 'font-mono font-bold', 'data-until': String(untilMs) });
    el._onZero = onZero;
    el.textContent = fmtDuration(untilMs - Date.now());
    return el;
  }
  function tick() {
    document.querySelectorAll('[data-until]').forEach(function (el) {
      var left = Number(el.getAttribute('data-until')) - Date.now();
      el.textContent = fmtDuration(left);
      if (left <= 0 && !el._fired) { el._fired = true; if (el._onZero) el._onZero(); }
    });
  }
  setInterval(tick, 1000);

  /* ---------- CHANNEL + ADMIN ---------- */
  function visiblePosts() {
    var admin = isAdmin() && !ui.preview;
    return Data.getPosts().filter(function (p) { return p.published || admin; })
      .sort(function (a, b) { return Date.parse(b.created_at) - Date.parse(a.created_at); });
  }

  function viewChannel() {
    var out = [];
    if (isAdmin()) out.push(adminPanel());
    var posts = visiblePosts();
    if (!posts.length) out.push(h('div', { class: 'panel text-sm muted text-center' }, 'Brak postów. ' + (isAdmin() ? 'Dodaj pierwszy powyżej.' : 'Wróć wkrótce!')));
    posts.forEach(function (p) { out.push(postCard(p)); });
    return out;
  }

  function adminPanel() {
    var wrap = h('div', { class: 'panel space-y-3 border-amber-500/40' });
    wrap.appendChild(h('div', { class: 'flex items-center justify-between' },
      h('h2', { class: 'font-bold text-amber-300 text-sm' }, icon('fa-shield-halved'), ' Panel administratora'),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { ui.preview = !ui.preview; render(); } }, ui.preview ? 'Wróć do panelu' : 'Podgląd użytkownika')));
    if (ui.preview) { wrap.appendChild(h('p', { class: 'text-xs muted' }, 'Tryb podglądu: widzisz tylko opublikowane posty tak jak użytkownicy.')); return wrap; }
    var nextClaim = Date.now() + Core.msUntil(me.last_xp_claim, CFG.XP_TIMER_HOURS);
    wrap.appendChild(h('div', { class: 'text-xs flex justify-between' }, h('span', { class: 'muted' }, 'Timer XP (' + CFG.XP_TIMER_HOURS + 'h)'),
      Core.msUntil(me.last_xp_claim, CFG.XP_TIMER_HOURS) > 0 ? countdown(nextClaim) : h('span', { class: 'text-emerald-400 font-bold' }, 'Gotowy do odbioru')));
    var text = h('textarea', { class: 'field', rows: '3', maxlength: String(CFG.POST_MAX_LENGTH), placeholder: 'Treść posta…' });
    var imgs = h('textarea', { class: 'field', rows: '2', placeholder: 'Obrazy — URL, po jednym w linii' });
    var vids = h('textarea', { class: 'field', rows: '2', placeholder: 'Wideo — URL (.mp4/.webm), po jednym w linii' });
    var links = h('textarea', { class: 'field', rows: '2', placeholder: 'Linki — po jednym w linii' });
    function collect(published) {
      var content_ = Core.cleanText(text.value, CFG.POST_MAX_LENGTH);
      var lines = function (el) { return el.value.split('\n').map(Core.safeUrl).filter(Boolean).slice(0, 5); };
      var post = { id: Data.newId(), admin_id: me.id, content: content_, images: lines(imgs), videos: lines(vids), links: lines(links), likes: [], comments: [], likes_count: 0, comments_count: 0, created_at: new Date().toISOString(), published: published };
      if (!post.content && !post.images.length && !post.videos.length && !post.links.length) { toast('Post jest pusty.'); return; }
      var all = Data.getPosts(); all.push(post); Data.savePosts(all);
      toast(published ? 'Opublikowano.' : 'Zapisano szkic.'); render();
    }
    wrap.appendChild(h('div', { class: 'space-y-2' }, text, imgs, vids, links));
    wrap.appendChild(h('div', { class: 'flex gap-2' },
      h('button', { type: 'button', class: 'btn btn-ghost flex-1', onclick: function () { collect(false); } }, 'Zapisz szkic'),
      h('button', { type: 'button', class: 'btn flex-1', onclick: function () { collect(true); } }, 'Opublikuj')));
    return wrap;
  }

  function postCard(p) {
    var admin = isAdmin() && !ui.preview;
    var card = h('article', { class: 'panel space-y-3' });
    card.appendChild(h('div', { class: 'flex items-center justify-between text-xs' },
      h('span', { class: 'font-bold text-cyan-300' }, 'TechnixPro'),
      h('span', { class: 'muted' }, (p.published ? '' : '[SZKIC] ') + fmtDate(p.created_at))));
    if (p.content) card.appendChild(h('p', { class: 'text-sm whitespace-pre-wrap break-words', text: p.content }));
    (p.images || []).forEach(function (u) { if (Core.safeUrl(u)) card.appendChild(h('img', { class: 'post-media', src: u, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' })); });
    (p.videos || []).forEach(function (u) { if (Core.safeUrl(u)) card.appendChild(h('video', { class: 'post-media', src: u, controls: true, preload: 'metadata' })); });
    (p.links || []).forEach(function (u) { if (Core.safeUrl(u)) card.appendChild(h('a', { class: 'block text-xs text-cyan-300 underline break-all', href: u, target: '_blank', rel: 'noopener noreferrer' }, icon('fa-link'), ' ' + u)); });
    var liked = (p.likes || []).indexOf(me.id) !== -1;
    var row = h('div', { class: 'flex items-center gap-2 text-xs' },
      h('button', { type: 'button', class: 'btn btn-ghost', 'aria-pressed': String(liked), onclick: function () { mutatePost(p.id, function (x) { var i = x.likes.indexOf(me.id); if (i === -1) x.likes.push(me.id); else x.likes.splice(i, 1); }); } },
        h('i', { class: (liked ? 'fa-solid text-pink-400' : 'fa-regular') + ' fa-heart' }), ' ' + (p.likes || []).length),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { ui.openComments[p.id] = !ui.openComments[p.id]; render(); } }, icon('fa-comment'), ' ' + (p.comments || []).length));
    if (admin) {
      row.appendChild(h('span', { class: 'flex-1' }));
      row.appendChild(h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { mutatePost(p.id, function (x) { x.published = !x.published; }); } }, p.published ? 'Ukryj' : 'Publikuj'));
      row.appendChild(h('button', { type: 'button', class: 'btn btn-danger', 'aria-label': 'Usuń post', onclick: function () { if (confirm('Usunąć post?')) { Data.savePosts(Data.getPosts().filter(function (x) { return x.id !== p.id; })); render(); } } }, icon('fa-trash')));
    }
    card.appendChild(row);
    if (ui.openComments[p.id]) card.appendChild(commentsBlock(p, admin));
    return card;
  }

  function mutatePost(id, fn) {
    var all = Data.getPosts();
    all.forEach(function (x) { if (x.id === id) { x.likes = x.likes || []; x.comments = x.comments || []; fn(x); x.likes_count = x.likes.length; x.comments_count = x.comments.length; } });
    Data.savePosts(all); render();
  }

  function commentsBlock(p, admin) {
    var box = h('div', { class: 'space-y-2 border-t border-slate-800 pt-2' });
    (p.comments || []).forEach(function (c) {
      box.appendChild(h('div', { class: 'text-xs flex gap-2 items-start' },
        h('div', { class: 'flex-1' }, h('b', { class: 'text-slate-200' }, c.username + ': '), h('span', { class: 'break-words', text: c.content })),
        admin ? h('button', { type: 'button', class: 'text-rose-400', 'aria-label': 'Usuń komentarz', onclick: function () { mutatePost(p.id, function (x) { x.comments = x.comments.filter(function (y) { return y.id !== c.id; }); }); } }, icon('fa-xmark')) : null));
    });
    var input = h('input', { class: 'field', maxlength: '300', placeholder: 'Dodaj komentarz…' });
    function send() {
      var t = Core.cleanText(input.value, 300);
      if (!t) return;
      mutatePost(p.id, function (x) { x.comments.push({ id: Data.newId(), user_id: me.id, username: me.username, content: t, created_at: new Date().toISOString() }); });
    }
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
    box.appendChild(h('div', { class: 'flex gap-2' }, input, h('button', { type: 'button', class: 'btn', onclick: send }, 'Wyślij')));
    return box;
  }

  /* ---------- CHAT ---------- */
  function viewChat() {
    var list = h('div', { class: 'chat-list', role: 'log', 'aria-live': 'polite' });
    var online = h('span', { class: 'text-xs muted' });
    var input = h('input', { class: 'field', maxlength: String(CFG.CHAT_MAX_LENGTH), placeholder: 'Napisz wiadomość…', value: ui.chatDraft });
    input.addEventListener('input', function () { ui.chatDraft = input.value; });
    function paint(msgs) {
      var atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
      list.replaceChildren.apply(list, msgs.map(function (m) {
        var mine = m.user_id === me.id;
        return h('div', { class: 'flex gap-2 items-end' + (mine ? ' flex-row-reverse' : '') },
          avatar({ username: m.username, avatar_url: m.avatar_url }),
          h('div', { class: 'bubble' + (mine ? ' mine' : '') },
            h('div', { class: 'text-[10px] muted mb-0.5' }, m.username + ' · ' + new Date(m.created_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })),
            h('div', { text: m.content })));
      }));
      online.replaceChildren(h('span', { class: 'dot-online' }), ' ' + Data.onlineUsers(me) + ' online');
      if (atBottom) list.scrollTop = list.scrollHeight;
    }
    function refresh() { Data.getMessages().then(function (m) { if (ui.tab === 'chat' && list.isConnected) paint(m); }); }
    function send() {
      var t = Core.cleanText(input.value, CFG.CHAT_MAX_LENGTH);
      if (!t) return;
      if (Date.now() - lastSend < 1500) { toast('Zwolnij trochę.'); return; }
      lastSend = Date.now();
      input.value = ''; ui.chatDraft = '';
      Data.sendMessage(me, t).then(refresh);
      me.last_active = new Date().toISOString(); save();
    }
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
    setTimeout(function () { refresh(); list.scrollTop = list.scrollHeight; }, 0);
    chatTimer = setInterval(refresh, CFG.CHAT_POLL_MS);
    return h('div', { class: 'panel space-y-3' },
      h('div', { class: 'flex items-center justify-between' }, h('h2', { class: 'font-bold text-sm' }, icon('fa-comments'), ' Chat społeczności'), online),
      list,
      h('div', { class: 'flex gap-2' }, input, h('button', { type: 'button', class: 'btn', 'aria-label': 'Wyślij', onclick: send }, icon('fa-paper-plane'))));
  }

  /* ---------- BONUSES ---------- */
  function viewBonus() {
    var sub = { overview: bonusOverview, events: bonusEvents, tasks: bonusTasks, referral: bonusReferral, badges: bonusBadges }[ui.bonus]();
    return [subtabs(BONUS_SUBS, ui.bonus, function (s) { ui.bonus = s; render(); }), sub];
  }

  function stat(label, value) { return h('div', { class: 'panel text-center !p-3' }, h('div', { class: 'text-lg font-black text-white' }, String(value)), h('div', { class: 'text-[10px] muted' }, label)); }

  function claimRow(title, desc, msLeft, onClaim) {
    return h('div', { class: 'panel flex items-center gap-3' },
      h('div', { class: 'flex-1' }, h('div', { class: 'text-sm font-bold' }, title), h('div', { class: 'text-xs muted' }, desc)),
      msLeft > 0 ? countdown(Date.now() + msLeft, function () { if (ui.tab === 'bonus') render(); }) : h('button', { type: 'button', class: 'btn', onclick: onClaim }, 'Odbierz'));
  }

  function bonusOverview() {
    var p = Core.progress(me.xp_total), ctx = rankCtx();
    return [
      h('div', { class: 'panel space-y-3' },
        h('div', { class: 'flex items-center justify-between' }, h('span', { class: 'font-bold text-sm' }, levelBadge(me)), h('span', { class: 'text-xs muted' }, '#' + ctx.rank + ' w rankingu')),
        h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': String(p.percent), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('div', { style: 'width:' + p.percent + '%' })),
        h('div', { class: 'text-xs muted' }, p.next ? fmt(me.xp_total) + ' / ' + fmt(p.next.xp) + ' XP — do ' + p.next.name + ': ' + fmt(p.xpToNext) + ' XP' : 'Maksymalny poziom osiągnięty!')),
      h('div', { class: 'grid grid-cols-3 gap-2' }, stat('XP', fmt(me.xp_total)), stat('Gwiazdki ★', fmt(me.stars)), stat('Zadania', me.tasks_completed)),
      claimRow('Bonus XP co ' + CFG.XP_TIMER_HOURS + 'h', '+' + CFG.XP_TIMER_REWARD + ' XP', Core.msUntil(me.last_xp_claim, CFG.XP_TIMER_HOURS), function () {
        var r = Core.claimTimer(me); if (r.ok) { grantXp(0); save(); toast('+' + r.xp + ' XP'); render(); }
      }),
      claimRow('Codzienny bonus', '+' + CFG.DAILY_REWARD_XP + ' XP', Core.msUntil(me.last_daily, 24), function () {
        var r = Core.claimDaily(me); if (r.ok) { grantXp(0); save(); toast('+' + r.xp + ' XP'); render(); }
      }),
      h('div', { class: 'panel space-y-2' }, h('h3', { class: 'font-bold text-sm' }, 'Poziomy'),
        CFG.LEVELS.map(function (l) {
          return h('div', { class: 'flex items-center justify-between text-xs ' + (me.level >= l.level ? 'text-white' : 'muted') },
            h('span', {}, icon(l.icon, 'w-5 text-amber-300'), ' ' + l.level + '. ' + l.name), h('span', {}, fmt(l.xp) + ' XP'));
        }))
    ];
  }

  function bonusEvents() {
    return CFG.EVENTS.map(function (e) {
      return h('div', { class: 'panel space-y-2' },
        h('div', { class: 'flex items-center justify-between' }, h('h3', { class: 'font-bold text-sm' }, e.title),
          h('span', { class: 'text-[10px] font-bold px-2 py-0.5 rounded-full ' + (e.live ? 'bg-rose-600/30 text-rose-300' : 'bg-slate-700 text-slate-300') }, e.live ? 'LIVE' : 'WKRÓTCE')),
        h('p', { class: 'text-xs muted' }, e.desc), h('div', { class: 'text-xs text-amber-300 font-bold' }, 'Nagroda: ' + e.reward));
    });
  }

  function bonusTasks() {
    var ctx = rankCtx();
    return [h('p', { class: 'text-xs muted' }, 'Nagrody za zadania to gwiazdki ★. Ukończone zadania: ' + me.tasks_completed)].concat(CFG.TASKS.map(function (t) {
      var st = Core.taskStatus(me, t, claimed, ctx);
      return h('div', { class: 'panel space-y-2' },
        h('div', { class: 'flex items-center justify-between' }, h('span', { class: 'text-sm font-bold' }, t.title), h('span', { class: 'text-xs text-amber-300 font-bold' }, '+' + t.rewardStars + ' ★')),
        h('div', { class: 'bar' }, h('div', { style: 'width:' + Math.round(st.value / st.goal * 100) + '%' })),
        h('div', { class: 'flex items-center justify-between' }, h('span', { class: 'text-xs muted' }, st.value + ' / ' + st.goal),
          h('button', { type: 'button', class: 'btn', disabled: !st.completable, onclick: function () {
            var r = Core.claimTask(me, t, claimed, ctx);
            if (r.ok) { grantXp(0); save(); toast('+' + t.rewardStars + ' ★'); render(); }
          } }, st.done ? 'Odebrano' : 'Odbierz')));
    }));
  }

  function bonusReferral() {
    var link = Core.referralLink(me.id, SEC.BOT_USERNAME);
    var earned = CFG.REFERRAL_MILESTONES.filter(function (m) { return me.referral_claimed.indexOf(m.count) !== -1; }).reduce(function (s, m) { return s + m.rewardXp; }, 0);
    var nodes = [
      h('div', { class: 'panel space-y-2' }, h('h3', { class: 'font-bold text-sm' }, 'Twój link polecający'),
        h('input', { class: 'field', readonly: true, value: link, 'aria-label': 'Link polecający' }),
        h('div', { class: 'flex gap-2' },
          h('button', { type: 'button', class: 'btn flex-1', onclick: function () {
            (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { toast('Skopiowano link.'); }, function () { toast('Skopiuj link ręcznie.'); });
          } }, icon('fa-copy'), ' Kopiuj'),
          h('button', { type: 'button', class: 'btn btn-ghost flex-1', onclick: function () {
            var share = 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent('Dołącz do TechnixPro!');
            if (tg && tg.openTelegramLink) tg.openTelegramLink(share); else window.open(share, '_blank', 'noopener');
          } }, icon('fa-share'), ' Udostępnij')),
        h('div', { class: 'text-xs muted' }, 'Kod: ' + me.referral_code)),
      h('div', { class: 'grid grid-cols-2 gap-2' }, stat('Zaproszeni', me.referral_count), stat('Zarobione XP', earned)),
      h('div', { class: 'panel space-y-2' }, h('h3', { class: 'font-bold text-sm' }, 'Nagrody'),
        CFG.REFERRAL_MILESTONES.map(function (m) {
          var done = me.referral_claimed.indexOf(m.count) !== -1;
          return h('div', { class: 'flex justify-between text-xs ' + (done ? 'text-emerald-400' : '') },
            h('span', {}, icon(done ? 'fa-circle-check' : 'fa-circle', 'mr-1'), 'Zaproś ' + m.count + ' osób (' + Math.min(me.referral_count, m.count) + '/' + m.count + ')'), h('b', {}, '+' + fmt(m.rewardXp) + ' XP'));
        }))
    ];
    if (!identity.telegram) {
      nodes.push(h('button', { type: 'button', class: 'btn btn-ghost w-full', onclick: function () { me.referral_count += 1; grantXp(0); save(); render(); } }, 'Symuluj polecenie (tryb demo)'));
    }
    return nodes;
  }

  function bonusBadges() {
    var list = Core.achievements(me, rankCtx());
    return [h('p', { class: 'text-xs muted' }, list.filter(function (a) { return a.unlocked; }).length + ' / ' + list.length + ' odznak'),
      h('div', { class: 'grid grid-cols-3 gap-2' }, list.map(function (a) {
        return h('div', { class: 'badge-item' + (a.unlocked ? '' : ' locked') }, icon(a.icon, 'text-xl text-amber-300 block mb-1'), a.title);
      }))];
  }

  /* ---------- PROFILE ---------- */
  function viewProfile() {
    var sub = { info: profileInfo, wallet: profileWallet, settings: profileSettings }[ui.profile]();
    return [subtabs(PROFILE_SUBS, ui.profile, function (s) { ui.profile = s; render(); }), sub];
  }

  function row(label, value) { return h('div', { class: 'flex justify-between text-xs py-1.5 border-b border-slate-800/70' }, h('span', { class: 'muted' }, label), h('span', { class: 'font-semibold text-right break-all' }, value)); }

  function profileInfo() {
    var file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'hidden', 'aria-label': 'Wybierz avatar', onchange: function () { uploadAvatar(file.files[0]); } });
    return [h('div', { class: 'panel flex flex-col items-center gap-3' },
      avatar(me, 84), file,
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { file.click(); } }, icon('fa-camera'), ' Zmień avatar'),
      h('div', { class: 'text-lg font-black' }, me.username), h('div', { class: 'text-sm text-violet-300 font-bold' }, levelBadge(me))),
      h('div', { class: 'panel' },
        row('Telegram ID', String(me.id) + (identity.telegram ? '' : ' (tryb lokalny)')), row('Username', '@' + me.username),
        row('Dołączono', fmtDate(me.created_at)), row('Łączne XP', fmt(me.xp_total)), row('Gwiazdki', fmt(me.stars) + ' ★'))];
  }

  function uploadAvatar(f) {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { toast('Dozwolone: PNG, JPEG, WebP.'); return; }
    if (f.size > CFG.AVATAR_MAX_BYTES) { toast('Plik za duży (max 2 MB).'); return; }
    var url = URL.createObjectURL(f), img = new Image();
    img.onload = function () {
      var s = 128, c = document.createElement('canvas'); c.width = c.height = s;
      var m = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
      URL.revokeObjectURL(url);
      me.avatar_url = c.toDataURL('image/jpeg', 0.85); me.avatar_custom = true; save(); toast('Avatar zaktualizowany.'); render();
    };
    img.onerror = function () { URL.revokeObjectURL(url); toast('Nie udało się wczytać obrazu.'); };
    img.src = url;
  }

  function profileWallet() {
    var amount = h('input', { class: 'field', type: 'number', min: '0', step: 'any', inputmode: 'decimal', placeholder: 'Kwota (TON)' });
    var tx = Data.transactions(me.id);
    function op(type) {
      var v = Core.validateAmount(amount.value, type === 'withdraw' ? me.wallet_balance : null);
      if (!v.ok) { toast(v.error); return; }
      if (type === 'withdraw') {
        if (!me.ton_keeper_connected) { toast('Najpierw połącz TON Keeper.'); return; }
        me.wallet_balance = Math.round((me.wallet_balance - v.value) * 1e9) / 1e9;
      }
      Data.addTransaction(me.id, { type: type, amount: v.value, status: 'pending' });
      save(); toast('Zlecenie zapisane (oczekuje na potwierdzenie).'); render();
    }
    return [
      h('div', { class: 'panel text-center space-y-1' }, h('div', { class: 'text-xs muted' }, 'Saldo'), h('div', { class: 'text-3xl font-black text-white' }, fmt(me.wallet_balance) + ' TON')),
      h('div', { class: 'panel space-y-2' },
        h('div', { class: 'flex items-center justify-between' }, h('span', { class: 'text-sm font-bold' }, icon('fa-wallet'), ' TON Keeper'), h('span', { class: 'text-xs ' + (me.ton_keeper_connected ? 'text-emerald-400' : 'muted') }, me.ton_keeper_connected ? 'Połączono' : 'Niepołączono')),
        h('button', { type: 'button', class: 'btn w-full', disabled: !CFG.FEATURES.tonKeeper, onclick: function () {
          if (me.ton_keeper_connected) { me.ton_keeper_connected = false; save(); render(); return; }
          if (tg && tg.openLink) tg.openLink('https://app.tonkeeper.com/'); else window.open('https://app.tonkeeper.com/', '_blank', 'noopener');
          me.ton_keeper_connected = true; save(); toast('Połączono (demo — brak weryfikacji TON Connect).'); render();
        } }, me.ton_keeper_connected ? 'Rozłącz' : 'Połącz TON Keeper')),
      h('div', { class: 'panel space-y-2' }, amount, h('div', { class: 'flex gap-2' },
        h('button', { type: 'button', class: 'btn flex-1', onclick: function () { op('deposit'); } }, 'Wpłać'),
        h('button', { type: 'button', class: 'btn btn-ghost flex-1', onclick: function () { op('withdraw'); } }, 'Wypłać'))),
      h('div', { class: 'panel space-y-1' }, h('h3', { class: 'font-bold text-sm mb-1' }, 'Historia transakcji'),
        tx.length ? tx.map(function (t) { return row((t.type === 'deposit' ? 'Wpłata' : 'Wypłata') + ' · ' + fmtDate(t.created_at), fmt(t.amount) + ' TON (' + t.status + ')'); }) : h('div', { class: 'text-xs muted' }, 'Brak transakcji.'))
    ];
  }

  function toggle(label, get, set) {
    var cb = h('input', { type: 'checkbox', class: 'w-4 h-4 accent-violet-500', onchange: function () { set(cb.checked); save(); toast('Zapisano.'); } });
    cb.checked = !!get();
    return h('label', { class: 'flex items-center justify-between text-sm py-2' }, label, cb);
  }

  function profileSettings() {
    var s = me.settings, body;
    if (ui.settings === 'account') {
      body = h('div', {}, row('Username', '@' + me.username), row('Telegram ID', String(me.id)), row('Kod polecający', me.referral_code),
        h('button', { type: 'button', class: 'btn btn-danger w-full mt-3', onclick: function () {
          if (!confirm('Zresetować lokalne dane (XP, zadania, portfel)?')) return;
          Object.keys(localStorage).filter(function (k) { return k.indexOf(CFG.STORAGE_PREFIX + ':') === 0 && /:(user|claimed|tx):/.test(k); }).forEach(function (k) { localStorage.removeItem(k); });
          location.reload();
        } }, 'Resetuj dane lokalne'));
    } else if (ui.settings === 'notifications') {
      body = h('div', {}, toggle('Nowe posty', function () { return s.notifications.posts; }, function (v) { s.notifications.posts = v; }),
        toggle('Wiadomości czatu', function () { return s.notifications.chat; }, function (v) { s.notifications.chat = v; }),
        toggle('Nagrody i zadania', function () { return s.notifications.rewards; }, function (v) { s.notifications.rewards = v; }));
    } else if (ui.settings === 'privacy') {
      body = h('div', {}, toggle('Pokazuj status online', function () { return s.privacy.show_online; }, function (v) { s.privacy.show_online = v; }),
        toggle('Pokazuj mnie w rankingu', function () { return s.privacy.show_in_ranking; }, function (v) { s.privacy.show_in_ranking = v; }));
    } else {
      var sel = h('select', { class: 'field', 'aria-label': 'Język', onchange: function () { s.language = sel.value; save(); render(); } },
        h('option', { value: 'pl' }, 'Polski'), h('option', { value: 'en' }, 'English'));
      sel.value = s.language;
      body = h('div', {}, sel);
    }
    return [subtabs(SETTINGS_SUBS, ui.settings, function (x) { ui.settings = x; render(); }), h('div', { class: 'panel' }, body)];
  }

  /* ---------- boot ---------- */
  if (identity.telegram && tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param && !me.referred_by) {
    var refId = Core.parseReferralCode(String(tg.initDataUnsafe.start_param).replace(/^ref_/, ''));
    if (refId && refId !== me.id) { me.referred_by = refId; save(); }
  }
  grantXp(0); save();
  Data.subscribeStorage(function (key) { if (key === 'posts' && ui.tab === 'channel') render(); });
  render();
})();
