// Fair-engagement UI (streak, weekly leaderboard, community milestones, sponsor disclosure, premium cosmetics UI, community links). Mounted by app.js.
(function () {
  'use strict';
  var CFG = window.TP_CONFIG, E = window.TPEngage, Core = window.TPCore, Data = window.TPData, FX = window.TPEffects;

  var L = {
    pl: {
      streak: 'Seria logowań', days: 'dni', best: 'Rekord', streakNote: 'Bez przypomnień push — seria po prostu zaczyna się od nowa, gdy zrobisz przerwę.', streakBonus: 'Bonus za serię: +', next: 'Kolejny bonus za ', daysLeft: ' dni',
      board: 'Ranking tygodniowy', thisWeek: 'Ten tydzień', lastWeek: 'Poprzedni tydzień', boardNote: 'Co poniedziałek wszyscy startują od zera.', noRows: 'Brak wyników.', pts: 'XP',
      together: 'Razem zebraliśmy', milestones: 'Wspólne kamienie milowe', unlocked: 'Odblokowano', milestoneBanner: 'Wspólny sukces! ', dismiss: 'Zamknij',
      cooldown: 'Zbyt szybka aktywność — krótka przerwa, spróbuj za chwilę.',
      sponsor: 'Wspierane przez', sponsorOpen: 'Otwórz stronę sponsora',
      premium: 'Premium (kosmetyki)', passInfo: 'Karnet miesięczny 9,99 zł: kosmetyki, brak banerów, wcześniejszy dostęp do eventów. Bez przewagi w grze.', premiumOn: 'Włącz Premium (podgląd)', premiumOff: 'Wyłącz Premium', premiumUiOnly: 'Tylko interfejs — brak weryfikacji płatności po stronie serwera.',
      showBadge: 'Pokaż odznakę Premium', badge: 'Premium', none: '— brak —', border: 'Ramka awatara', theme: 'Motyw profilu', bubble: 'Dymek czatu',
      charterTitle: 'Nasze wartości', charter: 'TechnixPro stawia na uczciwość i zrównoważony rozwój: bez ciemnych wzorców, bez płatnych przewag, z jasnym oznaczaniem sponsorów.',
      roadmap: 'Mapa drogowa', feedback: 'Coś Ci się nie podoba? Powiedz nam', discord: 'Połącz Discord (WhiteList)', soon: 'Link wkrótce', community: 'Społeczność',
      tab: 'Razem'
    },
    en: {
      streak: 'Login streak', days: 'days', best: 'Best', streakNote: 'No push reminders — the streak simply restarts after a break.', streakBonus: 'Streak bonus: +', next: 'Next bonus at ', daysLeft: ' days',
      board: 'Weekly leaderboard', thisWeek: 'This week', lastWeek: 'Last week', boardNote: 'Everyone starts from zero every Monday.', noRows: 'No results yet.', pts: 'XP',
      together: 'Together we earned', milestones: 'Community milestones', unlocked: 'Unlocked', milestoneBanner: 'Shared win! ', dismiss: 'Dismiss',
      cooldown: 'Activity too fast — short break, try again in a moment.',
      sponsor: 'Supported by', sponsorOpen: 'Open sponsor website',
      premium: 'Premium (cosmetics)', passInfo: 'Monthly pass 9.99 PLN: cosmetics, no banners, early event access. No gameplay advantage.', premiumOn: 'Enable Premium (preview)', premiumOff: 'Disable Premium', premiumUiOnly: 'UI only — no server-side payment verification yet.',
      showBadge: 'Show Premium badge', badge: 'Premium', none: '— none —', border: 'Avatar border', theme: 'Profile theme', bubble: 'Chat bubble',
      charterTitle: 'Our values', charter: 'TechnixPro is built on fairness and sustainability: no dark patterns, no pay-to-win, sponsors always clearly labelled.',
      roadmap: 'Roadmap', feedback: 'Not happy with something? Tell us', discord: 'Connect Discord (WhiteList)', soon: 'Link coming soon', community: 'Community',
      tab: 'Together'
    }
  };
  var MILESTONE_NAMES = { pl: { total_xp: 'XP razem', users: 'użytkowników' }, en: { total_xp: 'XP together', users: 'users' } };

  function create(ctx) {
    var h = ctx.h, icon = ctx.icon;
    var me = function () { return ctx.me(); };
    var ui = { board: 'now', banners: [], streak: null, rotated: false, sponsorSeen: {} };
    function t(k) { return (L[ctx.lang()] || L.pl)[k] || L.pl[k] || k; }
    function now() { return new Date().toISOString(); }

    /* ---------- data ---------- */
    function rankedUsers() {
      return Data.localUsers().filter(function (u) { return !(u.settings && u.settings.privacy && u.settings.privacy.show_in_ranking === false); });
    }
    function totals() {
      var users = Data.localUsers();
      return { total_xp: users.reduce(function (a, u) { return a + (Number(u.xp_total) || 0); }, 0), users: users.length };
    }
    function cosmetics() {
      var seen = {}, out = [];
      CFG.PREMIUM_COSMETICS.concat(Data.getList('cosmetics')).forEach(function (c) { if (c && c.id && !seen[c.id]) { seen[c.id] = 1; out.push(c); } });
      return out;
    }
    function premium() { return Data.getStore('premium:' + me().id, { tier: null, expires_at: null, badge: true, equipped: {} }); }
    function premiumOn() { return E.premiumActive(premium(), Date.now()); }
    function sponsors() { return Data.getList('sponsors'); }

    /* ---------- boot: streak, weekly rotation, milestones ---------- */
    function boot() {
      var key = 'streak:' + me().id;
      var res = E.updateStreak(Object.assign(E.blankStreak(me().id), Data.getStore(key, null) || {}), now());
      res.record.user_id = me().id;
      if (res.status !== 'same') { Data.saveStore(key, res.record); Data.mirror('user_streaks', res.record); }
      if (res.bonusXp) ctx.grantXp(res.bonusXp);
      ui.streak = res;
      if (res.milestone) ctx.toast(t('streakBonus') + res.bonusXp + ' XP · ' + res.milestone + ' ' + t('days'));

      var rot = E.rotateLeaderboard(Data.getStore('leaderboard', null), rankedUsers(), now());
      Data.saveStore('leaderboard', rot.state);
      if (rot.snapshot) {
        Data.saveList('leaderboard_history', [rot.snapshot].concat(Data.getList('leaderboard_history')), 12);
        Data.mirror('leaderboard_history', { snapshot: rot.snapshot, created_at: rot.snapshot.created_at });
        ui.rotated = true;
      }
      checkMilestones();
      ctx.save();
    }
    function checkMilestones() {
      var r = E.detectMilestones(CFG.COMMUNITY_MILESTONES, Data.getStore('milestones', []), totals(), now());
      Data.saveStore('milestones', r.milestones);
      r.unlocked.forEach(function (m) {
        Data.mirror('community_milestones', m);
        ui.banners.push(m);
      });
    }
    function afterRender() {
      if (ui.streak && ui.streak.milestone) { var s = ui.streak.milestone; ui.streak.milestone = null; FX.celebrate('streak'); ctx.announce(t('streakBonus') + s); }
      var fresh = ui.banners.filter(function (m) { return !m.celebrated; });
      if (fresh.length) { fresh.forEach(function (m) { m.celebrated = true; }); FX.celebrate('milestone', document.querySelector('.community-banner')); }
    }

    /* ---------- pieces ---------- */
    function externalButton(label, iconCls, url) {
      var u = Core.safeUrl(url || '');
      return h('button', { type: 'button', class: 'btn btn-ghost w-full justify-center', onclick: function () { if (u) ctx.openLink(u); else ctx.toast(t('soon')); } },
        h('i', { class: iconCls, 'aria-hidden': 'true' }), ' ' + label);
    }
    function links() { return CFG.COMMUNITY_LINKS || {}; }

    function communityBanners() {
      return ui.banners.map(function (m) {
        return h('div', { class: 'panel community-banner tp-banner flex items-center gap-3', role: 'status' },
          icon('fa-champagne-glasses', 'text-amber-300'),
          h('div', { class: 'flex-1 text-sm' }, t('milestoneBanner') + ctx.fmt(m.target) + ' ' + (MILESTONE_NAMES[ctx.lang()] || MILESTONE_NAMES.pl)[m.metric]),
          h('button', { type: 'button', class: 'btn btn-ghost', 'aria-label': t('dismiss'), onclick: function () { ui.banners = ui.banners.filter(function (x) { return x !== m; }); ctx.rerender(); } }, icon('fa-xmark')));
      });
    }
    function charter() {
      return h('div', { class: 'panel text-xs space-y-1', role: 'note', 'aria-label': t('charterTitle') },
        h('div', { class: 'font-bold text-sm' }, icon('fa-seedling', 'text-emerald-300'), ' ' + t('charterTitle')), h('p', { class: 'muted' }, t('charter')));
    }
    function sponsorBanner() {
      if (premiumOn()) return null;
      var list = E.activeSponsors(sponsors(), Date.now());
      if (!list.length) return null;
      return h('div', { class: 'panel space-y-2', role: 'region', 'aria-label': t('sponsor') },
        list.slice(0, 3).map(function (s) { return sponsorLink(s); }));
    }
    function sponsorLink(s) {
      var a = h('a', { class: 'sponsor-badge', href: s.link, target: '_blank', rel: 'noopener noreferrer sponsored', 'aria-label': t('sponsorOpen') + ': ' + s.name, title: s.name });
      if (s.logo_url) a.appendChild(h('img', { src: s.logo_url, alt: '', referrerpolicy: 'no-referrer', loading: 'lazy' })); else a.appendChild(icon('fa-handshake'));
      a.appendChild(document.createTextNode(E.disclosure(s)));
      return a;
    }
    function homeExtras() {
      return [sponsorBanner(), charter(), h('div', { class: 'panel space-y-2', role: 'group', 'aria-label': t('community') },
        externalButton(t('roadmap'), 'fa-solid fa-map', links().roadmap), externalButton(t('discord'), 'fa-brands fa-discord', links().discordBot))];
    }
    // Clearly labelled sponsor disclosure for a post; null for regular posts.
    function sponsorNote(post, card) {
      var s = E.sponsorFor(post, sponsors(), Date.now());
      if (!s) return null;
      if (!ui.sponsorSeen[post.id]) { ui.sponsorSeen[post.id] = 1; setTimeout(function () { FX.pulse(card); }, 50); }
      return h('div', { class: 'flex items-center', 'data-sponsored': 'true' }, sponsorLink(s));
    }

    /* ---------- community tab ---------- */
    function streakCard() {
      var rec = Data.getStore('streak:' + me().id, E.blankStreak(me().id)), cur = rec.current_streak || 0;
      var nextAt = [7, 14, 30].filter(function (d) { return d > cur; })[0];
      var stars = h('span', { class: cur >= 7 ? 'tp-pulse inline-block text-amber-300' : 'text-amber-300', 'aria-hidden': 'true' }, '★');
      return h('div', { class: 'panel space-y-1' },
        h('div', { class: 'flex items-center justify-between' }, h('h3', { class: 'font-bold text-sm' }, icon('fa-fire', 'text-orange-400'), ' ' + t('streak')), stars),
        h('div', { class: 'text-2xl font-black', role: 'status' }, cur + ' ' + t('days')),
        h('div', { class: 'text-xs muted' }, t('best') + ': ' + (rec.max_streak || 0) + (nextAt ? ' · ' + t('next') + nextAt + ' (+' + E.STREAK_BONUSES[nextAt] + ' XP, ' + (nextAt - cur) + t('daysLeft') + ')' : '')),
        h('div', { class: 'text-[10px] muted' }, t('streakNote')));
    }
    function boardCard() {
      var history = Data.getList('leaderboard_history'), last = history[0];
      var rows = ui.board === 'last' && last ? last.rows : E.weeklyScores(rankedUsers(), Data.getStore('leaderboard', null)).filter(function (r) { return r.score > 0; }).slice(0, 10);
      function pick(v) {
        return h('button', { type: 'button', class: 'subtab' + (ui.board === v ? ' active' : ''), role: 'tab', 'aria-selected': String(ui.board === v), disabled: v === 'last' && !last,
          onclick: function () {
            if (ui.board === v) return;
            var box = document.getElementById('tp-board');
            if (box) box.classList.add('tp-fade-out');
            var swap = function () { ui.board = v; ui.boardFade = true; ctx.rerender(); };
            if (FX.reduced()) swap(); else setTimeout(swap, 300);
          } }, t(v === 'now' ? 'thisWeek' : 'lastWeek'));
      }
      var fade = ui.boardFade || ui.rotated; ui.boardFade = false; ui.rotated = false;
      return h('div', { class: 'panel space-y-2' },
        h('h3', { class: 'font-bold text-sm' }, icon('fa-ranking-star', 'text-cyan-300'), ' ' + t('board')),
        h('div', { class: 'subtabs', role: 'tablist', 'aria-label': t('board') }, pick('now'), pick('last')),
        h('ol', { id: 'tp-board', class: fade ? 'tp-fade-in' : '', 'aria-live': 'polite' }, rows.length ? rows.map(function (r, i) {
          return h('li', { class: 'flex justify-between text-xs py-1.5 border-b border-slate-800/70' }, h('span', { text: (i + 1) + '. ' + r.username }), h('b', {}, ctx.fmt(r.score) + ' ' + t('pts')));
        }) : h('li', { class: 'text-xs muted' }, t('noRows'))),
        h('div', { class: 'text-[10px] muted' }, t('boardNote')));
    }
    function milestonesCard() {
      var tot = totals(), names = MILESTONE_NAMES[ctx.lang()] || MILESTONE_NAMES.pl;
      return h('div', { class: 'panel space-y-2' },
        h('h3', { class: 'font-bold text-sm' }, icon('fa-people-group', 'text-violet-300'), ' ' + t('milestones')),
        h('div', { class: 'text-sm' }, t('together') + ' ' + ctx.fmt(tot.total_xp) + ' XP'),
        Data.getStore('milestones', []).map(function (m) {
          var pct = Math.min(100, Math.round((m.current / m.target) * 100));
          return h('div', { class: 'space-y-1' },
            h('div', { class: 'flex justify-between text-xs' }, h('span', {}, ctx.fmt(m.target) + ' ' + names[m.metric]), h('span', { class: m.unlocked_at ? 'text-emerald-400' : 'muted' }, m.unlocked_at ? t('unlocked') : pct + '%')),
            h('div', { class: 'bar', role: 'progressbar', 'aria-label': ctx.fmt(m.target) + ' ' + names[m.metric], 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('div', { style: 'width:' + pct + '%' })));
        }));
    }
    function communityView() { return communityBanners().concat([streakCard(), boardCard(), milestonesCard(), charter()]); }

    /* ---------- profile ---------- */
    function equippedStyle() {
      var eq = premiumOn() ? premium().equipped || {} : {}, c = cosmetics().filter(function (x) { return x.id === eq.border; })[0];
      return c && c.config && /^#[0-9a-fA-F]{3,8}$/.test(c.config.color || '') ? '--cosmetic-color:' + c.config.color : null;
    }
    function premiumBadge() { return premiumOn() && premium().badge !== false ? h('span', { class: 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300', title: t('badge') }, icon('fa-gem'), ' ' + t('badge')) : null; }
    function premiumPanel() {
      var p = premium(), on = premiumOn(), box = h('div', { class: 'panel space-y-2' });
      function setP(next) { Data.saveStore('premium:' + me().id, next); ctx.rerender(); }
      box.appendChild(h('h3', { class: 'font-bold text-sm' }, icon('fa-gem', 'text-amber-300'), ' ' + t('premium')));
      box.appendChild(h('p', { class: 'text-xs muted' }, t('passInfo')));
      box.appendChild(h('button', { type: 'button', class: 'btn w-full', 'aria-pressed': String(on), onclick: function () {
        setP(on ? Object.assign({}, p, { tier: null, expires_at: null }) : Object.assign({}, p, { tier: CFG.PREMIUM_PASS.id, expires_at: new Date(Date.now() + CFG.PREMIUM_PASS.days * 86400000).toISOString() }));
      } }, on ? t('premiumOff') : t('premiumOn')));
      if (on) {
        var cb = h('input', { type: 'checkbox', class: 'w-4 h-4 accent-violet-500', onchange: function () { setP(Object.assign({}, p, { badge: cb.checked })); } });
        cb.checked = p.badge !== false;
        box.appendChild(h('label', { class: 'flex items-center justify-between text-sm' }, t('showBadge'), cb));
        E.COSMETIC_TYPES.forEach(function (type) {
          var sel = h('select', { class: 'field', 'aria-label': t(type), onchange: function () { var eq = Object.assign({}, p.equipped); eq[type] = sel.value; setP(Object.assign({}, p, { equipped: eq })); } },
            h('option', { value: '' }, t('none')), cosmetics().filter(function (c) { return c.type === type; }).map(function (c) { return h('option', { value: c.id, text: c.name }); }));
          sel.value = (p.equipped || {})[type] || '';
          box.appendChild(h('label', { class: 'block text-[11px] muted space-y-1' }, h('span', {}, t(type)), sel));
        });
      }
      box.appendChild(h('div', { class: 'text-[10px] muted' }, t('premiumUiOnly')));
      return box;
    }
    function profileExtras() {
      return [premiumPanel(), h('div', { class: 'panel space-y-2' },
        externalButton(t('feedback'), 'fa-solid fa-comment-dots', links().feedback), externalButton(t('discord'), 'fa-brands fa-discord', links().discordBot), externalButton(t('roadmap'), 'fa-solid fa-map', links().roadmap))];
    }

    /* ---------- anti-bot (temporary cooldown only) ---------- */
    function allowAction() {
      var r = E.checkAction(Data.getStore('antibot', null), Date.now());
      Data.saveStore('antibot', r.state);
      if (!r.allowed && r.reason !== 'cooldown') ctx.toast(t('cooldown'));
      return r.allowed;
    }

    return { boot: boot, afterRender: afterRender, homeExtras: homeExtras, banners: communityBanners, communityView: communityView, profileExtras: profileExtras, sponsorNote: sponsorNote,
      premiumBadge: premiumBadge, equippedStyle: equippedStyle, allowAction: allowAction, checkMilestones: checkMilestones, label: function () { return t('tab'); } };
  }

  window.TPEngageUI = { create: create };
})();
