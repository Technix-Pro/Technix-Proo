(function () {
  'use strict';
  var CFG = window.TP_CONFIG, SEC = window.TECHNIX_CONFIG || {}, Core = window.TPCore, Data = window.TPData, TPRig = window.TPRig, Admin = window.TPAdmin;
  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  if (tg) { try { tg.ready(); tg.expand(); } catch (e) { /* ignore */ } }

  var I18N = {
    pl: { channel: 'Kanał', chat: 'Chat', bonus: 'Bonusy', rig: 'Warsztat', profile: 'Profil', home: 'Home', technix: 'TechnixPro', wallet: 'Wallet', admin: 'Panel administratora', clicks: 'Kliknięcia', notifications: 'Powiadomienia', dismiss: 'Zamknij' },
    en: { channel: 'Channel', chat: 'Chat', bonus: 'Bonuses', rig: 'Workshop', profile: 'Profile', home: 'Home', technix: 'TechnixPro', wallet: 'Wallet', admin: 'Admin panel', clicks: 'Clicks', notifications: 'Notifications', dismiss: 'Dismiss' }
  };
  // Bottom nav: Home, TechnixPro (bonuses), Workshop (middle), Wallet, Profile. Chat lives in the header; the full Bonusy section is reachable from TechnixPro.
  var NAV = [
    { id: 'home', tab: 'channel', icon: 'fa-house' },
    { id: 'technix', tab: 'bonus', sub: 'overview', icon: 'fa-gamepad', feature: 'bonus' },
    { id: 'rig', tab: 'rig', icon: 'fa-computer', feature: 'rig' },
    { id: 'wallet', tab: 'profile', sub: 'wallet', icon: 'fa-wallet', feature: 'wallet' },
    { id: 'profile', tab: 'profile', sub: 'info', icon: 'fa-user' }
  ];
  var TAB_FEATURE = { chat: 'chat', bonus: 'bonus', rig: 'rig' };
  var BONUS_SUBS = [['overview', 'Przegląd'], ['events', 'Live'], ['tasks', 'Zadania'], ['referral', 'Polecenia'], ['badges', 'Odznaki'], ['community', 'Razem']];
  var PROFILE_SUBS = [['info', 'Profil'], ['wallet', 'Portfel'], ['settings', 'Ustawienia']];
  var SETTINGS_SUBS = [['account', 'Konto'], ['notifications', 'Powiadomienia'], ['privacy', 'Prywatność'], ['language', 'Język']];

  var identity = resolveIdentity();
  var me = Data.loadUser(identity.user);
  var claimed = Data.claimed(me.id);
  var ui = { tab: 'channel', adminOpen: false, bonus: 'overview', profile: 'info', settings: 'account', preview: false, openComments: {}, chatDraft: '' };
  var content = document.getElementById('app-content');
  var chatTimer = null, lastSend = 0, pendingRigPart = null, clickSaveTimer = null, lastClickAt = 0, lastNotifCount = 0;
  var admin = null, engage = null;

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
    return Data.isAdmin(me.id) || (!!SEC.DEV_MODE && isLocal() && /[?&]admin=1/.test(location.search));
  }
  function adminView() { return isAdmin() && !ui.preview; }
  function visible(feature) { return Admin.featureVisible(Data.getAdminState(), feature, adminView()); }
  function cfg() { return Admin.effectiveConfig(Data.getAdminState()); }
  function activeTasks() { var s = Data.getAdminState(); return (s.tasks || CFG.TASKS).filter(function (t) { return t.enabled !== false; }); }
  function activeEvents() { return Data.getAdminState().events || CFG.EVENTS; }
  function applyConfig() {
    var c = cfg(), reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.style.setProperty('--tp-anim-speed', reduce ? '0' : String(1 / c.animationSpeed));
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
    var gained = Core.claimReferralMilestones(me, cfg().milestones);
    gained.forEach(function (m) { toast('Nagroda za ' + m.count + ' poleconych: +' + m.rewardXp + ' XP'); });
    if (gained.length) Data.action('tp_claim_referrals');
    if (me.level > before) { toast('Nowy poziom: ' + Core.levelFor(me.xp_total).name + '!'); if (window.TPEffects) window.TPEffects.celebrate('milestone', document.getElementById('header-level')); }
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
    var adminBtn = document.getElementById('header-admin');
    adminBtn.classList.toggle('hidden', !isAdmin());
    adminBtn.setAttribute('aria-label', tr('admin'));
    adminBtn.onclick = function () { if (isAdmin()) admin.open(); };
    var chatBtn = document.getElementById('header-chat');
    chatBtn.classList.toggle('hidden', !visible('chat'));
    chatBtn.setAttribute('aria-label', tr('chat'));
    chatBtn.onclick = function () { setTab('chat'); };
    var clickBtn = document.getElementById('header-clicker');
    clickBtn.classList.toggle('hidden', !visible('bonus'));
    clickBtn.setAttribute('aria-label', tr('clicks'));
    clickBtn.replaceChildren(h('span', { 'aria-hidden': 'true' }, '🖱️'), ' ' + fmt(me.clicks || 0));
    clickBtn.onclick = onClick;
    var nav = document.getElementById('bottom-nav');
    var items = NAV.filter(function (n) { return !n.feature || visible(n.feature); });
    nav.style.gridTemplateColumns = 'repeat(' + items.length + ', minmax(0, 1fr))';
    nav.replaceChildren.apply(nav, items.map(function (n) {
      var active = ui.tab === n.tab && (n.tab !== 'profile' || (n.sub === 'wallet') === (ui.profile === 'wallet'));
      return h('button', { class: 'nav-btn' + (active ? ' active' : ''), type: 'button', 'aria-current': active ? 'page' : null, onclick: function () { if (n.tab === 'bonus') ui.bonus = n.sub; if (n.tab === 'profile') ui.profile = n.sub; setTab(n.tab); } }, icon(n.icon), tr(n.id));
    }));
  }

  /* ---------- clicker ---------- */
  function onClick() {
    if (!visible('bonus')) return;
    var now = Date.now();
    if (now - lastClickAt < 100) return;
    lastClickAt = now;
    if (!engage.allowAction()) return;
    var prev = me.clicks || 0, c = cfg();
    me.clicks = prev + 1;
    var r = Admin.clickReward(prev, me.clicks, c.clicks);
    if (r.xp) { grantXp(Admin.scaleXp(r.xp, c.xpMultiplier)); toast('+' + Admin.scaleXp(r.xp, c.xpMultiplier) + ' XP'); }
    if (r.lootbox) { lootBox(); }
    if (r.achievement) toast('🏆 ' + fmt(me.clicks) + ' ' + tr('clicks'));
    var btn = document.getElementById('header-clicker');
    btn.replaceChildren(h('span', { 'aria-hidden': 'true' }, '🖱️'), ' ' + fmt(me.clicks));
    document.getElementById('header-sub').textContent = 'ID: ' + me.id + ' · ' + fmt(me.xp_total) + ' XP';
    clearTimeout(clickSaveTimer);
    clickSaveTimer = setTimeout(save, 800);
    if (r.xp || r.lootbox) renderShell();
  }
  function lootBox() {
    var el = h('div', { class: 'lootbox', 'aria-hidden': 'true' }, '🎁');
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1400);
  }

  function setTab(t) { ui.tab = t; render(); window.scrollTo(0, 0); }

  function tabAllowed(t) { return !TAB_FEATURE[t] || visible(TAB_FEATURE[t]); }

  function subtabs(list, current, onPick) {
    return h('div', { class: 'subtabs', role: 'tablist' }, list.map(function (s) {
      return h('button', { type: 'button', role: 'tab', class: 'subtab' + (current === s[0] ? ' active' : ''), onclick: function () { onPick(s[0]); } }, s[1]);
    }));
  }

  function render() {
    clearInterval(chatTimer); chatTimer = null;
    applyConfig();
    if (!tabAllowed(ui.tab)) ui.tab = 'channel';
    if (ui.profile === 'wallet' && !visible('wallet')) ui.profile = 'info';
    renderShell();
    var view = { channel: viewChannel, chat: viewChat, bonus: viewBonus, rig: viewRig, profile: viewProfile }[ui.tab]();
    var notes = engage && ui.tab !== 'bonus' ? engage.banners() : [];
    content.replaceChildren(h('section', { class: 'screen space-y-4' }, notes, view));
    if (engage) engage.afterRender();
    if (ui.tab === 'rig') {
      var rig = content.querySelector('[data-rig-builder]');
      if (rig) window.TPRig.mount(rig.querySelector('svg'), Data.rigParts(me.id), pendingRigPart, rig._onRigStep);
      pendingRigPart = null;
    }
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
    var asAdmin = adminView(), now = Date.now();
    return Data.getPosts().filter(function (p) { return Admin.postVisible(p, asAdmin, now); })
      .sort(function (a, b) { return Date.parse(b.created_at) - Date.parse(a.created_at); });
  }

  /* ---------- SOCIAL ---------- */
  var SOCIALS = [
    { key: 'x', label: 'X', cls: 'fa-brands fa-x-twitter' }, { key: 'facebook', label: 'Facebook', cls: 'fa-brands fa-facebook' },
    { key: 'instagram', label: 'Instagram', cls: 'fa-brands fa-instagram' }, { key: 'telegram', label: 'Telegram', cls: 'fa-brands fa-telegram' },
    { key: 'discord', label: 'Discord', cls: 'fa-brands fa-discord' }, { key: 'youtube', label: 'YouTube', cls: 'fa-brands fa-youtube' },
    { key: 'tiktok', label: 'TikTok', cls: 'fa-brands fa-tiktok' }, { key: 'website', label: 'Oficjalna strona', cls: 'fa-solid fa-globe' }
  ];

  function openSocial(key) {
    var url = Core.safeUrl(Admin.resolveSocialLinks(Data.getAdminState())[key] || '');
    if (!url) { toast('Link wkrótce'); return; }
    try {
      if (tg && /^https:\/\/t\.me\//i.test(url) && tg.openTelegramLink) tg.openTelegramLink(url);
      else if (tg && tg.openLink) tg.openLink(url);
      else window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) { window.open(url, '_blank', 'noopener,noreferrer'); }
  }

  function socialPanel() {
    return h('div', { class: 'panel space-y-2', role: 'group', 'aria-label': 'Społeczność' },
      h('h2', { class: 'font-bold text-sm' }, icon('fa-users'), ' Społeczność'),
      h('div', { class: 'grid grid-cols-4 gap-2' }, SOCIALS.map(function (x) {
        return h('button', { type: 'button', class: 'btn btn-ghost', style: 'min-width:44px;min-height:44px;justify-content:center', 'aria-label': x.label, title: x.label, onclick: function () { openSocial(x.key); } },
          h('i', { class: x.cls, 'aria-hidden': 'true' }));
      })));
  }

  function viewChannel() {
    var out = [];
    if (isAdmin()) out.push(adminPanel());
    pendingNotifications().forEach(function (n) { out.push(notificationCard(n)); });
    var posts = visiblePosts();
    if (!posts.length) out.push(h('div', { class: 'panel text-sm muted text-center' }, 'Brak postów. ' + (isAdmin() ? 'Dodaj pierwszy powyżej.' : 'Wróć wkrótce!')));
    posts.forEach(function (p) { out.push(postCard(p)); });
    engage.homeExtras().forEach(function (n) { if (n) out.push(n); });
    out.push(socialPanel());
    return out;
  }

  function adminPanel() {
    var wrap = h('div', { class: 'panel space-y-3 border-amber-500/40' });
    wrap.appendChild(h('div', { class: 'flex items-center justify-between' },
      h('h2', { class: 'font-bold text-amber-300 text-sm' }, icon('fa-shield-halved'), ' Panel administratora'),
      h('div', { class: 'flex gap-2' },
        h('button', { type: 'button', class: 'btn', onclick: function () { admin.open(); } }, icon('fa-sliders'), ' ' + tr('admin')),
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { ui.preview = !ui.preview; render(); } }, ui.preview ? 'Wróć do panelu' : 'Podgląd użytkownika'))));
    if (ui.preview) { wrap.appendChild(h('p', { class: 'text-xs muted' }, 'Tryb podglądu: widzisz tylko opublikowane posty tak jak użytkownicy.')); return wrap; }
    var nextClaim = Date.now() + Core.msUntil(me.last_xp_claim, cfg().xpTimerHours);
    wrap.appendChild(h('div', { class: 'text-xs flex justify-between' }, h('span', { class: 'muted' }, 'Timer XP (' + cfg().xpTimerHours + 'h)'),
      Core.msUntil(me.last_xp_claim, cfg().xpTimerHours) > 0 ? countdown(nextClaim) : h('span', { class: 'text-emerald-400 font-bold' }, 'Gotowy do odbioru')));
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

  function pendingNotifications() {
    return Admin.pendingNotifications(Data.getList('notifications'), Data.getList('seen:' + me.id), Date.now());
  }

  function notificationCard(n) {
    return h('div', { class: 'panel space-y-1 border-cyan-500/40', role: 'alert' },
      h('div', { class: 'flex items-center justify-between gap-2' }, h('b', { class: 'text-sm text-cyan-300', text: n.title }),
        h('button', { type: 'button', class: 'btn btn-ghost', 'aria-label': tr('dismiss'), onclick: function () {
          Data.saveList('seen:' + me.id, [n.id].concat(Data.getList('seen:' + me.id)), 200);
          Data.saveList('notifications', Data.getList('notifications').map(function (x) { return x.id === n.id ? Object.assign({}, x, { delivered_count: (x.delivered_count || 0) + 1 }) : x; }), 100);
          render();
        } }, icon('fa-xmark'))),
      h('p', { class: 'text-xs break-words', text: n.message }),
      n.link && Core.safeUrl(n.link) ? h('a', { class: 'btn inline-block', href: n.link, target: '_blank', rel: 'noopener noreferrer' }, 'Otwórz') : null);
  }

  function postCard(p) {
    var admin = adminView();
    var card = h('article', { class: 'panel space-y-3' });
    card.appendChild(h('div', { class: 'flex items-center justify-between text-xs' },
      h('span', { class: 'font-bold text-cyan-300' }, 'TechnixPro'),
      h('span', { class: 'muted' }, (p.published ? '' : p.scheduled_at && Admin.postVisible(p, false) ? '' : p.scheduled_at ? '[ZAPLANOWANY] ' : '[SZKIC] ') + fmtDate(p.created_at))));
    var sponsored = engage.sponsorNote(p, card);
    if (sponsored) card.appendChild(sponsored);
    if (p.content) card.appendChild(h('p', { class: 'text-sm whitespace-pre-wrap break-words', text: p.content }));
    (p.images || []).forEach(function (u) { if (Admin.safeImage(u)) card.appendChild(h('img', { class: 'post-media', src: u, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' })); });
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
      row.appendChild(h('button', { type: 'button', class: 'btn btn-danger', 'aria-label': 'Usuń post', onclick: function () { if (!isAdmin() || !confirm('Usunąć post? (trafi do kosza)')) return;
        var tr_ = Admin.trashPost(Data.getPosts(), Data.getList('trash'), p.id, me.id, new Date().toISOString(), Data.newId());
        if (tr_.ok) { Data.savePosts(tr_.posts); Data.saveList('trash', tr_.trash, 100); Data.audit(me.id, 'post.delete', 'post', p.id); }
        render(); } }, icon('fa-trash')));
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
    var sub = { overview: bonusOverview, events: bonusEvents, tasks: bonusTasks, referral: bonusReferral, badges: bonusBadges, community: function () { return engage.communityView(); } }[ui.bonus]();
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
      claimRow('Bonus XP co ' + cfg().xpTimerHours + 'h', '+' + Admin.scaleXp(cfg().xpTimerReward, cfg().xpMultiplier) + ' XP', Core.msUntil(me.last_xp_claim, cfg().xpTimerHours), function () {
        var r = Core.claimTimer(me, null, { hours: cfg().xpTimerHours, reward: Admin.scaleXp(cfg().xpTimerReward, cfg().xpMultiplier) }); if (r.ok) { grantXp(0); save(); Data.action('tp_claim_timer'); toast('+' + r.xp + ' XP'); render(); }
      }),
      claimRow('Codzienny bonus', '+' + Admin.scaleXp(cfg().dailyReward, cfg().xpMultiplier) + ' XP', Core.msUntil(me.last_daily, 24), function () {
        var r = Core.claimDaily(me, null, { reward: Admin.scaleXp(cfg().dailyReward, cfg().xpMultiplier) }); if (r.ok) { grantXp(0); save(); Data.action('tp_claim_daily'); toast('+' + r.xp + ' XP'); render(); }
      }),
      h('div', { class: 'panel space-y-2' }, h('h3', { class: 'font-bold text-sm' }, 'Poziomy'),
        CFG.LEVELS.map(function (l) {
          return h('div', { class: 'flex items-center justify-between text-xs ' + (me.level >= l.level ? 'text-white' : 'muted') },
            h('span', {}, icon(l.icon, 'w-5 text-amber-300'), ' ' + l.level + '. ' + l.name), h('span', {}, fmt(l.xp) + ' XP'));
        }))
    ];
  }

  function bonusEvents() {
    return activeEvents().map(function (e) {
      return h('div', { class: 'panel space-y-2' },
        h('div', { class: 'flex items-center justify-between' }, h('h3', { class: 'font-bold text-sm' }, e.title),
          h('span', { class: 'text-[10px] font-bold px-2 py-0.5 rounded-full ' + (e.live ? 'bg-rose-600/30 text-rose-300' : 'bg-slate-700 text-slate-300') }, e.live ? 'LIVE' : 'WKRÓTCE')),
        h('p', { class: 'text-xs muted' }, e.desc), e.starts_at || e.ends_at ? h('div', { class: 'text-[11px] muted' }, (e.starts_at ? fmtDate(e.starts_at) : '') + ' → ' + (e.ends_at ? fmtDate(e.ends_at) : '')) : null, h('div', { class: 'text-xs text-amber-300 font-bold' }, 'Nagroda: ' + e.reward));
    });
  }

  function bonusTasks() {
    var ctx = rankCtx();
    return [h('p', { class: 'text-xs muted' }, 'Nagrody za zadania to gwiazdki ★. Ukończone zadania: ' + me.tasks_completed)].concat(activeTasks().map(function (t) {
      var st = Core.taskStatus(me, t, claimed, ctx);
      return h('div', { class: 'panel space-y-2' },
        h('div', { class: 'flex items-center justify-between' }, h('span', { class: 'text-sm font-bold' }, t.title), h('span', { class: 'text-xs text-amber-300 font-bold' }, '+' + (t.rewardStars || 0) + ' ★' + (t.rewardXp ? ' +' + t.rewardXp + ' XP' : ''))),
        h('div', { class: 'bar' }, h('div', { style: 'width:' + Math.round(st.value / st.goal * 100) + '%' })),
        h('div', { class: 'flex items-center justify-between' }, h('span', { class: 'text-xs muted' }, st.value + ' / ' + st.goal),
          h('button', { type: 'button', class: 'btn', disabled: !st.completable, onclick: function () {
            var r = Core.claimTask(me, Object.assign({}, t, { rewardXp: Admin.scaleXp(t.rewardXp, cfg().xpMultiplier), rewardStars: t.rewardStars || 0 }), claimed, ctx);
            if (r.ok) { Data.recordTaskCompletion(t.id); grantXp(0); save(); Data.action('tp_claim_task', { p_task_id: t.id }); toast('+' + (t.rewardStars || 0) + ' ★' + (t.rewardXp ? ' +' + Admin.scaleXp(t.rewardXp, cfg().xpMultiplier) + ' XP' : '')); render(); }
          } }, st.done ? 'Odebrano' : 'Odbierz')));
    }));
  }

  function bonusReferral() {
    var link = Core.referralLink(me.id, SEC.BOT_USERNAME);
    var earned = cfg().milestones.filter(function (m) { return me.referral_claimed.indexOf(m.count) !== -1; }).reduce(function (s, m) { return s + m.rewardXp; }, 0);
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
        cfg().milestones.map(function (m) {
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

  /* ---------- RIG BUILDER ---------- */
  function svgNode(tag, attrs, children) {
      var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.keys(attrs || {}).forEach(function (key) { el.setAttribute(key, attrs[key]); });
      (children || []).forEach(function (child) { el.appendChild(child); });
      return el;
  }

  function rigPart(key, owned, children) {
      return svgNode('g', {
        'data-part': key,
        'aria-label': CFG.RIG_PARTS.filter(function (part) { return part.key === key; })[0].title,
        'class': 'rig-part ' + (owned.indexOf(key) !== -1 ? 'rig-owned rig-mounted' : 'rig-locked')
      }, children);
  }

  function buildRigSvg(owned) {
      var svg = svgNode('svg', { viewBox: '0 0 360 270', role: 'img', 'aria-label': 'Schemat stanowiska komputerowego', class: 'rig-canvas' });
      svg.appendChild(svgNode('rect', { x: 0, y: 0, width: 360, height: 270, rx: 18, class: 'rig-background' }));
      svg.appendChild(rigPart('desk', owned, [
        svgNode('rect', { x: 38, y: 193, width: 284, height: 13, rx: 5, class: 'rig-wood' }),
        svgNode('path', { d: 'M57 206v41M303 206v41', class: 'rig-desk-leg' })
      ]));
      svg.appendChild(rigPart('case', owned, [
        svgNode('rect', { x: 226, y: 104, width: 72, height: 89, rx: 8, class: 'rig-case' }),
        svgNode('rect', { x: 234, y: 113, width: 56, height: 71, rx: 5, class: 'rig-case-inner' }),
        svgNode('circle', { cx: 262, cy: 145, r: 17, class: 'rig-fan' }),
        svgNode('circle', { cx: 262, cy: 145, r: 8, class: 'rig-fan-center' }),
        svgNode('circle', { cx: 285, cy: 119, r: 2, class: 'rig-led' })
      ]));
      svg.appendChild(rigPart('ram', owned, [
        svgNode('rect', { x: 246, y: 119, width: 6, height: 23, rx: 2, class: 'rig-ram' }),
        svgNode('rect', { x: 255, y: 119, width: 6, height: 23, rx: 2, class: 'rig-ram' }),
        svgNode('path', { d: 'M247 138h4m5 0h4', class: 'rig-pin' })
      ]));
      svg.appendChild(rigPart('gpu', owned, [
        svgNode('rect', { x: 239, y: 155, width: 45, height: 9, rx: 3, class: 'rig-gpu' }),
        svgNode('circle', { cx: 250, cy: 159, r: 3, class: 'rig-gpu-fan' }),
        svgNode('circle', { cx: 273, cy: 159, r: 3, class: 'rig-gpu-fan' })
      ]));
      svg.appendChild(rigPart('monitor', owned, [
        svgNode('rect', { x: 94, y: 45, width: 132, height: 88, rx: 8, class: 'rig-monitor' }),
        svgNode('rect', { x: 101, y: 52, width: 118, height: 74, rx: 4, class: 'rig-screen' }),
        svgNode('path', { d: 'M160 133v20m-24 6h48l-5-6h-38z', class: 'rig-monitor-stand' }),
        svgNode('path', { d: 'M111 101l23-22 18 15 19-20 34 32', class: 'rig-screen-line' })
      ]));
      svg.appendChild(rigPart('keyboard', owned, [
        svgNode('rect', { x: 106, y: 168, width: 100, height: 19, rx: 5, class: 'rig-keyboard' }),
        svgNode('path', { d: 'M116 174h80m-76 5h72', class: 'rig-key-lines' })
      ]));
      svg.appendChild(rigPart('mouse', owned, [
        svgNode('path', { d: 'M217 168c-8 0-13 6-13 14v3c0 8 5 13 13 13s13-5 13-13v-3c0-8-5-14-13-14z', class: 'rig-mouse' }),
        svgNode('path', { d: 'M217 169v10', class: 'rig-mouse-line' })
      ]));
      return svg;
  }

  var payingParts = {};
  function payRigPartWithStars(part) {
    var P = window.TPPayments;
    if (!P || !CFG.PAYMENTS_ENABLED || payingParts[part.key]) { toast('Płatności są niedostępne.'); return; }
    payingParts[part.key] = true; render();
    function done() { delete payingParts[part.key]; render(); }
    P.sendStarsInvoice(me.id, part.stars, part.title, 'RIG: ' + part.title, part.key).then(function (res) {
      if (!res.ok) {
        done();
        toast(res.queued ? 'Brak sieci — ponowimy przy następnym uruchomieniu.' : 'Błąd płatności: ' + res.error + ' (kliknij Kup, aby ponowić)');
        return;
      }
      console.log('Invoice ID:', res.invoice_id);
      P.trackInvoice(res.invoice_id, {
        onPaid: function () {
          var r = Data.buyRigPart(me, part.key);
          if (!r.ok && r.reason === 'insufficient_stars') r = Data.grantRigPart(me, part.key);
          if (r.ok) { pendingRigPart = part.key; save(); toast('Zapłacono: ' + part.title); if (window.TPEffects) window.TPEffects.celebrate('levelup', document.getElementById('header-level')); }
          done();
        },
        onCancel: function () { toast('Płatność anulowana.'); done(); }
      });
      if (res.invoice_link && P.openInvoice(res.invoice_link)) return;
      toast('Faktura wysłana do Telegrama, zatwierdź w czacie.');
    });
  }

  function viewRig() {
      var catalog = Data.rigPartsCatalog(), owned = Data.rigParts(me.id), status = TPRig.progress(owned);
      var allMounted = status.count === status.total;
      var stepLabel = h('p', { class: 'rig-step text-xs muted', 'aria-live': 'polite' },
        allMounted ? 'System uruchomiony' : owned.length + '/7 części zamontowane');
      var canvas = h('div', { class: 'rig-canvas-wrap' }, buildRigSvg(owned));
      var assembly = h('section', { class: 'panel rig-panel space-y-3' + (allMounted ? ' rig-running' : ''), 'data-rig-builder': '' },
        h('div', { class: 'flex items-center justify-between gap-2' },
          h('div', {}, h('h2', { class: 'font-bold text-sm' }, icon('fa-computer', 'text-cyan-300'), ' Stanowisko RIG'), stepLabel),
          h('button', { type: 'button', class: 'btn btn-ghost rig-replay', onclick: function () {
            stepLabel.textContent = 'Przygotowanie montażu…';
            TPRig.replay(canvas.querySelector('svg'), catalog.filter(function (part) { return owned.indexOf(part.key) !== -1; }).map(function (part) { return part.key; }), function (key, index, total) {
              stepLabel.textContent = key ? 'Montowanie: ' + catalog.filter(function (part) { return part.key === key; })[0].title : (allMounted ? 'System uruchomiony' : 'Montaż zakończony');
            });
          } }, icon('fa-rotate-right'), ' Powtórz')),
        h('div', { class: 'bar', role: 'progressbar', 'aria-label': 'Postęp składania', 'aria-valuenow': String(status.percent), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('div', { style: 'width:' + status.percent + '%' })),
        canvas);
      assembly._onRigStep = function (key, index, total) {
        stepLabel.textContent = 'Zamontowano: ' + catalog.filter(function (part) { return part.key === key; })[0].title;
        if (index === total && total === status.total) stepLabel.textContent = 'System uruchomiony';
      };
      return [assembly,
        h('section', { class: 'panel space-y-2' },
          h('div', { class: 'flex items-center justify-between' }, h('h3', { class: 'font-bold text-sm' }, 'Części i sklep'), h('span', { class: 'text-xs text-amber-300 font-bold' }, fmt(me.stars) + ' ★')),
          h('p', { class: 'text-xs muted' }, 'Kup część za gwiazdki, aby dodać ją do stanowiska i obejrzeć animację montażu.'),
          catalog.map(function (part) {
            var isOwned = owned.indexOf(part.key) !== -1;
            var cannotAfford = Number(me.stars) < part.price;
            var isPaying = !!payingParts[part.key];
            return h('div', { class: 'rig-shop-row', 'data-part': part.key },
              h('div', { class: 'min-w-0' }, h('div', { class: 'text-sm font-semibold' }, part.title), h('div', { class: 'text-[11px] muted' }, isOwned ? 'Zamontowano' : part.price + ' ★')),
              h('button', { type: 'button', class: 'btn ' + (isOwned ? 'btn-ghost' : ''), disabled: isOwned || isPaying, 'aria-label': isOwned ? part.title + ' — posiadana' : 'Kup ' + part.title, onclick: function () {
                if (isOwned) { toast('Już posiadasz tę część.'); return; }
                if (cannotAfford) {
                  var link = window.TPPayments ? window.TPPayments.buyStarsDirectLink(SEC.BOT_ID) : null;
                  toast('Brak gwiazdek! Otwieramy Telegram Stars...');
                  if (!link) return;
                  if (tg && tg.openTelegramLink) tg.openTelegramLink(link); else window.open(link, '_blank', 'noopener');
                  return;
                }
                payRigPartWithStars(part);
              } }, isOwned ? 'Posiadana' : isPaying ? 'Wysyłanie…' : 'Kup'));
            }),
          h('p', { class: 'text-[11px] muted text-center' }, 'Części kupione w warsztacie zapisują się na Twoim koncie. Postęp: ' + status.count + '/7.'))];
  }

  /* ---------- PROFILE ---------- */
  function viewProfile() {
    var sub = { info: profileInfo, wallet: profileWallet, settings: profileSettings }[ui.profile]();
    return [subtabs(PROFILE_SUBS.filter(function (x) { return x[0] !== 'wallet' || visible('wallet'); }), ui.profile, function (s) { ui.profile = s; render(); }), sub];
  }

  function row(label, value) { return h('div', { class: 'flex justify-between text-xs py-1.5 border-b border-slate-800/70' }, h('span', { class: 'muted' }, label), h('span', { class: 'font-semibold text-right break-all' }, value)); }

  function profileInfo() {
    var file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'hidden', 'aria-label': 'Wybierz avatar', onchange: function () { uploadAvatar(file.files[0]); } });
    return [h('div', { class: 'panel flex flex-col items-center gap-3' },
      h('span', { class: engage.equippedStyle() ? 'cosmetic-border rounded-full' : '', style: engage.equippedStyle() }, avatar(me, 84)), file,
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { file.click(); } }, icon('fa-camera'), ' Zmień avatar'),
      h('div', { class: 'text-lg font-black' }, me.username, ' ', engage.premiumBadge()), h('div', { class: 'text-sm text-violet-300 font-bold' }, levelBadge(me))),
      h('div', { class: 'panel' },
        row('Telegram ID', String(me.id) + (identity.telegram ? '' : ' (tryb lokalny)')), row('Username', '@' + me.username),
        row('Dołączono', fmtDate(me.created_at)), row('Łączne XP', fmt(me.xp_total)), row('Gwiazdki', fmt(me.stars) + ' ★')),
      engage.profileExtras(), socialPanel()];
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
    var c = cfg(), extras = [];
    if (visible('shop')) {
      extras.push(h('div', { class: 'panel space-y-2' }, h('h3', { class: 'font-bold text-sm' }, icon('fa-star', 'text-amber-300'), ' Sklep (Telegram Stars)'),
        h('p', { class: 'text-xs muted' }, 'Kupuj części RIG za ★ w Warsztacie. Saldo: ' + fmt(me.stars) + ' ★'),
        visible('rig') ? h('button', { type: 'button', class: 'btn w-full', onclick: function () { setTab('rig'); } }, 'Otwórz Warsztat') : null));
    }
    if (visible('airdrop')) {
      extras.push(h('div', { class: 'panel space-y-1' }, h('h3', { class: 'font-bold text-sm' }, icon('fa-parachute-box', 'text-cyan-300'), ' Airdrop'),
        row('Pula tokenów', fmt(c.airdropPool)), row('Kurs', fmt(c.airdropRate) + ' XP = 1 token'), row('Twoje XP', fmt(me.xp_total))));
    }
    return extras.concat([
      h('div', { class: 'panel text-center space-y-1' }, h('div', { class: 'text-xs muted' }, 'Saldo'), h('div', { class: 'text-3xl font-black text-white' }, fmt(me.wallet_balance) + ' TON')),
      h('div', { class: 'panel space-y-2' },
        h('div', { class: 'flex items-center justify-between' }, h('span', { class: 'text-sm font-bold' }, icon('fa-wallet'), ' TON Keeper'), h('span', { class: 'text-xs ' + (me.ton_keeper_connected ? 'text-emerald-400' : 'muted') }, me.ton_keeper_connected ? 'Połączono' + (me.ton_keeper_pending ? ' (oczekuje na weryfikację)' : '') : 'Niepołączono')),
        h('button', { type: 'button', class: 'btn w-full', disabled: !CFG.FEATURES.tonKeeper, onclick: function () {
          if (me.ton_keeper_connected) { me.ton_keeper_connected = false; save(); render(); return; }
          // TON Connect v3 integration pending - requires TON SDK (future: window.tonConnectUI)
          if (tg && tg.openLink) tg.openLink('https://app.tonkeeper.com/'); else window.open('https://app.tonkeeper.com/', '_blank', 'noopener');
          me.ton_keeper_pending = true; me.ton_keeper_connected = true; save(); toast('Oczekuje na weryfikację (demo — brak TON Connect).'); render();
        } }, me.ton_keeper_connected ? 'Rozłącz' : 'Połącz TON Keeper')),
      h('div', { class: 'panel space-y-2' }, amount, h('div', { class: 'flex gap-2' },
        h('button', { type: 'button', class: 'btn flex-1', onclick: function () { op('deposit'); } }, 'Wpłać'),
        h('button', { type: 'button', class: 'btn btn-ghost flex-1', onclick: function () { op('withdraw'); } }, 'Wypłać'))),
      h('div', { class: 'panel space-y-1' }, h('h3', { class: 'font-bold text-sm mb-1' }, 'Historia transakcji'),
        tx.length ? tx.map(function (t) { return row((t.type === 'deposit' ? 'Wpłata' : 'Wypłata') + ' · ' + fmtDate(t.created_at), fmt(t.amount) + ' TON (' + t.status + ')'); }) : h('div', { class: 'text-xs muted' }, 'Brak transakcji.'))
    ]);
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
  admin = window.TPAdminUI.create({
    h: h, icon: icon, toast: toast, fmt: fmt, fmtDate: fmtDate,
    me: function () { return me; }, isAdmin: isAdmin, lang: function () { return me.settings.language; },
    debug: function () { return cfg().debug; }, applyConfig: applyConfig, rerender: function () { render(); }
  });
  engage = window.TPEngageUI.create({
    h: h, icon: icon, toast: toast, fmt: fmt, fmtDate: fmtDate, announce: toast,
    me: function () { return me; }, lang: function () { return me.settings.language; }, save: save, grantXp: grantXp,
    rerender: function () { render(); },
    openLink: function (url) {
      try {
        if (tg && /^https:\/\/t\.me\//i.test(url) && tg.openTelegramLink) tg.openTelegramLink(url);
        else if (tg && tg.openLink) tg.openLink(url);
        else window.open(url, '_blank', 'noopener,noreferrer');
      } catch (e) { window.open(url, '_blank', 'noopener,noreferrer'); }
    }
  });
  function editing() { var a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && content.contains(a); }
  grantXp(0); save(); Data.touchActivity(me.id);
  engage.boot();
  // Backend mode: the server is the source of truth for progress and admin content; local state is the offline/mock fallback.
  var syncing = false;
  function applySync(res) {
    if (!res) return;
    if (res.user) {
      var keepClicks = Math.max(me.clicks || 0, res.user.clicks || 0);
      Object.assign(me, res.user, { clicks: keepClicks });
      claimed.length = 0;
      (res.claimed || []).forEach(function (id) { claimed.push(id); });
      renderShell();
      if (!editing() && !admin.isOpen()) render();
    } else if (res.contentChanged && !editing() && !admin.isOpen()) render();
  }
  Data.onSynced = applySync;
  function backendSync(first) {
    if (syncing || !Data.remoteEnabled) return;
    syncing = true;
    var p = first ? Data.bootstrap(identity.user, identity.telegram && tg ? tg.initData : '', me.referred_by) : Data.sync();
    p.then(applySync, function () {}).then(function () { syncing = false; }, function () { syncing = false; });
  }
  backendSync(true);
  function flushPending() { try { Data.flushProfile(); } catch (e) { /* ignore */ } }
  document.addEventListener('visibilitychange', function () { if (document.hidden) flushPending(); else backendSync(false); });
  window.addEventListener('pagehide', flushPending);
  setInterval(function () { backendSync(false); }, 60000);
  Data.subscribeStorage(function (key) {
    if (key === 'user:' + me.id) {
      var fresh = Data.loadUser(identity.user);
      if ((fresh.clicks || 0) > (me.clicks || 0)) { me.clicks = fresh.clicks; me.xp_total = Math.max(me.xp_total, fresh.xp_total); me.level = Math.max(me.level, fresh.level); renderShell(); }
    } else if ((key === 'posts' || key === 'admin' || key === 'admin:notifications') && !editing() && !admin.isOpen()) render();
    else if (key === 'admin' && admin.isOpen()) admin.refresh();
  });
  // Notify (once per new item) when a scheduled notification becomes due; re-render only when nothing is being edited.
  setInterval(function () {
    var n = pendingNotifications().length;
    if (n > lastNotifCount) { toast(tr('notifications') + ': ' + n); if (ui.tab === 'channel' && !editing() && !admin.isOpen()) render(); }
    lastNotifCount = n;
  }, 15000);
  lastNotifCount = pendingNotifications().length;
  render();
  if (window.TPPayments) window.TPPayments.retryQueued();
})();
