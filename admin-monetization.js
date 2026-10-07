// Admin tab "Monetyzacja": sponsors (CRUD + preview), premium cosmetic packs, monthly analytics + CSV export. Mounted by admin-ui.js.
(function () {
  'use strict';
  var CFG = window.TP_CONFIG, E = window.TPEngage, Data = window.TPData;

  var L = {
    pl: {
      sponsors: 'Sponsorzy', name: 'Nazwa sponsora', logo: 'Logo — URL (opcjonalnie)', link: 'Link sponsora', start: 'Początek', end: 'Koniec', save: 'Zapisz sponsora', update: 'Zapisz zmiany', cancel: 'Anuluj', edit: 'Edytuj', del: 'Usuń',
      confirmDel: 'Usunąć? Tej operacji nie można cofnąć.', preview: 'Podgląd (tak zobaczą to użytkownicy)', saved: 'Zapisano.', deleted: 'Usunięto.', none: 'Brak wpisów.',
      err_name: 'Podaj nazwę.', err_link: 'Niepoprawny link (http/https).', err_logo: 'Niepoprawny URL logo.', err_start: 'Niepoprawna data początku.', err_end: 'Niepoprawna data końca.', err_range: 'Koniec przed początkiem.',
      active: 'Aktywny', inactive: 'Poza okresem', posts: 'Posty sponsorowane', noSponsor: '— bez sponsora —', postsNote: 'Każdy oznaczony post pokazuje „Wspierane przez [Sponsor]”.',
      packs: 'Pakiety kosmetyczne', packName: 'Nazwa pakietu', packType: 'Typ', packCfg: 'Konfiguracja JSON, np. {"color":"#22d3ee"}', border: 'Ramka awatara', theme: 'Motyw profilu', bubble: 'Dymek czatu', addPack: 'Dodaj pakiet', builtin: 'wbudowany',
      err_type: 'Niepoprawny typ.', err_config: 'Niepoprawny JSON konfiguracji.', packsNote: 'Tylko kosmetyka — bez przewagi w grze. Pakiety zapisane w konfiguracji admina (PREMIUM_COSMETICS).',
      analytics: 'Analityka miesięczna', month: 'Miesiąc (RRRR-MM)', dau: 'Dzienni aktywni użytkownicy', retention: 'Retencja', cohort: 'Kohorta', retained: 'Wróciło', exportAnalytics: 'Eksportuj analitykę CSV', exportSponsors: 'Eksportuj raport sponsorów CSV',
      health: 'Stan aplikacji (tylko agregaty)', users: 'Użytkownicy', milestones: 'Odblokowane kamienie milowe', exported: 'Wyeksportowano.', badMonth: 'Niepoprawny miesiąc.', exports: 'Ostatnie eksporty',
      roi: 'ROI sponsora', note: 'Dane agregowane z tego urządzenia — bez śledzenia pojedynczych użytkowników.', pass: 'Karnet miesięczny (PLN)'
    },
    en: {
      sponsors: 'Sponsors', name: 'Sponsor name', logo: 'Logo URL (optional)', link: 'Sponsor link', start: 'Start', end: 'End', save: 'Save sponsor', update: 'Save changes', cancel: 'Cancel', edit: 'Edit', del: 'Delete',
      confirmDel: 'Delete? This cannot be undone.', preview: 'Preview (what users will see)', saved: 'Saved.', deleted: 'Deleted.', none: 'No entries.',
      err_name: 'Enter a name.', err_link: 'Invalid link (http/https).', err_logo: 'Invalid logo URL.', err_start: 'Invalid start date.', err_end: 'Invalid end date.', err_range: 'End is before start.',
      active: 'Active', inactive: 'Out of period', posts: 'Sponsored posts', noSponsor: '— no sponsor —', postsNote: 'Every labelled post shows “Wspierane przez [Sponsor]”.',
      packs: 'Cosmetic packs', packName: 'Pack name', packType: 'Type', packCfg: 'Config JSON, e.g. {"color":"#22d3ee"}', border: 'Avatar border', theme: 'Profile theme', bubble: 'Chat bubble', addPack: 'Add pack', builtin: 'built-in',
      err_type: 'Invalid type.', err_config: 'Invalid config JSON.', packsNote: 'Cosmetics only — no gameplay advantage. Packs live in the admin config (PREMIUM_COSMETICS).',
      analytics: 'Monthly analytics', month: 'Month (YYYY-MM)', dau: 'Daily active users', retention: 'Retention', cohort: 'Cohort', retained: 'Returned', exportAnalytics: 'Export analytics CSV', exportSponsors: 'Export sponsor report CSV',
      health: 'App health (aggregates only)', users: 'Users', milestones: 'Unlocked milestones', exported: 'Exported.', badMonth: 'Invalid month.', exports: 'Recent exports',
      roi: 'Sponsor ROI', note: 'Aggregated from this device — no tracking of individual users.', pass: 'Monthly pass (PLN)'
    }
  };

  function create(x) {
    var h = x.h, icon = x.icon;
    var ui = { sponsor: blank(), month: new Date().toISOString().slice(0, 7), packType: 'border' };
    function t(k) { return (L[x.lang()] || L.pl)[k] || L.pl[k] || k; }
    function blank() { return { id: null, name: '', logo_url: '', link: '', start_date: '', end_date: '' }; }
    function day(iso) { return iso ? String(iso).slice(0, 10) : ''; }

    /* ---------- sponsors ---------- */
    function saveSponsor() {
      if (!x.guard()) return;
      var d = ui.sponsor;
      var v = E.validateSponsor({ id: d.id, name: d.name, logo_url: d.logo_url, link: d.link, start_date: d.start_date, end_date: d.end_date ? d.end_date + 'T23:59:59.999Z' : '', created_by: x.me().id });
      if (!v.ok) { x.toast(t('err_' + v.errors[0])); return; }
      var list = Data.getList('sponsors'), s = v.sponsor;
      if (s.id) list = list.map(function (o) { return o.id === s.id ? Object.assign({}, o, s, { created_by: o.created_by }) : o; });
      else { s.id = Data.newId(); list = [s].concat(list); }
      Data.saveList('sponsors', list, 100);
      Data.mirror('sponsors', s);
      x.audit(d.id ? 'sponsor.update' : 'sponsor.create', 'sponsor', s.id);
      ui.sponsor = blank(); x.applied(t('saved'));
    }
    function deleteSponsor(s) {
      if (!x.guard() || !confirm(t('confirmDel'))) return;
      Data.saveList('sponsors', Data.getList('sponsors').filter(function (o) { return o.id !== s.id; }));
      Data.savePosts(Data.getPosts().map(function (p) { if (p.sponsor_id !== s.id) return p; var c = Object.assign({}, p); delete c.sponsor_id; return c; }));
      x.audit('sponsor.delete', 'sponsor', s.id);
      x.applied(t('deleted'));
    }
    function sponsorPreview(s) {
      return h('div', { class: 'panel space-y-1 border-cyan-500/40' }, h('div', { class: 'text-[10px] muted' }, t('preview')),
        h('a', { class: 'sponsor-badge', href: s.link || '#', target: '_blank', rel: 'noopener noreferrer sponsored' },
          s.logo_url && window.TPCore.safeUrl(s.logo_url) ? h('img', { src: s.logo_url, alt: '', referrerpolicy: 'no-referrer' }) : icon('fa-handshake'), E.disclosure({ name: s.name || '…' })));
    }
    function sponsorForm() {
      var d = ui.sponsor;
      function bind(label, key, type) { var el = x.input({ type: type || 'text', 'aria-label': label, value: d[key] || '', oninput: function () { d[key] = el.value; } }); return x.field(label, el); }
      var form = h('div', { class: 'panel space-y-2' },
        bind(t('name'), 'name'), bind(t('link'), 'link', 'url'), bind(t('logo'), 'logo_url', 'url'), bind(t('start'), 'start_date', 'date'), bind(t('end'), 'end_date', 'date'),
        d.name || d.link ? sponsorPreview(d) : null,
        h('div', { class: 'flex gap-2' }, x.btn(d.id ? t('update') : t('save'), saveSponsor, 'flex-1'), d.id ? x.btn(t('cancel'), function () { ui.sponsor = blank(); x.refresh(); }, 'btn-ghost') : null));
      return form;
    }
    function sponsorList() {
      var list = Data.getList('sponsors');
      if (!list.length) return h('p', { class: 'text-xs muted' }, t('none'));
      return list.map(function (s) {
        var on = E.sponsorActive(s, Date.now());
        return h('div', { class: 'panel flex items-center gap-2 text-xs' },
          h('div', { class: 'flex-1 min-w-0' }, h('div', { class: 'font-bold truncate', text: s.name }), h('div', { class: 'muted' }, day(s.start_date) + ' → ' + day(s.end_date))),
          x.badge(on ? t('active') : t('inactive'), on ? 'bg-emerald-500/20 text-emerald-300' : null),
          x.btn(icon('fa-pen'), function () { ui.sponsor = { id: s.id, name: s.name, logo_url: s.logo_url, link: s.link, start_date: day(s.start_date), end_date: day(s.end_date) }; x.refresh(); }, 'btn-ghost', { 'aria-label': t('edit') + ': ' + s.name }),
          x.btn(icon('fa-trash'), function () { deleteSponsor(s); }, 'btn-danger', { 'aria-label': t('del') + ': ' + s.name }));
      });
    }
    function postAssign() {
      var sponsors = Data.getList('sponsors');
      var posts = Data.getPosts().slice().sort(function (a, b) { return Date.parse(b.created_at) - Date.parse(a.created_at); }).slice(0, 8);
      return h('div', { class: 'panel space-y-2' }, h('div', { class: 'text-xs font-bold' }, t('posts')),
        posts.length ? posts.map(function (p) {
          var sel = h('select', { class: 'field', 'aria-label': t('posts') + ': ' + String(p.content || '').slice(0, 30), onchange: function () {
            if (!x.guard()) return;
            Data.savePosts(Data.getPosts().map(function (o) { if (o.id !== p.id) return o; var c = Object.assign({}, o); if (sel.value) c.sponsor_id = sel.value; else delete c.sponsor_id; return c; }));
            x.audit('post.sponsor', 'post', p.id, { sponsor_id: sel.value || null }); x.applied(t('saved'));
          } }, h('option', { value: '' }, t('noSponsor')), sponsors.map(function (s) { return h('option', { value: s.id, text: s.name }); }));
          sel.value = p.sponsor_id || '';
          return h('div', { class: 'space-y-1' }, h('div', { class: 'text-[11px] truncate', text: String(p.content || '—').slice(0, 60) }), sel);
        }) : h('p', { class: 'text-xs muted' }, t('none')),
        h('p', { class: 'text-[10px] muted' }, t('postsNote')));
    }

    /* ---------- cosmetic packs ---------- */
    function packs() {
      var typeSel = h('select', { class: 'field', 'aria-label': t('packType') }, E.COSMETIC_TYPES.map(function (k) { return h('option', { value: k, text: t(k) }); }));
      var nameEl = x.input({ type: 'text', 'aria-label': t('packName'), placeholder: t('packName'), maxlength: '40' });
      var cfgEl = x.input({ type: 'text', 'aria-label': t('packCfg'), placeholder: t('packCfg'), value: '{}' });
      var custom = Data.getList('cosmetics');
      function add() {
        if (!x.guard()) return;
        var v = E.validateCosmetic({ name: nameEl.value, type: typeSel.value, config: cfgEl.value || '{}' });
        if (!v.ok) { x.toast(t('err_' + v.error)); return; }
        v.cosmetic.id = Data.newId();
        Data.saveList('cosmetics', [v.cosmetic].concat(Data.getList('cosmetics')), 50);
        Data.mirror('premium_cosmetics', { id: v.cosmetic.id, name: v.cosmetic.name, type: v.cosmetic.type, config: v.cosmetic.config });
        x.audit('cosmetic.create', 'cosmetic', v.cosmetic.id); x.applied(t('saved'));
      }
      return [
        h('div', { class: 'panel space-y-2' }, x.field(t('packName'), nameEl), x.field(t('packType'), typeSel), x.field(t('packCfg'), cfgEl), x.btn(t('addPack'), add, 'w-full')),
        h('div', { class: 'panel space-y-1 text-xs' }, CFG.PREMIUM_COSMETICS.map(function (c) { return h('div', { class: 'flex justify-between' }, h('span', { text: c.name + ' · ' + t(c.type) }), x.badge(t('builtin'))); }),
          custom.map(function (c) {
            return h('div', { class: 'flex justify-between items-center' }, h('span', { text: c.name + ' · ' + t(c.type) }),
              x.btn(icon('fa-trash'), function () { if (!x.guard() || !confirm(t('confirmDel'))) return; Data.saveList('cosmetics', Data.getList('cosmetics').filter(function (o) { return o.id !== c.id; })); x.audit('cosmetic.delete', 'cosmetic', c.id); x.applied(t('deleted')); }, 'btn-danger', { 'aria-label': t('del') + ': ' + c.name }));
          })),
        h('p', { class: 'text-[10px] muted' }, t('packsNote') + ' ' + t('pass') + ': ' + CFG.PREMIUM_PASS.price_pln.toFixed(2))
      ];
    }

    /* ---------- analytics ---------- */
    function monthOk() { return /^\d{4}-(0[1-9]|1[0-2])$/.test(ui.month); }
    function download(name, csv, type) {
      if (!x.guard()) return;
      if (!monthOk()) { x.toast(t('badMonth')); return; }
      var url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
      var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      var rec = { id: Data.newId(), admin_id: x.me().id, type: type, file_url: name, created_at: new Date().toISOString() };
      Data.saveList('exports', [rec].concat(Data.getList('exports')), 20);
      Data.mirror('analytics_exports', rec);
      x.audit('export.' + type, 'export', rec.id);
      x.applied(t('exported'));
    }
    function sponsorStats() {
      var stats = E.sponsorPostStats(Data.getPosts(), ui.month), act = Data.activity(), active = Object.keys(act).filter(function (id) { return String(act[id]).slice(0, 7) === ui.month; }).length;
      Object.keys(stats).forEach(function (k) { stats[k].activeUsers = active; });
      return stats;
    }
    function analytics() {
      var monthEl = x.input({ type: 'text', 'aria-label': t('month'), value: ui.month, maxlength: '7', placeholder: 'YYYY-MM', onchange: function () { ui.month = monthEl.value.trim(); x.refresh(); } });
      var users = Data.localUsers(), act = Data.activity(), ok = monthOk();
      var dau = ok ? E.dailyActive(act, ui.month) : [], ret = ok ? E.retention(users, act, ui.month) : { cohort: 0, retained: 0, percent: 0 };
      var sponsors = Data.getList('sponsors'), stats = ok ? sponsorStats() : {};
      function box(label, value) { return h('div', { class: 'panel text-center !p-3' }, h('div', { class: 'text-lg font-black text-white' }, String(value)), h('div', { class: 'text-[10px] muted' }, label)); }
      var unlocked = (Data.getStore('milestones', []) || []).filter(function (m) { return m.unlocked_at; }).length;
      return [
        x.field(t('month'), monthEl),
        h('div', { class: 'grid grid-cols-3 gap-2' }, box(t('users'), users.length), box(t('retention'), ret.percent + '%'), box(t('milestones'), unlocked)),
        h('div', { class: 'panel space-y-1 text-xs' }, h('div', { class: 'font-bold' }, t('dau')),
          dau.length ? dau.map(function (r) { return h('div', { class: 'flex justify-between' }, h('span', {}, r[0]), h('b', {}, String(r[1]))); }) : h('div', { class: 'muted' }, t('none')),
          h('div', { class: 'muted' }, t('cohort') + ': ' + ret.cohort + ' · ' + t('retained') + ': ' + ret.retained)),
        h('div', { class: 'panel space-y-1 text-xs' }, h('div', { class: 'font-bold' }, t('roi')),
          sponsors.length ? sponsors.map(function (s) { var st = stats[s.id] || {}; return h('div', { class: 'flex justify-between' }, h('span', { text: s.name }), h('b', {}, (st.posts || 0) + ' / ' + (st.likes || 0) + ' ♥ / ' + (st.comments || 0) + ' 💬')); }) : h('div', { class: 'muted' }, t('none'))),
        h('div', { class: 'flex gap-2' },
          x.btn(t('exportAnalytics'), function () { download('analytics-' + ui.month + '.csv', E.analyticsCsv(ui.month, users, act), 'analytics'); }, 'flex-1'),
          x.btn(t('exportSponsors'), function () { download('sponsors-' + ui.month + '.csv', E.sponsorReportCsv(sponsors, ui.month, stats), 'sponsors'); }, 'flex-1')),
        h('div', { class: 'panel space-y-1 text-[11px]' }, h('div', { class: 'font-bold' }, t('exports')),
          Data.getList('exports').slice(0, 5).map(function (r) { return h('div', { class: 'flex justify-between' }, h('span', { text: r.file_url }), h('span', { class: 'muted' }, x.fmtDate(r.created_at))); })),
        h('p', { class: 'text-[10px] muted' }, t('note'))
      ];
    }

    function render() {
      return [x.sectionTitle(t('sponsors')), sponsorForm(), sponsorList(), postAssign(), x.sectionTitle(t('packs')), packs(), x.sectionTitle(t('analytics')), analytics()];
    }
    return { render: render };
  }

  window.TPAdminMonet = { create: create };
})();
