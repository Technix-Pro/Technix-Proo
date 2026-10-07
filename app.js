(function () {
  'use strict';
  var CFG = window.TP_CONFIG, SEC = window.TECHNIX_CONFIG || {}, Core = window.TPCore, Data = window.TPData, TPRig = window.TPRig, Admin = window.TPAdmin;
  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  if (tg) { try { tg.ready(); tg.expand(); } catch (e) { /* ignore */ } }

  var I18N = window.TPI18n;
  // Bottom nav: Home, TechnixPro (bonuses), Workshop (middle), Wallet, Profile. Chat lives in the header; the full Bonusy section is reachable from TechnixPro.
  var NAV = [
    { id: 'home', tab: 'channel', icon: 'fa-house' },
    { id: 'technix', tab: 'bonus', sub: 'overview', icon: 'fa-gamepad', feature: 'bonus' },
    { id: 'rig', tab: 'rig', icon: 'fa-computer', feature: 'rig' },
    { id: 'wallet', tab: 'profile', sub: 'wallet', icon: 'fa-wallet', feature: 'wallet' },
    { id: 'profile', tab: 'profile', sub: 'info', icon: 'fa-user' }
  ];
  var TAB_FEATURE = { chat: 'chat', bonus: 'bonus', rig: 'rig' };
  var BONUS_SUBS = ['overview', 'events', 'tasks', 'referral', 'badges', 'community'];
  var PROFILE_SUBS = ['info', 'wallet', 'settings'];
  var SETTINGS_SUBS = ['account', 'notifications', 'privacy', 'language'];

  var identity = resolveIdentity();
  var me = Data.loadUser(identity.user);
  me.settings = me.settings || {};
  me.settings.language = I18N.normalize(me.settings.language);
  I18N.setLang(me.settings.language);
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
  function fmt(n) { return new Intl.NumberFormat(I18N.locale(), { maximumFractionDigits: 9 }).format(n); }
  function fmtDate(iso) { var d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString(I18N.locale(), { dateStyle: 'short', timeStyle: 'short' }); }
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
  function tr(key, params) { return I18N.t(key, params); }
  // Built-in titles come from the dictionary; values entered by an admin are shown as authored.
  function levelName(l) { return tr('level.' + l.level); }
  function partTitle(part) { return I18N.content('rig.part.' + part.key, part.title, DEFAULT_PART_TITLES[part.key]); }
  function taskTitle(task) { return I18N.content('task.' + task.id, task.title, DEFAULT_TASK_TITLES[task.id]); }
  function eventField(e, field) { return I18N.content('event.' + e.id + '.' + field, e[field], DEFAULT_EVENTS[e.id] && DEFAULT_EVENTS[e.id][field]); }
  function achTitle(a) {
    if (!a.titleKey) return a.title;
    var p = Object.assign({}, a.params);
    if (a.titleKey === 'ach.level') p.name = tr('level.' + p.level);
    return tr(a.titleKey, p);
  }
  var DEFAULT_PART_TITLES = {}, DEFAULT_TASK_TITLES = {}, DEFAULT_EVENTS = {};
  CFG.RIG_PARTS.forEach(function (p) { DEFAULT_PART_TITLES[p.key] = p.title; });
  CFG.TASKS.forEach(function (x) { DEFAULT_TASK_TITLES[x.id] = x.title; });
  CFG.EVENTS.forEach(function (e) { DEFAULT_EVENTS[e.id] = e; });

  // Switch language everywhere without a reload: persist, update <html lang>/title, re-render the app, admin panel and engagement UI.
  function setLanguage(lang) {
    me.settings.language = I18N.normalize(lang);
    I18N.setLang(me.settings.language);
    save();
    render();
    if (admin && admin.isOpen()) admin.refresh();
  }

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
    return h('span', { class: 'inline-flex items-center gap-1.5' }, icon(l.icon, 'text-amber-300'), 'Lv ' + l.level + ' · ' + levelName(l));
  }

  function grantXp(amount) {
    var before = me.level;
    Core.addXp(me, amount);
    var gained = Core.claimReferralMilestones(me, cfg().milestones);
    gained.forEach(function (m) { toast(tr('toast.refReward', { count: m.count, xp: m.rewardXp })); });
    if (gained.length) Data.action('tp_claim_referrals');
    if (me.level > before) { toast(tr('toast.levelUp', { name: levelName(Core.levelFor(me.xp_total)) })); if (window.TPEffects) window.TPEffects.celebrate('milestone', document.getElementById('header-level')); }
  }

  /* ---------- shell ---------- */
  function renderShell() {
    var l = Core.levelFor(me.xp_total);
    var hb = document.getElementById('header-avatar');
    hb.replaceChildren(avatar(me, 40));
    hb.setAttribute('aria-label', tr('nav.profile'));
    hb.onclick = function () { setTab('profile'); };
    document.getElementById('header-title').textContent = me.username;
    document.getElementById('header-sub').textContent = 'ID: ' + me.id + ' · ' + fmt(me.xp_total) + ' XP';
    document.getElementById('header-level').replaceChildren(icon(l.icon), ' Lv ' + l.level);
    var adminBtn = document.getElementById('header-admin');
    adminBtn.classList.toggle('hidden', !isAdmin());
    adminBtn.setAttribute('aria-label', tr('app.admin'));
    adminBtn.onclick = function () { if (isAdmin()) admin.open(); };
    var chatBtn = document.getElementById('header-chat');
    chatBtn.classList.toggle('hidden', !visible('chat'));
    chatBtn.setAttribute('aria-label', tr('nav.chat'));
    chatBtn.onclick = function () { setTab('chat'); };
    var clickBtn = document.getElementById('header-clicker');
    clickBtn.classList.toggle('hidden', !visible('bonus'));
    clickBtn.setAttribute('aria-label', tr('app.clicks'));
    clickBtn.replaceChildren(h('span', { 'aria-hidden': 'true' }, '🖱️'), ' ' + fmt(me.clicks || 0));
    clickBtn.onclick = onClick;
    var nav = document.getElementById('bottom-nav');
    var items = NAV.filter(function (n) { return !n.feature || visible(n.feature); });
    nav.style.gridTemplateColumns = 'repeat(' + items.length + ', minmax(0, 1fr))';
    nav.replaceChildren.apply(nav, items.map(function (n) {
      var active = ui.tab === n.tab && (n.tab !== 'profile' || (n.sub === 'wallet') === (ui.profile === 'wallet'));
      return h('button', { class: 'nav-btn' + (active ? ' active' : ''), type: 'button', 'aria-current': active ? 'page' : null, onclick: function () { if (n.tab === 'bonus') ui.bonus = n.sub; if (n.tab === 'profile') ui.profile = n.sub; setTab(n.tab); } }, icon(n.icon), tr('nav.' + n.id));
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
    if (r.achievement) toast('🏆 ' + fmt(me.clicks) + ' ' + tr('app.clicks'));
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

  function subtabs(prefix, list, current, onPick) {
    return h('div', { class: 'subtabs', role: 'tablist' }, list.map(function (id) {
      return h('button', { type: 'button', role: 'tab', class: 'subtab' + (current === id ? ' active' : ''), onclick: function () { onPick(id); } }, tr(prefix + id));
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
    { key: 'tiktok', label: 'TikTok', cls: 'fa-brands fa-tiktok' }, { key: 'website', labelKey: 'social.website', label: 'Official website', cls: 'fa-solid fa-globe' }
  ];

  function openSocial(key) {
    var url = Core.safeUrl(Admin.resolveSocialLinks(Data.getAdminState())[key] || '');
    if (!url) { toast(tr('social.soon')); return; }
    try {
      if (tg && /^https:\/\/t\.me\//i.test(url) && tg.openTelegramLink) tg.openTelegramLink(url);
      else if (tg && tg.openLink) tg.openLink(url);
      else window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) { window.open(url, '_blank', 'noopener,noreferrer'); }
  }

  function socialPanel() {
    return h('div', { class: 'panel space-y-2', role: 'group', 'aria-label': tr('social.title') },
      h('h2', { class: 'font-bold text-sm' }, icon('fa-users'), ' ' + tr('social.title')),
      h('div', { class: 'grid grid-cols-4 gap-2' }, SOCIALS.map(function (x) {
        var label = x.labelKey ? tr(x.labelKey) : x.label;
        return h('button', { type: 'button', class: 'btn btn-ghost', style: 'min-width:44px;min-height:44px;justify-content:center', 'aria-label': label, title: label, onclick: function () { openSocial(x.key); } },
          h('i', { class: x.cls, 'aria-hidden': 'true' }));
      })));
  }

  function viewChannel() {
    var out = [];
    if (isAdmin()) out.push(adminPanel());
    pendingNotifications().forEach(function (n) { out.push(notificationCard(n)); });
    var posts = visiblePosts();
    if (!posts.length) out.push(h('div', { class: 'panel text-sm muted text-center' }, tr(isAdmin() ? 'feed.emptyAdmin' : 'feed.emptyUser')));
    posts.forEach(function (p) { out.push(postCard(p)); });
    engage.homeExtras().forEach(function (n) { if (n) out.push(n); });
    out.push(socialPanel());
    return out;
  }

  function adminPanel() {
    var wrap = h('div', { class: 'panel space-y-3 border-amber-500/40' });
    wrap.appendChild(h('div', { class: 'flex items-center justify-between' },
      h('h2', { class: 'font-bold text-amber-300 text-sm' }, icon('fa-shield-halved'), ' ' + tr('feed.adminTitle')),
      h('div', { class: 'flex gap-2' },
        h('button', { type: 'button', class: 'btn', onclick: function () { admin.open(); } }, icon('fa-sliders'), ' ' + tr('app.admin')),
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { ui.preview = !ui.preview; render(); } }, tr(ui.preview ? 'feed.previewBack' : 'feed.previewUser')))));
    if (ui.preview) { wrap.appendChild(h('p', { class: 'text-xs muted' }, tr('feed.previewNote'))); return wrap; }
    var nextClaim = Date.now() + Core.msUntil(me.last_xp_claim, cfg().xpTimerHours);
    wrap.appendChild(h('div', { class: 'text-xs flex justify-between' }, h('span', { class: 'muted' }, tr('feed.timer', { hours: cfg().xpTimerHours })),
      Core.msUntil(me.last_xp_claim, cfg().xpTimerHours) > 0 ? countdown(nextClaim) : h('span', { class: 'text-emerald-400 font-bold' }, tr('feed.timerReady'))));
    var text = h('textarea', { class: 'field', rows: '3', maxlength: String(CFG.POST_MAX_LENGTH), placeholder: tr('post.placeholder') });
    var imgs = h('textarea', { class: 'field', rows: '2', placeholder: tr('post.images') });
    var vids = h('textarea', { class: 'field', rows: '2', placeholder: tr('post.videos') });
    var links = h('textarea', { class: 'field', rows: '2', placeholder: tr('post.links') });
    function collect(published) {
      var content_ = Core.cleanText(text.value, CFG.POST_MAX_LENGTH);
      var lines = function (el) { return el.value.split('\n').map(Core.safeUrl).filter(Boolean).slice(0, 5); };
      var post = { id: Data.newId(), admin_id: me.id, content: content_, images: lines(imgs), videos: lines(vids), links: lines(links), likes: [], comments: [], likes_count: 0, comments_count: 0, created_at: new Date().toISOString(), published: published };
      if (!post.content && !post.images.length && !post.videos.length && !post.links.length) { toast(tr('post.empty')); return; }
      var all = Data.getPosts(); all.push(post); Data.savePosts(all);
      toast(tr(published ? 'post.published' : 'post.draftSaved')); render();
    }
    wrap.appendChild(h('div', { class: 'space-y-2' }, text, imgs, vids, links));
    wrap.appendChild(h('div', { class: 'flex gap-2' },
      h('button', { type: 'button', class: 'btn btn-ghost flex-1', onclick: function () { collect(false); } }, tr('post.saveDraft')),
      h('button', { type: 'button', class: 'btn flex-1', onclick: function () { collect(true); } }, tr('post.publish'))));
    return wrap;
  }

  function pendingNotifications() {
    return Admin.pendingNotifications(Data.getList('notifications'), Data.getList('seen:' + me.id), Date.now());
  }

  function notificationCard(n) {
    return h('div', { class: 'panel space-y-1 border-cyan-500/40', role: 'alert' },
      h('div', { class: 'flex items-center justify-between gap-2' }, h('b', { class: 'text-sm text-cyan-300', text: n.title }),
        h('button', { type: 'button', class: 'btn btn-ghost', 'aria-label': tr('app.dismiss'), onclick: function () {
          Data.saveList('seen:' + me.id, [n.id].concat(Data.getList('seen:' + me.id)), 200);
          Data.saveList('notifications', Data.getList('notifications').map(function (x) { return x.id === n.id ? Object.assign({}, x, { delivered_count: (x.delivered_count || 0) + 1 }) : x; }), 100);
          render();
        } }, icon('fa-xmark'))),
      h('p', { class: 'text-xs break-words', text: n.message }),
      n.link && Core.safeUrl(n.link) ? h('a', { class: 'btn inline-block', href: n.link, target: '_blank', rel: 'noopener noreferrer' }, tr('app.open')) : null);
  }

  function postCard(p) {
    var admin = adminView();
    var card = h('article', { class: 'panel space-y-3' });
    card.appendChild(h('div', { class: 'flex items-center justify-between text-xs' },
      h('span', { class: 'font-bold text-cyan-300' }, 'TechnixPro'),
      h('span', { class: 'muted' }, (p.published ? '' : p.scheduled_at && Admin.postVisible(p, false) ? '' : p.scheduled_at ? tr('post.tagScheduled') : tr('post.tagDraft')) + fmtDate(p.created_at))));
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
      row.appendChild(h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { mutatePost(p.id, function (x) { x.published = !x.published; }); } }, tr(p.published ? 'post.hide' : 'post.show')));
      row.appendChild(h('button', { type: 'button', class: 'btn btn-danger', 'aria-label': tr('post.delete'), onclick: function () { if (!isAdmin() || !confirm(tr('post.deleteConfirm'))) return;
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
        admin ? h('button', { type: 'button', class: 'text-rose-400', 'aria-label': tr('comment.delete'), onclick: function () { mutatePost(p.id, function (x) { x.comments = x.comments.filter(function (y) { return y.id !== c.id; }); }); } }, icon('fa-xmark')) : null));
    });
    var input = h('input', { class: 'field', maxlength: '300', placeholder: tr('comment.placeholder') });
    function send() {
      var t = Core.cleanText(input.value, 300);
      if (!t) return;
      mutatePost(p.id, function (x) { x.comments.push({ id: Data.newId(), user_id: me.id, username: me.username, content: t, created_at: new Date().toISOString() }); });
    }
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
    box.appendChild(h('div', { class: 'flex gap-2' }, input, h('button', { type: 'button', class: 'btn', onclick: send }, tr('app.send'))));
    return box;
  }

  /* ---------- CHAT ---------- */
  function viewChat() {
    var list = h('div', { class: 'chat-list', role: 'log', 'aria-live': 'polite' });
    var online = h('span', { class: 'text-xs muted' });
    var input = h('input', { class: 'field', maxlength: String(CFG.CHAT_MAX_LENGTH), placeholder: tr('chat.placeholder'), value: ui.chatDraft });
    input.addEventListener('input', function () { ui.chatDraft = input.value; });
    function paint(msgs) {
      var atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
      list.replaceChildren.apply(list, msgs.map(function (m) {
        var mine = m.user_id === me.id;
        return h('div', { class: 'flex gap-2 items-end' + (mine ? ' flex-row-reverse' : '') },
          avatar({ username: m.username, avatar_url: m.avatar_url }),
          h('div', { class: 'bubble' + (mine ? ' mine' : '') },
            h('div', { class: 'text-[10px] muted mb-0.5' }, m.username + ' · ' + new Date(m.created_at).toLocaleTimeString(I18N.locale(), { hour: '2-digit', minute: '2-digit' })),
            h('div', { text: m.content })));
      }));
      online.replaceChildren(h('span', { class: 'dot-online' }), ' ' + tr('chat.online', { n: Data.onlineUsers(me) }));
      if (atBottom) list.scrollTop = list.scrollHeight;
    }
    function refresh() { Data.getMessages().then(function (m) { if (ui.tab === 'chat' && list.isConnected) paint(m); }); }
    function send() {
      var t = Core.cleanText(input.value, CFG.CHAT_MAX_LENGTH);
      if (!t) return;
      if (Date.now() - lastSend < 1500) { toast(tr('chat.slow')); return; }
      lastSend = Date.now();
      input.value = ''; ui.chatDraft = '';
      Data.sendMessage(me, t).then(refresh);
      me.last_active = new Date().toISOString(); save();
    }
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
    setTimeout(function () { refresh(); list.scrollTop = list.scrollHeight; }, 0);
    chatTimer = setInterval(refresh, CFG.CHAT_POLL_MS);
    return h('div', { class: 'panel space-y-3' },
      h('div', { class: 'flex items-center justify-between' }, h('h2', { class: 'font-bold text-sm' }, icon('fa-comments'), ' ' + tr('chat.title')), online),
      list,
      h('div', { class: 'flex gap-2' }, input, h('button', { type: 'button', class: 'btn', 'aria-label': tr('app.send'), onclick: send }, icon('fa-paper-plane'))));
  }

  /* ---------- BONUSES ---------- */
  function viewBonus() {
    var sub = { overview: bonusOverview, events: bonusEvents, tasks: bonusTasks, referral: bonusReferral, badges: bonusBadges, community: function () { return engage.communityView(); } }[ui.bonus]();
    return [subtabs('bonus.sub.', BONUS_SUBS, ui.bonus, function (s) { ui.bonus = s; render(); }), sub];
  }

  function stat(label, value) { return h('div', { class: 'panel text-center !p-3' }, h('div', { class: 'text-lg font-black text-white' }, String(value)), h('div', { class: 'text-[10px] muted' }, label)); }

  function claimRow(title, desc, msLeft, onClaim) {
    return h('div', { class: 'panel flex items-center gap-3' },
      h('div', { class: 'flex-1' }, h('div', { class: 'text-sm font-bold' }, title), h('div', { class: 'text-xs muted' }, desc)),
      msLeft > 0 ? countdown(Date.now() + msLeft, function () { if (ui.tab === 'bonus') render(); }) : h('button', { type: 'button', class: 'btn', onclick: onClaim }, tr('app.claim')));
  }

  function bonusOverview() {
    var p = Core.progress(me.xp_total), ctx = rankCtx();
    return [
      h('div', { class: 'panel space-y-3' },
        h('div', { class: 'flex items-center justify-between' }, h('span', { class: 'font-bold text-sm' }, levelBadge(me)), h('span', { class: 'text-xs muted' }, tr('bonus.rank', { rank: ctx.rank }))),
        h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': String(p.percent), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('div', { style: 'width:' + p.percent + '%' })),
        h('div', { class: 'text-xs muted' }, p.next ? tr('bonus.progress', { xp: fmt(me.xp_total), next: fmt(p.next.xp), name: levelName(p.next), left: fmt(p.xpToNext) }) : tr('bonus.maxLevel'))),
      h('div', { class: 'grid grid-cols-3 gap-2' }, stat('XP', fmt(me.xp_total)), stat(tr('bonus.stars'), fmt(me.stars)), stat(tr('bonus.tasks'), me.tasks_completed)),
      claimRow(tr('bonus.timer', { hours: cfg().xpTimerHours }), '+' + Admin.scaleXp(cfg().xpTimerReward, cfg().xpMultiplier) + ' XP', Core.msUntil(me.last_xp_claim, cfg().xpTimerHours), function () {
        var r = Core.claimTimer(me, null, { hours: cfg().xpTimerHours, reward: Admin.scaleXp(cfg().xpTimerReward, cfg().xpMultiplier) }); if (r.ok) { grantXp(0); save(); Data.action('tp_claim_timer'); toast('+' + r.xp + ' XP'); render(); }
      }),
      claimRow(tr('bonus.daily'), '+' + Admin.scaleXp(cfg().dailyReward, cfg().xpMultiplier) + ' XP', Core.msUntil(me.last_daily, 24), function () {
        var r = Core.claimDaily(me, null, { reward: Admin.scaleXp(cfg().dailyReward, cfg().xpMultiplier) }); if (r.ok) { grantXp(0); save(); Data.action('tp_claim_daily'); toast('+' + r.xp + ' XP'); render(); }
      }),
      h('div', { class: 'panel space-y-2' }, h('h3', { class: 'font-bold text-sm' }, tr('bonus.levels')),
        CFG.LEVELS.map(function (l) {
          return h('div', { class: 'flex items-center justify-between text-xs ' + (me.level >= l.level ? 'text-white' : 'muted') },
            h('span', {}, icon(l.icon, 'w-5 text-amber-300'), ' ' + l.level + '. ' + levelName(l)), h('span', {}, fmt(l.xp) + ' XP'));
        }))
    ];
  }

  function bonusEvents() {
    return activeEvents().map(function (e) {
      return h('div', { class: 'panel space-y-2' },
        h('div', { class: 'flex items-center justify-between' }, h('h3', { class: 'font-bold text-sm' }, eventField(e, 'title')),
          h('span', { class: 'text-[10px] font-bold px-2 py-0.5 rounded-full ' + (e.live ? 'bg-rose-600/30 text-rose-300' : 'bg-slate-700 text-slate-300') }, tr(e.live ? 'event.live' : 'event.soon'))),
        h('p', { class: 'text-xs muted' }, eventField(e, 'desc')), e.starts_at || e.ends_at ? h('div', { class: 'text-[11px] muted' }, (e.starts_at ? fmtDate(e.starts_at) : '') + ' → ' + (e.ends_at ? fmtDate(e.ends_at) : '')) : null, h('div', { class: 'text-xs text-amber-300 font-bold' }, tr('event.reward', { reward: eventField(e, 'reward') })));
    });
  }

  function bonusTasks() {
    var ctx = rankCtx();
    return [h('p', { class: 'text-xs muted' }, tr('task.intro', { n: me.tasks_completed }))].concat(activeTasks().map(function (t) {
      var st = Core.taskStatus(me, t, claimed, ctx);
      return h('div', { class: 'panel space-y-2' },
        h('div', { class: 'flex items-center justify-between' }, h('span', { class: 'text-sm font-bold' }, taskTitle(t)), h('span', { class: 'text-xs text-amber-300 font-bold' }, '+' + (t.rewardStars || 0) + ' ★' + (t.rewardXp ? ' +' + t.rewardXp + ' XP' : ''))),
        h('div', { class: 'bar' }, h('div', { style: 'width:' + Math.round(st.value / st.goal * 100) + '%' })),
        h('div', { class: 'flex items-center justify-between' }, h('span', { class: 'text-xs muted' }, st.value + ' / ' + st.goal),
          h('button', { type: 'button', class: 'btn', disabled: !st.completable, onclick: function () {
            var r = Core.claimTask(me, Object.assign({}, t, { rewardXp: Admin.scaleXp(t.rewardXp, cfg().xpMultiplier), rewardStars: t.rewardStars || 0 }), claimed, ctx);
            if (r.ok) { Data.recordTaskCompletion(t.id); grantXp(0); save(); Data.action('tp_claim_task', { p_task_id: t.id }); toast('+' + (t.rewardStars || 0) + ' ★' + (t.rewardXp ? ' +' + Admin.scaleXp(t.rewardXp, cfg().xpMultiplier) + ' XP' : '')); render(); }
          } }, tr(st.done ? 'task.claimed' : 'app.claim'))));
    }));
  }

  function bonusReferral() {
    var link = Core.referralLink(me.id, SEC.BOT_USERNAME);
    var earned = cfg().milestones.filter(function (m) { return me.referral_claimed.indexOf(m.count) !== -1; }).reduce(function (s, m) { return s + m.rewardXp; }, 0);
    var nodes = [
      h('div', { class: 'panel space-y-2' }, h('h3', { class: 'font-bold text-sm' }, tr('ref.title')),
        h('input', { class: 'field', readonly: true, value: link, 'aria-label': tr('ref.linkAria') }),
        h('div', { class: 'flex gap-2' },
          h('button', { type: 'button', class: 'btn flex-1', onclick: function () {
            (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { toast(tr('ref.copied')); }, function () { toast(tr('ref.copyManual')); });
          } }, icon('fa-copy'), ' ' + tr('ref.copy')),
          h('button', { type: 'button', class: 'btn btn-ghost flex-1', onclick: function () {
            var share = 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(tr('ref.shareText'));
            if (tg && tg.openTelegramLink) tg.openTelegramLink(share); else window.open(share, '_blank', 'noopener');
          } }, icon('fa-share'), ' ' + tr('ref.share'))),
        h('div', { class: 'text-xs muted' }, tr('ref.code', { code: me.referral_code }))),
      h('div', { class: 'grid grid-cols-2 gap-2' }, stat(tr('ref.invited'), me.referral_count), stat(tr('ref.earned'), earned)),
      h('div', { class: 'panel space-y-2' }, h('h3', { class: 'font-bold text-sm' }, tr('ref.rewards')),
        cfg().milestones.map(function (m) {
          var done = me.referral_claimed.indexOf(m.count) !== -1;
          return h('div', { class: 'flex justify-between text-xs ' + (done ? 'text-emerald-400' : '') },
            h('span', {}, icon(done ? 'fa-circle-check' : 'fa-circle', 'mr-1'), tr('ref.milestone', { count: m.count, cur: Math.min(me.referral_count, m.count) })), h('b', {}, '+' + fmt(m.rewardXp) + ' XP'));
        }))
    ];
    if (!identity.telegram) {
      nodes.push(h('button', { type: 'button', class: 'btn btn-ghost w-full', onclick: function () { me.referral_count += 1; grantXp(0); save(); render(); } }, tr('ref.simulate')));
    }
    return nodes;
  }

  function bonusBadges() {
    var list = Core.achievements(me, rankCtx());
    return [h('p', { class: 'text-xs muted' }, tr('badge.count', { n: list.filter(function (a) { return a.unlocked; }).length, total: list.length })),
      h('div', { class: 'grid grid-cols-3 gap-2' }, list.map(function (a) {
        return h('div', { class: 'badge-item' + (a.unlocked ? '' : ' locked') }, icon(a.icon, 'text-xl text-amber-300 block mb-1'), achTitle(a));
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
        'aria-label': partTitle(CFG.RIG_PARTS.filter(function (part) { return part.key === key; })[0]),
        'class': 'rig-part ' + (owned.indexOf(key) !== -1 ? 'rig-owned rig-mounted' : 'rig-locked')
      }, children);
  }

  function buildRigSvg(owned) {
      var svg = svgNode('svg', { viewBox: '0 0 360 270', role: 'img', 'aria-label': tr('rig.svgAria'), class: 'rig-canvas' });
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
    if (!P || !CFG.PAYMENTS_ENABLED || payingParts[part.key]) { toast(tr('pay.unavailable')); return; }
    payingParts[part.key] = true; render();
    function done() { delete payingParts[part.key]; render(); }
    P.sendStarsInvoice(me.id, part.stars, partTitle(part), tr('pay.invoiceDesc', { part: partTitle(part) }), part.key).then(function (res) {
      if (!res.ok) {
        done();
        toast(res.queued ? tr('pay.offline') : tr('pay.error', { error: res.error }));
        return;
      }
      console.log('Invoice ID:', res.invoice_id);
      P.trackInvoice(res.invoice_id, {
        onPaid: function () {
          var r = Data.buyRigPart(me, part.key);
          if (!r.ok && r.reason === 'insufficient_stars') r = Data.grantRigPart(me, part.key);
          if (r.ok) { pendingRigPart = part.key; save(); toast(tr('pay.paid', { part: partTitle(part) })); if (window.TPEffects) window.TPEffects.celebrate('levelup', document.getElementById('header-level')); }
          done();
        },
        onCancel: function () { toast(tr('pay.cancelled')); done(); }
      });
      if (res.invoice_link && P.openInvoice(res.invoice_link)) return;
      toast(tr('pay.invoiceSent'));
    });
  }

  function viewRig() {
      var catalog = Data.rigPartsCatalog(), owned = Data.rigParts(me.id), status = TPRig.progress(owned);
      var allMounted = status.count === status.total;
      var stepLabel = h('p', { class: 'rig-step text-xs muted', 'aria-live': 'polite' },
        allMounted ? tr('rig.running') : tr('rig.partsInstalled', { n: owned.length }));
      var canvas = h('div', { class: 'rig-canvas-wrap' }, buildRigSvg(owned));
      var assembly = h('section', { class: 'panel rig-panel space-y-3' + (allMounted ? ' rig-running' : ''), 'data-rig-builder': '' },
        h('div', { class: 'flex items-center justify-between gap-2' },
          h('div', {}, h('h2', { class: 'font-bold text-sm' }, icon('fa-computer', 'text-cyan-300'), ' ' + tr('rig.title')), stepLabel),
          h('button', { type: 'button', class: 'btn btn-ghost rig-replay', onclick: function () {
            stepLabel.textContent = tr('rig.preparing');
            TPRig.replay(canvas.querySelector('svg'), catalog.filter(function (part) { return owned.indexOf(part.key) !== -1; }).map(function (part) { return part.key; }), function (key, index, total) {
              stepLabel.textContent = key ? tr('rig.mounting', { part: partTitle(catalog.filter(function (part) { return part.key === key; })[0]) }) : tr(allMounted ? 'rig.running' : 'rig.assemblyDone');
            });
          } }, icon('fa-rotate-right'), ' ' + tr('rig.replay'))),
        h('div', { class: 'bar', role: 'progressbar', 'aria-label': tr('rig.progressAria'), 'aria-valuenow': String(status.percent), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('div', { style: 'width:' + status.percent + '%' })),
        canvas);
      assembly._onRigStep = function (key, index, total) {
        stepLabel.textContent = tr('rig.mountedPart', { part: partTitle(catalog.filter(function (part) { return part.key === key; })[0]) });
        if (index === total && total === status.total) stepLabel.textContent = tr('rig.running');
      };
      return [assembly,
        h('section', { class: 'panel space-y-2' },
          h('div', { class: 'flex items-center justify-between' }, h('h3', { class: 'font-bold text-sm' }, tr('rig.shop')), h('span', { class: 'text-xs text-amber-300 font-bold' }, fmt(me.stars) + ' ★')),
          h('p', { class: 'text-xs muted' }, tr('rig.shopHint')),
          catalog.map(function (part) {
            var isOwned = owned.indexOf(part.key) !== -1;
            var cannotAfford = Number(me.stars) < part.price;
            var isPaying = !!payingParts[part.key];
            return h('div', { class: 'rig-shop-row', 'data-part': part.key },
              h('div', { class: 'min-w-0' }, h('div', { class: 'text-sm font-semibold' }, partTitle(part)), h('div', { class: 'text-[11px] muted' }, isOwned ? tr('rig.installed') : part.price + ' ★')),
              h('button', { type: 'button', class: 'btn ' + (isOwned ? 'btn-ghost' : ''), disabled: isOwned || isPaying, 'aria-label': isOwned ? tr('rig.ownedAria', { part: partTitle(part) }) : tr('rig.buyAria', { part: partTitle(part) }), onclick: function () {
                if (isOwned) { toast(tr('rig.alreadyOwned')); return; }
                if (cannotAfford) {
                  var link = window.TPPayments ? window.TPPayments.buyStarsDirectLink(SEC.BOT_ID) : null;
                  toast(tr('rig.noStars'));
                  if (!link) return;
                  if (tg && tg.openTelegramLink) tg.openTelegramLink(link); else window.open(link, '_blank', 'noopener');
                  return;
                }
                payRigPartWithStars(part);
              } }, isOwned ? tr('rig.owned') : isPaying ? tr('rig.sending') : tr('rig.buy')));
            }),
          h('p', { class: 'text-[11px] muted text-center' }, tr('rig.footer', { n: status.count })))];
  }

  /* ---------- PROFILE ---------- */
  function viewProfile() {
    var sub = { info: profileInfo, wallet: profileWallet, settings: profileSettings }[ui.profile]();
    return [subtabs('profile.sub.', PROFILE_SUBS.filter(function (x) { return x !== 'wallet' || visible('wallet'); }), ui.profile, function (s) { ui.profile = s; render(); }), sub];
  }

  function row(label, value) { return h('div', { class: 'flex justify-between text-xs py-1.5 border-b border-slate-800/70' }, h('span', { class: 'muted' }, label), h('span', { class: 'font-semibold text-right break-all' }, value)); }

  function profileInfo() {
    var file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'hidden', 'aria-label': tr('profile.pickAvatar'), onchange: function () { uploadAvatar(file.files[0]); } });
    return [h('div', { class: 'panel flex flex-col items-center gap-3' },
      h('span', { class: engage.equippedStyle() ? 'cosmetic-border rounded-full' : '', style: engage.equippedStyle() }, avatar(me, 84)), file,
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { file.click(); } }, icon('fa-camera'), ' ' + tr('profile.changeAvatar')),
      h('div', { class: 'text-lg font-black' }, me.username, ' ', engage.premiumBadge()), h('div', { class: 'text-sm text-violet-300 font-bold' }, levelBadge(me))),
      h('div', { class: 'panel' },
        row('Telegram ID', String(me.id) + (identity.telegram ? '' : tr('profile.localMode'))), row('Username', '@' + me.username),
        row(tr('profile.joined'), fmtDate(me.created_at)), row(tr('profile.totalXp'), fmt(me.xp_total)), row(tr('profile.stars'), fmt(me.stars) + ' ★')),
      engage.profileExtras(), socialPanel()];
  }

  function uploadAvatar(f) {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { toast(tr('avatar.badType')); return; }
    if (f.size > CFG.AVATAR_MAX_BYTES) { toast(tr('avatar.tooBig')); return; }
    var url = URL.createObjectURL(f), img = new Image();
    img.onload = function () {
      var s = 128, c = document.createElement('canvas'); c.width = c.height = s;
      var m = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
      URL.revokeObjectURL(url);
      me.avatar_url = c.toDataURL('image/jpeg', 0.85); me.avatar_custom = true; save(); toast(tr('avatar.updated')); render();
    };
    img.onerror = function () { URL.revokeObjectURL(url); toast(tr('avatar.loadFail')); };
    img.src = url;
  }

  function profileWallet() {
    var amount = h('input', { class: 'field', type: 'number', min: '0', step: 'any', inputmode: 'decimal', placeholder: tr('wallet.amount') });
    var tx = Data.transactions(me.id);
    function op(type) {
      var v = Core.validateAmount(amount.value, type === 'withdraw' ? me.wallet_balance : null);
      if (!v.ok) { toast(tr('wallet.err.' + v.code)); return; }
      if (type === 'withdraw') {
        if (!me.ton_keeper_connected) { toast(tr('wallet.connectFirst')); return; }
        me.wallet_balance = Math.round((me.wallet_balance - v.value) * 1e9) / 1e9;
      }
      Data.addTransaction(me.id, { type: type, amount: v.value, status: 'pending' });
      save(); toast(tr('wallet.orderSaved')); render();
    }
    var c = cfg(), extras = [];
    if (visible('shop')) {
      extras.push(h('div', { class: 'panel space-y-2' }, h('h3', { class: 'font-bold text-sm' }, icon('fa-star', 'text-amber-300'), ' ' + tr('wallet.shop')),
        h('p', { class: 'text-xs muted' }, tr('wallet.shopHint', { stars: fmt(me.stars) })),
        visible('rig') ? h('button', { type: 'button', class: 'btn w-full', onclick: function () { setTab('rig'); } }, tr('wallet.openRig')) : null));
    }
    if (visible('airdrop')) {
      extras.push(h('div', { class: 'panel space-y-1' }, h('h3', { class: 'font-bold text-sm' }, icon('fa-parachute-box', 'text-cyan-300'), ' ' + tr('wallet.airdrop')),
        row(tr('wallet.pool'), fmt(c.airdropPool)), row(tr('wallet.rate'), tr('wallet.rateValue', { rate: fmt(c.airdropRate) })), row(tr('wallet.yourXp'), fmt(me.xp_total))));
    }
    return extras.concat([
      h('div', { class: 'panel text-center space-y-1' }, h('div', { class: 'text-xs muted' }, tr('wallet.balance')), h('div', { class: 'text-3xl font-black text-white' }, fmt(me.wallet_balance) + ' TON')),
      h('div', { class: 'panel space-y-2' },
        h('div', { class: 'flex items-center justify-between' }, h('span', { class: 'text-sm font-bold' }, icon('fa-wallet'), ' TON Keeper'), h('span', { class: 'text-xs ' + (me.ton_keeper_connected ? 'text-emerald-400' : 'muted') }, me.ton_keeper_connected ? tr('wallet.connected') + (me.ton_keeper_pending ? tr('wallet.pending') : '') : tr('wallet.notConnected'))),
        h('button', { type: 'button', class: 'btn w-full', disabled: !CFG.FEATURES.tonKeeper, onclick: function () {
          if (me.ton_keeper_connected) { me.ton_keeper_connected = false; save(); render(); return; }
          // TON Connect v3 integration pending - requires TON SDK (future: window.tonConnectUI)
          if (tg && tg.openLink) tg.openLink('https://app.tonkeeper.com/'); else window.open('https://app.tonkeeper.com/', '_blank', 'noopener');
          me.ton_keeper_pending = true; me.ton_keeper_connected = true; save(); toast(tr('wallet.pendingToast')); render();
        } }, tr(me.ton_keeper_connected ? 'wallet.disconnect' : 'wallet.connect'))),
      h('div', { class: 'panel space-y-2' }, amount, h('div', { class: 'flex gap-2' },
        h('button', { type: 'button', class: 'btn flex-1', onclick: function () { op('deposit'); } }, tr('wallet.deposit')),
        h('button', { type: 'button', class: 'btn btn-ghost flex-1', onclick: function () { op('withdraw'); } }, tr('wallet.withdraw')))),
      h('div', { class: 'panel space-y-1' }, h('h3', { class: 'font-bold text-sm mb-1' }, tr('wallet.history')),
        tx.length ? tx.map(function (t) { return row(tr(t.type === 'deposit' ? 'wallet.txDeposit' : 'wallet.txWithdraw') + ' · ' + fmtDate(t.created_at), fmt(t.amount) + ' TON (' + (I18N.has('wallet.status.' + t.status) ? tr('wallet.status.' + t.status) : t.status) + ')'); }) : h('div', { class: 'text-xs muted' }, tr('wallet.noTx')))
    ]);
  }

  function toggle(label, get, set) {
    var cb = h('input', { type: 'checkbox', class: 'w-4 h-4 accent-violet-500', onchange: function () { set(cb.checked); save(); toast(tr('app.saved')); } });
    cb.checked = !!get();
    return h('label', { class: 'flex items-center justify-between text-sm py-2' }, label, cb);
  }

  function profileSettings() {
    var s = me.settings, body;
    if (ui.settings === 'account') {
      body = h('div', {}, row('Username', '@' + me.username), row('Telegram ID', String(me.id)), row(tr('settings.refCode'), me.referral_code),
        h('button', { type: 'button', class: 'btn btn-danger w-full mt-3', onclick: function () {
          if (!confirm(tr('settings.resetConfirm'))) return;
          Object.keys(localStorage).filter(function (k) { return k.indexOf(CFG.STORAGE_PREFIX + ':') === 0 && /:(user|claimed|tx):/.test(k); }).forEach(function (k) { localStorage.removeItem(k); });
          location.reload();
        } }, tr('settings.reset')));
    } else if (ui.settings === 'notifications') {
      body = h('div', {}, toggle(tr('settings.notifPosts'), function () { return s.notifications.posts; }, function (v) { s.notifications.posts = v; }),
        toggle(tr('settings.notifChat'), function () { return s.notifications.chat; }, function (v) { s.notifications.chat = v; }),
        toggle(tr('settings.notifRewards'), function () { return s.notifications.rewards; }, function (v) { s.notifications.rewards = v; }));
    } else if (ui.settings === 'privacy') {
      body = h('div', {}, toggle(tr('settings.showOnline'), function () { return s.privacy.show_online; }, function (v) { s.privacy.show_online = v; }),
        toggle(tr('settings.showRanking'), function () { return s.privacy.show_in_ranking; }, function (v) { s.privacy.show_in_ranking = v; }));
    } else {
      var sel = h('select', { class: 'field', 'aria-label': tr('settings.language'), onchange: function () { setLanguage(sel.value); } },
        h('option', { value: 'pl' }, 'Polski'), h('option', { value: 'en' }, 'English'));
      sel.value = s.language;
      body = h('div', {}, sel);
    }
    return [subtabs('settings.sub.', SETTINGS_SUBS, ui.settings, function (x) { ui.settings = x; render(); }), h('div', { class: 'panel' }, body)];
  }

  /* ---------- boot ---------- */
  if (identity.telegram && tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param && !me.referred_by) {
    var refId = Core.parseReferralCode(String(tg.initDataUnsafe.start_param).replace(/^ref_/, ''));
    if (refId && refId !== me.id) { me.referred_by = refId; save(); }
  }
  admin = window.TPAdminUI.create({
    h: h, icon: icon, toast: toast, fmt: fmt, fmtDate: fmtDate,
    me: function () { return me; }, isAdmin: isAdmin, lang: function () { return I18N.getLang(); },
    debug: function () { return cfg().debug; }, applyConfig: applyConfig, rerender: function () { render(); }
  });
  engage = window.TPEngageUI.create({
    h: h, icon: icon, toast: toast, fmt: fmt, fmtDate: fmtDate, announce: toast,
    me: function () { return me; }, lang: function () { return I18N.getLang(); }, save: save, grantXp: grantXp,
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
      me.settings.language = I18N.normalize(me.settings.language);
      I18N.setLang(me.settings.language);
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
    if (n > lastNotifCount) { toast(tr('app.notifications') + ': ' + n); if (ui.tab === 'channel' && !editing() && !admin.isOpen()) render(); }
    lastNotifCount = n;
  }, 15000);
  lastNotifCount = pendingNotifications().length;
  render();
  if (window.TPPayments) window.TPPayments.retryQueued();
})();
