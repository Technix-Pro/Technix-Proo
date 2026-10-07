// Purchase celebration: confetti burst from screen center (transform + opacity only, honours prefers-reduced-motion).
(function (root) {
  'use strict';
  var COLORS = ['#22d3ee', '#a78bfa', '#06b6d4', '#8b5cf6'];

  function particles(count) {
    var list = [];
    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 * i) / count + Math.random() * 0.4, dist = 90 + Math.random() * 110;
      list.push({ dx: Math.round(Math.cos(angle) * dist), dy: Math.round(Math.sin(angle) * dist), rot: Math.round(Math.random() * 540 - 270), color: COLORS[i % COLORS.length] });
    }
    return list;
  }

  function confetti() {
    var doc = root.document;
    if (!doc || (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches)) return false;
    var layer = doc.createElement('div');
    layer.className = 'confetti-layer';
    layer.setAttribute('aria-hidden', 'true');
    particles(18).forEach(function (p) {
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

  var api = { particles: particles, confetti: confetti };
  root.TPEffects = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
