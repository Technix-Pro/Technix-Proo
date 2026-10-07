// Admin control panel UI (modal). Mounted by app.js; every mutating action re-checks ctx.isAdmin().
(function () {
  'use strict';
  var CFG = window.TP_CONFIG, Admin = window.TPAdmin, Core = window.TPCore, Data = window.TPData, I18N = window.TPI18n;

  var TABS = ['posts', 'tasks', 'events', 'notifications', 'phases', 'settings', 'stats', 'monetization'];

  function create(ctx) {
    var h = ctx.h, icon = ctx.icon;
    var ui = { tab: 'posts', draft: blankDraft(), previewPost: null, notifDraft: { title: '', message: '', link: '', scheduled_at: '' }, notifPreview: false, editTask: null, editEvent: null, connMsg: '', lastSend: 0 };
    var overlay = null, opener = null;
    var monet = window.TPAdminMonet.create({
      h: h, icon: icon, lang: ctx.lang, toast: ctx.toast, fmtDate: ctx.fmtDate, me: function () { return me(); }, guard: function () { return guard(); },
      audit: function (a, ty, id, c) { audit(a, ty, id, c); }, applied: function (m) { applied(m); }, refresh: function () { refresh(); },
      input: function (a) { return input(a); }, field: function (l, e) { return field(l, e); }, btn: function (l, f, c, e) { return btn(l, f, c, e); },
      badge: function (l, c) { return badge(l, c); }, sectionTitle: function (l) { return sectionTitle(l); }
    });

    function t(k) { return I18N.t('admin.' + k); }
    function blankDraft() { return { id: null, content: '', images: '', videos: '', links: '', attachments: [], scheduled_at: '', published: false }; }
    function me() { return ctx.me(); }
    function guard() {
      if (!ctx.isAdmin()) { ctx.toast(t('forbidden')); close(); return false; }
      return true;
    }
    function state() { return Data.getAdminState(); }
    function commit(s) {
      if (!Data.saveAdminState(s)) { ctx.toast(t('storageFull')); return false; }
      return true;
    }
    function audit(action, type, id, changes) { Data.audit(me().id, action, type, id, changes); if (ctx.debug()) console.info('[admin]', action, type, id, changes); }
    function applied(msg) { if (msg) ctx.toast(msg); ctx.applyConfig(); refresh(); ctx.rerender(); }

    function field(label, el) { return h('label', { class: 'block text-[11px] muted space-y-1' }, h('span', {}, label), el); }
    function input(attrs) { return h('input', Object.assign({ class: 'field' }, attrs)); }
    function numberInput(label, value, step, min, max) { return input({ type: 'number', step: step || '1', min: min, max: max, value: String(value), 'aria-label': label, 'data-label': label }); }
    function sectionTitle(txt) { return h('h3', { class: 'font-bold text-sm text-amber-300 mt-2' }, txt); }
    function badge(txt, cls) { return h('span', { class: 'text-[10px] font-bold px-2 py-0.5 rounded-full ' + (cls || 'bg-slate-700 text-slate-300') }, txt); }
    function btn(label, onclick, cls, extra) { return h('button', Object.assign({ type: 'button', class: 'btn ' + (cls || ''), onclick: onclick }, extra || {}), label); }

    /* ---------- open / close ---------- */
    function open() {
      if (!guard()) return;
      if (overlay) return;
      opener = document.activeElement;
      overlay = h('div', { class: 'admin-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'admin-title' });
      overlay.addEventListener('keydown', onKey);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
      document.body.appendChild(overlay);
      document.body.classList.add('admin-open');
      refresh();
      var first = overlay.querySelector('.admin-close');
      if (first) first.focus();
    }
    function close() {
      if (!overlay) return;
      overlay.remove(); overlay = null;
      document.body.classList.remove('admin-open');
      if (opener && opener.focus) opener.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') {
        var f = overlay.querySelectorAll('button, input, select, textarea, a[href]');
        var list = Array.prototype.filter.call(f, function (x) { return !x.disabled && x.offsetParent !== null; });
        if (!list.length) return;
        var first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    function refresh() {
      if (!overlay) return;
      if (!ctx.isAdmin()) { close(); return; }
      var scroll = overlay.querySelector('.admin-body');
      var top = scroll ? scroll.scrollTop : 0;
      var body = { posts: tabPosts, tasks: tabTasks, events: tabEvents, notifications: tabNotifications, phases: tabPhases, settings: tabSettings, stats: tabStats, monetization: function () { return monet.render(); } }[ui.tab]();
      var tabs = h('div', { class: 'subtabs', role: 'tablist', 'aria-label': t('title') }, TABS.map(function (k) {
        return h('button', { type: 'button', role: 'tab', id: 'admin-tab-' + k, 'aria-selected': String(ui.tab === k), tabindex: ui.tab === k ? '0' : '-1', class: 'subtab' + (ui.tab === k ? ' active' : ''), onclick: function () { ui.tab = k; refresh(); } }, t(k));
      }));
      tabs.addEventListener('keydown', function (e) {
        var i = TABS.indexOf(ui.tab);
        if (e.key === 'ArrowRight') i = (i + 1) % TABS.length; else if (e.key === 'ArrowLeft') i = (i + TABS.length - 1) % TABS.length; else return;
        e.preventDefault(); ui.tab = TABS[i]; refresh(); var el = overlay.querySelector('#admin-tab-' + ui.tab); if (el) el.focus();
      });
      overlay.replaceChildren(h('div', { class: 'admin-modal' },
        h('div', { class: 'flex items-center justify-between px-4 py-3 border-b border-slate-800' },
          h('h2', { id: 'admin-title', class: 'font-bold text-amber-300 text-sm' }, icon('fa-shield-halved'), ' ' + t('title')),
          h('button', { type: 'button', class: 'btn btn-ghost admin-close', 'aria-label': t('close'), onclick: close }, icon('fa-xmark'))),
        h('div', { class: 'px-3 pt-2' }, tabs),
        h('div', { class: 'admin-body p-4 space-y-3', role: 'tabpanel', 'aria-labelledby': 'admin-tab-' + ui.tab }, body)));
      var nb = overlay.querySelector('.admin-body');
      if (nb) nb.scrollTop = top;
    }

    /* ---------- POSTS ---------- */
    function previewCard(p) {
      var card = h('article', { class: 'panel space-y-2 border-cyan-500/40' });
      if (p.content) card.appendChild(h('p', { class: 'text-sm whitespace-pre-wrap break-words', text: p.content }));
      (p.images || []).forEach(function (u) { if (Admin.safeImage(u)) card.appendChild(h('img', { class: 'post-media', src: u, alt: '', referrerpolicy: 'no-referrer' })); });
      (p.videos || []).forEach(function (u) { if (Admin.safeVideo(u)) card.appendChild(h('video', { class: 'post-media', src: u, controls: true, preload: 'metadata' })); });
      (p.links || []).forEach(function (u) { if (Core.safeUrl(u)) card.appendChild(h('a', { class: 'block text-xs text-cyan-300 underline break-all', href: u, target: '_blank', rel: 'noopener noreferrer' }, icon('fa-link'), ' ' + u)); });
      return card;
    }

    function readDraft() {
      return Admin.validatePost({ content: ui.draft.content, images: ui.draft.images, videos: ui.draft.videos, links: ui.draft.links, attachments: ui.draft.attachments, scheduled_at: ui.draft.scheduled_at }, CFG.POST_MAX_LENGTH);
    }

    function processImage(file) {
      if (!file) return;
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { ctx.toast(t('badFile')); return; }
      if (file.size > CFG.AVATAR_MAX_BYTES) { ctx.toast(t('bigFile')); return; }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 1024 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        if (ui.draft.attachments.length >= 5) return;
        ui.draft.attachments.push(c.toDataURL('image/jpeg', 0.82));
        refresh();
      };
      img.onerror = function () { URL.revokeObjectURL(url); ctx.toast(t('badFile')); };
      img.src = url;
    }

    function savePost(published) {
      if (!guard()) return;
      var r = readDraft();
      if (!r.ok) { ctx.toast(r.error === 'bad_date' ? t('badDate') : t('empty')); return; }
      if (r.invalid) ctx.toast(t('badLink') + r.invalid);
      var posts = Data.getPosts(), now = new Date().toISOString(), existing = ui.draft.id && posts.filter(function (p) { return p.id === ui.draft.id; })[0];
      var scheduledOnly = !!r.post.scheduled_at;
      if (existing) {
        Object.assign(existing, r.post, { published: published && !scheduledOnly, updated_at: now });
      } else {
        posts.push(Object.assign({ id: Data.newId(), admin_id: me().id, likes: [], comments: [], likes_count: 0, comments_count: 0, created_at: now, published: published && !scheduledOnly }, r.post));
      }
      if (!Data.savePosts(posts)) { ctx.toast(t('storageFull')); return; }
      audit(existing ? 'post.update' : 'post.create', 'post', existing ? existing.id : posts[posts.length - 1].id, { published: published, scheduled_at: r.post.scheduled_at });
      ui.draft = blankDraft(); ui.previewPost = null;
      applied(t('saved'));
    }

    function postStatus(p) {
      if (p.published) return badge(t('published'), 'bg-emerald-600/30 text-emerald-300');
      if (p.scheduled_at) return badge(t('scheduled') + ' · ' + ctx.fmtDate(p.scheduled_at), 'bg-sky-600/30 text-sky-300');
      return badge(t('draft'));
    }

    function tabPosts() {
      var d = ui.draft;
      var text = h('textarea', { class: 'field', rows: '4', maxlength: String(CFG.POST_MAX_LENGTH), placeholder: t('text'), 'aria-label': t('text'), oninput: function () { d.content = text.value; } });
      text.value = d.content;
      function area(key, ph) { var el = h('textarea', { class: 'field', rows: '2', placeholder: ph, 'aria-label': ph, oninput: function () { d[key] = el.value; } }); el.value = d[key]; return el; }
      var file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'hidden', 'aria-label': t('upload'), onchange: function () { processImage(file.files[0]); } });
      var when = input({ type: 'datetime-local', 'aria-label': t('schedule'), value: d.scheduled_at, oninput: function () { d.scheduled_at = when.value; } });
      when.value = d.scheduled_at;
      var out = [
        h('div', { class: 'space-y-2' }, text, area('images', t('images')), file,
          h('div', { class: 'flex flex-wrap gap-2 items-center' }, btn([icon('fa-image'), ' ' + t('upload')], function () { file.click(); }, 'btn-ghost'),
            d.attachments.map(function (u, i) {
              return h('span', { class: 'relative' }, h('img', { src: u, alt: '', class: 'w-12 h-12 rounded-lg object-cover' }),
                h('button', { type: 'button', class: 'absolute -top-1 -right-1 bg-rose-600 rounded-full w-4 h-4 text-[9px]', 'aria-label': t('del'), onclick: function () { d.attachments.splice(i, 1); refresh(); } }, '×'));
            })),
          area('videos', t('videos')), area('links', t('links')), field(t('schedule'), when)),
        h('div', { class: 'flex flex-wrap gap-2' },
          btn([icon('fa-eye'), ' ' + t('preview')], function () { var r = readDraft(); ui.previewPost = r.ok ? r.post : null; if (!r.ok) ctx.toast(t('empty')); refresh(); }, 'btn-ghost flex-1'),
          btn(t('draft'), function () { savePost(false); }, 'btn-ghost flex-1'),
          btn(d.scheduled_at ? t('schedule') : t('publish'), function () { savePost(true); }, 'flex-1'),
          d.id ? btn(t('cancel'), function () { ui.draft = blankDraft(); refresh(); }, 'btn-ghost') : null)
      ];
      if (ui.previewPost) out.push(previewCard(ui.previewPost));
      var posts = Data.getPosts().sort(function (a, b) { return Date.parse(b.created_at) - Date.parse(a.created_at); });
      out.push(sectionTitle(t('posts') + ' (' + posts.length + ')'));
      if (!posts.length) out.push(h('p', { class: 'text-xs muted' }, t('noItems')));
      posts.forEach(function (p) {
        out.push(h('div', { class: 'panel !p-3 space-y-2' },
          h('div', { class: 'flex justify-between items-center' }, postStatus(p), h('span', { class: 'text-[10px] muted' }, ctx.fmtDate(p.created_at))),
          h('p', { class: 'text-xs break-words', text: Core.cleanText(p.content, 120) || '—' }),
          h('div', { class: 'flex gap-2 flex-wrap' },
            btn(t('edit'), function () {
              ui.draft = { id: p.id, content: p.content || '', images: (p.images || []).filter(function (u) { return u.indexOf('data:') !== 0; }).join('\n'), videos: (p.videos || []).join('\n'), links: (p.links || []).join('\n'), attachments: (p.images || []).filter(function (u) { return u.indexOf('data:') === 0; }), scheduled_at: localInput(p.scheduled_at), published: p.published };
              ui.previewPost = null; refresh();
            }, 'btn-ghost'),
            btn(p.published ? t('unpublish') : t('publish'), function () {
              if (!guard()) return;
              var all = Data.getPosts(); all.forEach(function (x) { if (x.id === p.id) { x.published = !x.published; if (x.published) x.scheduled_at = null; } });
              if (!Data.savePosts(all)) { ctx.toast(t('storageFull')); return; }
              audit(p.published ? 'post.unpublish' : 'post.publish', 'post', p.id); applied();
            }, 'btn-ghost'),
            btn(t('del'), function () {
              if (!guard() || !confirm(t('confirmDelete'))) return;
              var r = Admin.trashPost(Data.getPosts(), Data.getList('trash'), p.id, me().id, new Date().toISOString(), Data.newId());
              if (!r.ok) return;
              if (!Data.savePosts(r.posts)) { ctx.toast(t('storageFull')); return; }
              Data.saveList('trash', r.trash, 100); Data.mirror('post_trash', r.trash[0]);
              audit('post.delete', 'post', p.id); applied(t('deleted'));
            }, 'btn-danger'))));
      });
      var trash = Data.getList('trash').filter(function (x) { return !x.restored_at; });
      out.push(sectionTitle(t('trash') + ' (' + trash.length + ')'));
      trash.forEach(function (x) {
        out.push(h('div', { class: 'panel !p-3 flex items-center justify-between gap-2' },
          h('div', { class: 'min-w-0 text-xs' }, h('div', { class: 'truncate', text: Core.cleanText(x.post && x.post.content, 60) || '—' }), h('div', { class: 'text-[10px] muted' }, ctx.fmtDate(x.deleted_at))),
          btn(t('restore'), function () {
            if (!guard()) return;
            var r = Admin.restorePost(Data.getPosts(), Data.getList('trash'), x.id, new Date().toISOString());
            if (!r.ok) return;
            if (!Data.savePosts(r.posts)) { ctx.toast(t('storageFull')); return; }
            Data.saveList('trash', r.trash, 100); audit('post.restore', 'post', x.original_post_id); applied(t('restored'));
          }, 'btn-ghost')));
      });
      return out;
    }

    /* ---------- TASKS ---------- */
    function tasksList() { var s = state(); return s.tasks || CFG.TASKS.map(function (x) { return Object.assign({ enabled: true }, x); }); }
    function saveTasks(list, action, id) { if (!guard()) return; var s = state(); s.tasks = list; if (commit(s)) { audit(action, 'task', id); applied(t('saved')); } }

    function tabTasks() {
      var list = tasksList(), stats = Data.taskStats(), users = Math.max(1, Data.localUsers().length);
      var out = [];
      list.forEach(function (task) {
        var rate = Math.min(100, Math.round(((stats[task.id] || 0) / users) * 100));
        var cb = h('input', { type: 'checkbox', class: 'w-4 h-4 accent-violet-500', 'aria-label': t('enabled') + ': ' + task.title, onchange: function () {
          saveTasks(list.map(function (x) { return x.id === task.id ? Object.assign({}, x, { enabled: cb.checked }) : x; }), 'task.toggle', task.id);
        } });
        cb.checked = task.enabled !== false;
        out.push(h('div', { class: 'panel !p-3 space-y-1' },
          h('div', { class: 'flex items-center justify-between gap-2' }, h('span', { class: 'text-sm font-bold break-words' }, task.title), cb),
          h('div', { class: 'text-[11px] muted' }, task.metric + ' ≥ ' + task.goal + ' · +' + (task.rewardXp || 0) + ' XP · +' + (task.rewardStars || 0) + ' ★'),
          h('div', { class: 'text-[11px] muted' }, t('completion') + ': ' + (stats[task.id] || 0) + ' (' + rate + '%)'),
          h('div', { class: 'flex gap-2' }, btn(t('edit'), function () { ui.editTask = Object.assign({}, task); refresh(); }, 'btn-ghost'),
            btn(t('del'), function () { if (confirm(t('confirmDelete'))) saveTasks(list.filter(function (x) { return x.id !== task.id; }), 'task.delete', task.id); }, 'btn-danger'))));
      });
      var e = ui.editTask || { id: '', title: '', desc: '', goal: 10, metric: 'xp_total', rewardXp: 0, rewardStars: 10, enabled: true };
      var title = input({ value: e.title, maxlength: '80', 'aria-label': t('name') }), desc = input({ value: e.desc || '', maxlength: '200', 'aria-label': t('desc') });
      var goal = numberInput(t('goal'), e.goal, '1', '1'), xp = numberInput(t('rewardXp'), e.rewardXp || 0, '1', '0'), stars = numberInput(t('rewardStars'), e.rewardStars || 0, '1', '0');
      var metric = h('select', { class: 'field', 'aria-label': t('metric') }, Admin.METRICS.map(function (m) { return h('option', { value: m }, m); }));
      metric.value = e.metric;
      out.push(sectionTitle(e.id ? t('edit') : t('add')));
      out.push(h('div', { class: 'panel space-y-2' }, field(t('name'), title), field(t('desc'), desc), field(t('metric'), metric),
        h('div', { class: 'grid grid-cols-3 gap-2' }, field(t('goal'), goal), field(t('rewardXp'), xp), field(t('rewardStars'), stars)),
        h('div', { class: 'flex gap-2' },
          btn(e.id ? t('savePost') : t('add'), function () {
            if (!guard()) return;
            var r = Admin.validateTask({ id: e.id || 'task_' + Data.newId(), title: title.value, desc: desc.value, goal: goal.value, metric: metric.value, rewardXp: xp.value, rewardStars: stars.value, enabled: e.enabled });
            if (!r.ok) { ctx.toast(t('invalid') + r.error); return; }
            var next = e.id ? list.map(function (x) { return x.id === e.id ? r.task : x; }) : list.concat([r.task]);
            ui.editTask = null; saveTasks(next, e.id ? 'task.update' : 'task.create', r.task.id);
          }, 'flex-1'),
          e.id ? btn(t('cancel'), function () { ui.editTask = null; refresh(); }, 'btn-ghost') : null,
          btn(t('reset'), function () { if (!guard() || !confirm(t('confirmDelete'))) return; var s = state(); s.tasks = null; commit(s); audit('task.reset', 'task', null); applied(t('saved')); }, 'btn-ghost'))));
      return out;
    }

    /* ---------- EVENTS ---------- */
    function eventsList() { return state().events || CFG.EVENTS.map(function (x) { return Object.assign({ starts_at: null, ends_at: null }, x); }); }
    function saveEvents(list, action, id) { if (!guard()) return; var s = state(); s.events = list; if (commit(s)) { audit(action, 'event', id); applied(t('saved')); } }
    function localInput(iso) {
      var d = new Date(iso);
      if (!iso || isNaN(d)) return '';
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }

    function tabEvents() {
      var list = eventsList(), out = [];
      list.forEach(function (ev) {
        out.push(h('div', { class: 'panel !p-3 space-y-1' },
          h('div', { class: 'flex items-center justify-between gap-2' }, h('span', { class: 'text-sm font-bold break-words' }, ev.title), badge(ev.live ? t('live') : t('upcoming'), ev.live ? 'bg-rose-600/30 text-rose-300' : '')),
          h('div', { class: 'text-[11px] muted' }, t('reward') + ': ' + ev.reward + (ev.starts_at ? ' · ' + ctx.fmtDate(ev.starts_at) : '') + (ev.ends_at ? ' → ' + ctx.fmtDate(ev.ends_at) : '')),
          h('div', { class: 'flex gap-2 flex-wrap' },
            btn(ev.live ? t('upcoming') : t('live'), function () { saveEvents(list.map(function (x) { return x.id === ev.id ? Object.assign({}, x, { live: !x.live }) : x; }), 'event.toggle', ev.id); }, 'btn-ghost'),
            btn(t('edit'), function () { ui.editEvent = Object.assign({}, ev); refresh(); }, 'btn-ghost'),
            btn(t('del'), function () { if (confirm(t('confirmDelete'))) saveEvents(list.filter(function (x) { return x.id !== ev.id; }), 'event.delete', ev.id); }, 'btn-danger'))));
      });
      var e = ui.editEvent || { id: '', title: '', desc: '', reward: '', live: false, starts_at: null, ends_at: null };
      var title = input({ value: e.title, maxlength: '80', 'aria-label': t('name') }), desc = input({ value: e.desc || '', maxlength: '200', 'aria-label': t('desc') }), reward = input({ value: e.reward || '', maxlength: '40', 'aria-label': t('reward') });
      var start = input({ type: 'datetime-local', 'aria-label': t('startsAt') }), end = input({ type: 'datetime-local', 'aria-label': t('endsAt') });
      start.value = localInput(e.starts_at); end.value = localInput(e.ends_at);
      var live = h('input', { type: 'checkbox', class: 'w-4 h-4 accent-violet-500', 'aria-label': t('live') }); live.checked = !!e.live;
      out.push(sectionTitle(e.id ? t('edit') : t('add')));
      out.push(h('div', { class: 'panel space-y-2' }, field(t('name'), title), field(t('desc'), desc), field(t('reward'), reward),
        h('div', { class: 'grid grid-cols-2 gap-2' }, field(t('startsAt'), start), field(t('endsAt'), end)),
        h('label', { class: 'flex items-center justify-between text-sm' }, t('live'), live),
        h('div', { class: 'flex gap-2' },
          btn(e.id ? t('savePost') : t('add'), function () {
            if (!guard()) return;
            var r = Admin.validateEvent({ id: e.id || 'event_' + Data.newId(), title: title.value, desc: desc.value, reward: reward.value, live: live.checked, starts_at: start.value, ends_at: end.value });
            if (!r.ok) { ctx.toast(t('invalid') + r.error); return; }
            var next = e.id ? list.map(function (x) { return x.id === e.id ? r.event : x; }) : list.concat([r.event]);
            ui.editEvent = null; saveEvents(next, e.id ? 'event.update' : 'event.create', r.event.id);
          }, 'flex-1'),
          e.id ? btn(t('cancel'), function () { ui.editEvent = null; refresh(); }, 'btn-ghost') : null,
          btn(t('reset'), function () { if (!guard() || !confirm(t('confirmDelete'))) return; var s = state(); s.events = null; commit(s); audit('event.reset', 'event', null); applied(t('saved')); }, 'btn-ghost'))));
      return out;
    }

    /* ---------- NOTIFICATIONS ---------- */
    function tabNotifications() {
      var n = ui.notifDraft, out = [];
      var title = input({ value: n.title, maxlength: '80', 'aria-label': t('msgTitle'), placeholder: t('msgTitle'), oninput: function () { n.title = title.value; } });
      var msg = h('textarea', { class: 'field', rows: '3', maxlength: '300', 'aria-label': t('msgBody'), placeholder: t('msgBody'), oninput: function () { n.message = msg.value; } }); msg.value = n.message;
      var link = input({ value: n.link, 'aria-label': t('msgLink'), placeholder: t('msgLink'), oninput: function () { n.link = link.value; } });
      var when = input({ type: 'datetime-local', 'aria-label': t('sendAt'), oninput: function () { n.scheduled_at = when.value; } }); when.value = n.scheduled_at;
      out.push(h('div', { class: 'panel space-y-2' }, title, msg, link, field(t('sendAt'), when),
        h('div', { class: 'flex gap-2' },
          btn([icon('fa-eye'), ' ' + t('preview')], function () { ui.notifPreview = !ui.notifPreview; refresh(); }, 'btn-ghost flex-1'),
          btn([icon('fa-paper-plane'), ' ' + (n.scheduled_at ? t('sendAt') : t('send'))], sendNotification, 'flex-1'))));
      if (ui.notifPreview) {
        var r = Admin.validateNotification(n);
        out.push(r.ok ? notifCard(r.notification) : h('p', { class: 'text-xs text-rose-300' }, t('invalid') + r.error));
      }
      out.push(sectionTitle(t('history')));
      var list = Data.getList('notifications');
      if (!list.length) out.push(h('p', { class: 'text-xs muted' }, t('noItems')));
      list.forEach(function (x) {
        var st = x.status === 'cancelled' ? 'cancelled' : Admin.notificationStatus(x);
        out.push(h('div', { class: 'panel !p-3 space-y-1' },
          h('div', { class: 'flex items-center justify-between gap-2' }, h('span', { class: 'text-sm font-bold break-words', text: x.title }), badge(t(st === 'scheduled' ? 'scheduled' : st === 'cancelled' ? 'cancelled' : 'sent'), st === 'sent' ? 'bg-emerald-600/30 text-emerald-300' : '')),
          h('p', { class: 'text-xs break-words', text: x.message }),
          h('div', { class: 'text-[10px] muted' }, (x.scheduled_at ? t('sendAt') + ': ' + ctx.fmtDate(x.scheduled_at) : t('sentAt') + ': ' + ctx.fmtDate(x.sent_at)) + ' · ' + t('delivered') + ': ' + (x.delivered_count || 0)),
          st === 'scheduled' ? btn(t('cancelNotif'), function () {
            if (!guard()) return;
            Data.saveList('notifications', Data.getList('notifications').map(function (y) { return y.id === x.id ? Object.assign({}, y, { status: 'cancelled' }) : y; }), 100);
            audit('notification.cancel', 'notification', x.id); applied();
          }, 'btn-ghost') : null));
      });
      return out;
    }

    function notifCard(n) {
      return h('div', { class: 'panel border-cyan-500/40 space-y-1' }, h('div', { class: 'text-sm font-bold', text: n.title }), h('p', { class: 'text-xs', text: n.message }),
        n.link ? h('span', { class: 'text-xs text-cyan-300 underline break-all' }, n.link) : null);
    }

    function sendNotification() {
      if (!guard()) return;
      if (Date.now() - ui.lastSend < 1500) { ctx.toast('…'); return; }
      var r = Admin.validateNotification(ui.notifDraft);
      if (!r.ok) { ctx.toast(t('invalid') + r.error); return; }
      ui.lastSend = Date.now();
      var now = new Date().toISOString();
      var row = Object.assign({ id: Data.newId(), status: 'sent', sent_at: Admin.notificationStatus(r.notification) === 'sent' ? now : null, delivered_count: 0, created_by: me().id }, r.notification);
      Data.saveList('notifications', [row].concat(Data.getList('notifications')), 100);
      Data.mirror('notifications', row);
      audit('notification.send', 'notification', row.id, { scheduled_at: row.scheduled_at });
      ui.notifDraft = { title: '', message: '', link: '', scheduled_at: '' }; ui.notifPreview = false;
      applied(row.scheduled_at && Admin.notificationStatus(row) === 'scheduled' ? t('scheduledOk') : t('sentOk'));
    }

    /* ---------- PHASES ---------- */
    function featureLabel(f) { return { chat: 'Chat', bonus: 'Bonusy', rig: 'Warsztat', wallet: 'Wallet', shop: 'Shop', airdrop: 'Airdrop' }[f]; }

    function deploy(n) {
      if (!guard()) return;
      if (!confirm(t('deployConfirm') + n + ' — ' + Admin.PHASES[n].name + t('deployConfirm2'))) return;
      Data.snapshot('before phase ' + n);
      var r = Admin.deployPhase(state(), n, { isAdmin: ctx.isAdmin(), adminId: me().id, now: new Date().toISOString(), id: Data.newId() });
      if (!r.ok) { ctx.toast(t('forbidden')); return; }
      if (!commit(r.state)) return;
      Data.saveList('phases', [r.record].concat(Data.getList('phases')), 50);
      Data.mirror('phases', r.record);
      audit('phase.deploy', 'phase', n, r.record.config);
      applied(t('deployed') + n);
    }

    function tabPhases() {
      var s = state(), out = [h('p', { class: 'text-xs muted' }, t('current') + ': ' + (s.phase ? s.phase + ' — ' + Admin.PHASES[s.phase].name : t('none')))];
      [1, 2, 3].forEach(function (n) {
        var ph = Admin.PHASES[n];
        out.push(h('div', { class: 'panel space-y-2' + (s.phase === n ? ' border-emerald-500/60' : '') },
          h('div', { class: 'flex items-center justify-between' }, h('h3', { class: 'font-bold text-sm' }, 'Faza ' + n + ' — ' + ph.name), s.phase === n ? badge(t('current'), 'bg-emerald-600/30 text-emerald-300') : null),
          h('ul', { class: 'text-xs grid grid-cols-2 gap-1' }, Admin.FEATURES.map(function (f) {
            return h('li', { class: ph.features[f] ? 'text-emerald-300' : 'text-slate-500' }, (ph.features[f] ? '✅ ' : '❌ ') + featureLabel(f));
          })),
          btn(t('deploy') + n, function () { deploy(n); }, 'phase-btn w-full')));
      });
      out.push(sectionTitle(t('history')));
      var hist = Data.getList('phases');
      if (!hist.length) out.push(h('p', { class: 'text-xs muted' }, t('noItems')));
      hist.slice(0, 10).forEach(function (p) { out.push(h('div', { class: 'text-xs flex justify-between border-b border-slate-800/70 py-1' }, h('span', {}, 'Faza ' + p.number + ' — ' + p.name), h('span', { class: 'muted' }, ctx.fmtDate(p.deployed_at)))); });
      return out;
    }

    /* ---------- SETTINGS ---------- */
    function download(name, obj) {
      var url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })), a = h('a', { href: url, download: name });
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function tabSettings() {
      var s = state(), c = Admin.effectiveConfig(s), out = [];
      out.push(sectionTitle(t('flags')));
      out.push(h('div', { class: 'panel' }, Admin.FEATURES.map(function (f) {
        var cb = h('input', { type: 'checkbox', class: 'w-4 h-4 accent-violet-500', 'aria-label': featureLabel(f), onchange: function () {
          if (!guard()) return;
          var r = Admin.setFlag(state(), f, cb.checked, { isAdmin: ctx.isAdmin() });
          if (r.ok && commit(r.state)) { audit('flag.set', 'feature', f, { value: cb.checked }); applied(t('saved')); }
        } });
        cb.checked = s.flags[f] !== false;
        return h('label', { class: 'flex items-center justify-between text-sm py-1.5' }, featureLabel(f), cb);
      })));

      var speed = input({ type: 'range', min: '0.25', max: '3', step: '0.25', 'aria-label': t('animation'), value: String(c.animationSpeed) });
      var dbg = h('input', { type: 'checkbox', class: 'w-4 h-4 accent-violet-500', 'aria-label': t('debug') }); dbg.checked = c.debug;
      var mult = numberInput(t('xpMult'), c.xpMultiplier, '0.1', '0.5', '2'), scale = numberInput(t('refScale'), (s.config && s.config.referral_scale) || 1, '0.1', '0.1', '10');
      var hours = numberInput(t('timerHours'), c.xpTimerHours, '1', '1', '48'), tReward = numberInput(t('timerReward'), c.xpTimerReward, '1', '0'), daily = numberInput(t('dailyReward'), c.dailyReward, '1', '0');
      var refBase = (s.config && s.config.referral_rewards) || Admin.DEFAULT_CONFIG.referral_rewards;
      var refs = CFG.REFERRAL_MILESTONES.map(function (m, i) { return numberInput(m.count + '', refBase[i], '1', '0'); });
      var prices = CFG.RIG_PARTS.filter(function (p) { return p.key !== 'desk'; }).map(function (p) { return { key: p.key, title: p.title, el: numberInput(p.title, c.rigPrices[p.key], '1', '0') }; });
      var ck = c.clicks, cs = { small: numberInput('100', ck.small, '1', '1'), smallXp: numberInput('XP', ck.smallXp, '1', '0'), big: numberInput('1000', ck.big, '1', '1'), bigXp: numberInput('XP', ck.bigXp, '1', '0'), special: numberInput('10000', ck.special, '1', '1') };
      var pool = numberInput(t('airdropPool'), c.airdropPool, '1', '0'), rate = numberInput(t('airdropRate'), c.airdropRate, '1', '1');

      out.push(sectionTitle(t('animation') + ' / ' + t('debug')));
      out.push(h('div', { class: 'panel space-y-2' }, field(t('animation') + ' ×' + c.animationSpeed, speed), h('label', { class: 'flex items-center justify-between text-sm' }, t('debug'), dbg)));
      out.push(sectionTitle(t('balance')));
      out.push(h('div', { class: 'panel space-y-2' },
        h('div', { class: 'grid grid-cols-2 gap-2' }, field(t('xpMult'), mult), field(t('refScale'), scale), field(t('timerHours'), hours), field(t('timerReward'), tReward), field(t('dailyReward'), daily)),
        field(t('refRewards'), h('div', { class: 'grid grid-cols-3 gap-2' }, refs)),
        field(t('rigPrices'), h('div', { class: 'grid grid-cols-3 gap-2' }, prices.map(function (p) { return field(p.title, p.el); }))),
        field(t('clicker'), h('div', { class: 'grid grid-cols-5 gap-1' }, [cs.small, cs.smallXp, cs.big, cs.bigXp, cs.special])),
        h('div', { class: 'text-[10px] muted' }, '100 → XP · 1000 → XP + loot box · 10000 → achievement'),
        h('h4', { class: 'font-bold text-xs text-amber-300' }, t('airdrop')), h('div', { class: 'grid grid-cols-2 gap-2' }, field(t('airdropPool'), pool), field(t('airdropRate'), rate)),
        btn(t('saveBalance'), function () {
          if (!guard()) return;
          var cur = state();
          cur.config = Object.assign({}, cur.config, {
            animation_speed: Number(speed.value), debug: dbg.checked, xp_multiplier: Number(mult.value), referral_scale: Number(scale.value),
            xp_timer_hours: Number(hours.value), xp_timer_reward: Number(tReward.value), daily_reward: Number(daily.value),
            referral_rewards: refs.map(function (r) { return Number(r.value); }),
            rig_prices: prices.reduce(function (o, p) { o[p.key] = Number(p.el.value); return o; }, {}),
            click_thresholds: { small: Number(cs.small.value), smallXp: Number(cs.smallXp.value), big: Number(cs.big.value), bigXp: Number(cs.bigXp.value), special: Number(cs.special.value) },
            airdrop_pool: Number(pool.value), airdrop_rate: Number(rate.value)
          });
          if (commit(cur)) { audit('config.update', 'config', null, cur.config); applied(t('saved')); }
        }, 'w-full')));

      var soc = Admin.resolveSocialLinks(s), socIn = {};
      Admin.SOCIAL_KEYS.forEach(function (k) { socIn[k] = input({ type: 'url', inputmode: 'url', placeholder: 'https://…', value: soc[k], 'aria-label': 'Link: ' + k, maxlength: '500' }); });
      out.push(sectionTitle(t('socialTitle')));
      out.push(h('div', { class: 'panel space-y-2' },
        h('div', { class: 'text-[10px] muted' }, t('socialHint')),
        Admin.SOCIAL_KEYS.map(function (k) { return field(k, socIn[k]); }),
        btn(t('socialSave'), function () {
          if (!guard()) return;
          var raw = {}; Admin.SOCIAL_KEYS.forEach(function (k) { raw[k] = socIn[k].value; });
          var r = Admin.validateSocialLinks(raw);
          if (!r.ok) { ctx.toast(t('socialInvalid') + r.invalid.join(', ')); return; }
          var cur = state();
          cur.config = Object.assign({}, cur.config, { social_links: r.links });
          if (commit(cur)) { audit('config.social', 'config', null, r.links); applied(t('saved')); }
        }, 'w-full')));

      out.push(sectionTitle(t('supabase')));
      out.push(h('div', { class: 'panel space-y-2' },
        h('div', { class: 'text-xs' }, t('connStatus') + ': ' + (Data.remoteEnabled ? t('connOn') : t('connOff'))),
        h('div', { class: 'flex gap-2' },
          btn(t('testConn'), function () { Data.testConnection().then(function (r) { ctx.toast(r.ok ? t('connOk') + ' (' + r.ms + ' ms)' : t('connFail') + r.reason); }); }, 'btn-ghost flex-1'),
          btn(t('schema'), function () { Data.validateSchema().then(function (r) { ctx.toast(r.ok ? t('schemaOk') : r.reason === 'not_configured' ? t('connOff') : t('schemaMissing') + r.missing.join(', ')); }); }, 'btn-ghost flex-1'))));

      var fileIn = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden', 'aria-label': t('import'), onchange: function () { importFile(fileIn.files[0]); } });
      out.push(sectionTitle(t('backup')));
      out.push(h('div', { class: 'panel space-y-2' }, fileIn,
        h('div', { class: 'flex gap-2' },
          btn([icon('fa-download'), ' ' + t('export')], function () { if (guard()) { download('technixpro-backup-' + new Date().toISOString().slice(0, 10) + '.json', Data.exportBackup()); audit('backup.export', 'backup', null); } }, 'btn-ghost flex-1'),
          btn([icon('fa-upload'), ' ' + t('import')], function () { fileIn.click(); }, 'btn-ghost flex-1')),
        h('div', { class: 'flex items-center justify-between' }, h('span', { class: 'text-xs font-bold' }, t('versions')),
          btn(t('snapshot'), function () { if (!guard()) return; Data.snapshot('manual'); audit('backup.snapshot', 'backup', null); applied(t('saved')); }, 'btn-ghost')),
        Data.getList('history').map(function (v) {
          return h('div', { class: 'flex items-center justify-between text-xs border-b border-slate-800/70 py-1' }, h('span', {}, ctx.fmtDate(v.created_at) + ' · ' + v.label),
            btn(t('restoreVer'), function () {
              if (!guard() || !confirm(t('importConfirm'))) return;
              Data.snapshot('before restore');
              var r = Data.importBackup(v.data);
              if (r.ok) { audit('backup.restore', 'backup', v.id); applied(t('restored')); } else ctx.toast(t('importBad'));
            }, 'btn-ghost'));
        })));

      out.push(sectionTitle(t('audit')));
      var log = Data.getList('audit').slice(0, 10);
      out.push(h('div', { class: 'panel space-y-1' }, log.length ? log.map(function (a) {
        return h('div', { class: 'text-[11px] flex justify-between gap-2' }, h('span', { class: 'break-all' }, a.action + (a.entity_id ? ' · ' + a.entity_id : '')), h('span', { class: 'muted whitespace-nowrap' }, ctx.fmtDate(a.timestamp)));
      }) : h('p', { class: 'text-xs muted' }, t('noItems'))));
      return out;
    }

    function importFile(f) {
      if (!guard() || !f) return;
      if (f.size > 4 * 1024 * 1024) { ctx.toast(t('importBad')); return; }
      var reader = new FileReader();
      reader.onload = function () {
        var obj; try { obj = JSON.parse(String(reader.result)); } catch (e) { ctx.toast(t('importBad')); return; }
        if (!Admin.validateBackup(obj).ok) { ctx.toast(t('importBad')); return; }
        if (!guard() || !confirm(t('importConfirm'))) return;
        Data.snapshot('before import');
        if (Data.importBackup(obj).ok) { audit('backup.import', 'backup', null); applied(t('restored')); }
      };
      reader.readAsText(f);
    }

    /* ---------- STATS ---------- */
    function tabStats() {
      var st = Admin.computeStats({ users: Data.localUsers(), activity: Data.activity(), transactions: Data.localTransactions(), taskStats: Data.taskStats(), phases: Data.getList('phases'), online: Data.onlineUsers(me()) });
      function box(label, value) { return h('div', { class: 'panel text-center !p-3' }, h('div', { class: 'text-lg font-black text-white' }, String(value)), h('div', { class: 'text-[10px] muted' }, label)); }
      var taskNames = {}; tasksList().forEach(function (x) { taskNames[x.id] = x.title; });
      return [
        h('div', { class: 'grid grid-cols-3 gap-2' }, box(t('online'), st.online), box(t('active24'), st.active24h), box(t('active7'), st.active7d)),
        h('div', { class: 'grid grid-cols-3 gap-2' }, box(t('users'), st.users), box(t('avgXp'), ctx.fmt(st.avgXp)), box(t('tasksDone'), st.tasksCompleted)),
        h('div', { class: 'grid grid-cols-3 gap-2' }, box(t('referrals'), st.referrals), box(t('totalXp'), ctx.fmt(st.totalXp)), box(t('avgBalance'), ctx.fmt(st.avgBalance))),
        h('div', { class: 'grid grid-cols-2 gap-2' }, box(t('txVolume'), ctx.fmt(st.txVolume)), box(t('adoption'), st.adoption + '%')),
        h('div', { class: 'panel space-y-1' }, h('h3', { class: 'font-bold text-sm' }, t('topTasks')),
          st.topTasks.length ? st.topTasks.map(function (x) { return h('div', { class: 'flex justify-between text-xs' }, h('span', { text: taskNames[x.id] || x.id }), h('b', {}, String(x.count))); }) : h('p', { class: 'text-xs muted' }, t('noItems'))),
        h('div', { class: 'panel text-xs' }, t('lastPhase') + ': ' + (st.lastPhase ? 'Faza ' + st.lastPhase.number + ' · ' + ctx.fmtDate(st.lastPhase.deployed_at) : '—')),
        h('p', { class: 'text-[10px] muted' }, t('statsNote'))
      ];
    }

    return { open: open, close: close, refresh: refresh, isOpen: function () { return !!overlay; } };
  }

  window.TPAdminUI = { create: create };
})();
