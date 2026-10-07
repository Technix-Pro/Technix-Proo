// Purchase celebration: confetti burst from screen center (transform + opacity only, honours prefers-reduced-motion).
(function (root) {
  'use strict';
  var COLORS = ['#22d3ee', '#a78bfa', '#06b6d4', '#8b5cf6'];

  function particles(count, rain) {
    var list = [];
    for (var i = 0; i < count; i++) {
      if (rain) { list.push({ dx: Math.round(Math.random() * 280 - 140), dy: 260 + Math.round(Math.random() * 220), rot: Math.round(Math.random() * 720 - 360), color: COLORS[i % COLORS.length] }); continue; }
      var angle = (Math.PI * 2 * i) / count + Math.random() * 0.4, dist = 90 + Math.random() * 110;
      list.push({ dx: Math.round(Math.cos(angle) * dist), dy: Math.round(Math.sin(angle) * dist), rot: Math.round(Math.random() * 540 - 270), color: COLORS[i % COLORS.length] });
    }
    return list;
  }

  function reduced() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  // opts: { count (default 18), rain (fall from the top instead of bursting from the center) }
  function confetti(opts) {
    var doc = root.document;
    if (!doc || reduced()) return false;
    var count = opts && opts.count ? opts.count : 18, rain = !!(opts && opts.rain);
    var layer = doc.createElement('div');
    layer.className = 'confetti-layer' + (rain ? ' confetti-rain' : '');
    layer.setAttribute('aria-hidden', 'true');
    particles(count, rain).forEach(function (p) {
      var el = doc.createElement('span');
      el.className = 'confetti-piece';
      el.style.background = p.color;
      el.style.setProperty('--dx', p.dx + 'px');
      el.style.setProperty('--dy', p.dy + 'px');
      el.style.setProperty('--rot', p.rot + 'deg');
      layer.appendChild(el);
    });
    doc.body.appendChild(layer);
    root.setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 1600);
    return true;
  }

  // Temporarily adds a CSS animation class (transform/opacity only); no-op under prefers-reduced-motion.
  function flash(el, cls, ms) {
    if (!el || reduced()) return false;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    root.setTimeout(function () { el.classList.remove(cls); }, ms);
    return true;
  }
  function glow(el) { return flash(el, 'tp-glow', 1000); }
  function shake(el) { return flash(el || (root.document && root.document.body), 'tp-shake', 300); }
  function pulse(el) { return flash(el, 'tp-sponsor-glow', 1200); }

  // celebrate('milestone' | 'streak' | 'levelup', el): milestone = burst + glow (1s), streak = confetti rain, levelup = badge glow + shake.
  function celebrate(kind, el) {
    if (kind === 'streak') return confetti({ count: 20, rain: true });
    if (kind === 'levelup') { glow(el); return shake(root.document && root.document.getElementById('app-content')); }
    glow(el);
    return confetti({ count: 20 });
  }

  var api = { particles: particles, confetti: confetti, glow: glow, shake: shake, pulse: pulse, celebrate: celebrate, reduced: reduced };
  root.TPEffects = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
