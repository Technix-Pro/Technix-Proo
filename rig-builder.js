/* RIG Builder – side-view animated workstation (inline SVG + WAAPI). No dependencies. */
(function () {
  'use strict';

  var ORDER = ['case', 'fan', 'ram', 'gpu', 'monitor', 'keyboard', 'mouse'];
  var NS = 'http://www.w3.org/2000/svg';

  function blades(cx, cy, r) {
    var out = '';
    [0, 45, 90, 135].forEach(function (a) {
      out += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + (r * 0.22) + '" ry="' + r +
        '" transform="rotate(' + a + ' ' + cx + ' ' + cy + ')"/>';
    });
    return out;
  }

  // box: [x, y, w, h] in scene coordinates; from: initial entry offset; svg: part markup (no ids)
  var PARTS = {
    case: {
      label: 'Komputer (obudowa)', box: [205, 130, 80, 56], from: { x: 80, y: 0 },
      svg: '<ellipse class="rig-shadow" cx="245" cy="187" rx="42" ry="3"/>' +
        '<rect class="rig-body" x="206" y="132" width="78" height="54" rx="4"/>' +
        '<rect class="rig-board" x="211" y="137" width="60" height="44" rx="2"/>' +
        '<rect class="rig-body" x="276" y="136" width="6" height="46" rx="2"/>' +
        '<circle class="rig-led rig-power" cx="279" cy="141" r="1.8"/>' +
        '<path class="rig-line" d="M279 150h0M279 154h0M279 158h0" stroke-dasharray="0 3" stroke-linecap="round"/>'
    },
    fan: {
      label: 'Chłodzenie (wiatrak)', box: [246, 140, 20, 20], from: { x: 0, y: 0, scale: 0.2 },
      svg: '<circle class="rig-body" cx="256" cy="150" r="11"/>' +
        '<g class="rig-spin rig-blade">' + blades(256, 150, 9) + '</g>' +
        '<circle class="rig-hub" cx="256" cy="150" r="2.2"/>'
    },
    ram: {
      label: 'RAM', box: [215, 140, 22, 22], from: { x: 0, y: -34 },
      svg: '<rect class="rig-body rig-glow-box" x="216" y="143" width="4" height="18" rx="1"/>' +
        '<rect class="rig-body" x="223" y="143" width="4" height="18" rx="1"/>' +
        '<rect class="rig-body" x="230" y="143" width="4" height="18" rx="1"/>' +
        '<circle class="rig-led rig-blink-a" cx="218" cy="141" r="1.2"/>' +
        '<circle class="rig-led rig-blink-b" cx="225" cy="141" r="1.2"/>' +
        '<circle class="rig-led rig-blink-a" cx="232" cy="141" r="1.2"/>'
    },
    gpu: {
      label: 'GPU', box: [213, 165, 58, 13], from: { x: 50, y: 0 },
      svg: '<rect class="rig-glow rig-glow-pulse" x="211" y="163" width="62" height="17" rx="4"/>' +
        '<rect class="rig-body" x="214" y="166" width="56" height="11" rx="2"/>' +
        '<g class="rig-spin rig-blade">' + blades(228, 171.5, 4) + '</g>' +
        '<g class="rig-spin rig-blade">' + blades(246, 171.5, 4) + '</g>' +
        '<rect class="rig-led rig-blink-b" x="260" y="168" width="7" height="1.6" rx="0.8"/>'
    },
    monitor: {
      label: 'Monitor', box: [163, 58, 84, 64], from: { x: 0, y: -70 },
      svg: '<ellipse class="rig-shadow" cx="205" cy="120.5" rx="24" ry="2"/>' +
        '<rect class="rig-body" x="200" y="106" width="10" height="14"/>' +
        '<rect class="rig-body" x="188" y="118" width="34" height="3" rx="1.5"/>' +
        '<rect class="rig-body" x="164" y="60" width="82" height="48" rx="4"/>' +
        '<rect class="scr-bg" x="168" y="64" width="74" height="40" rx="2"/>' +
        '<g class="scr-boot"><text x="205" y="80" text-anchor="middle" class="scr-text">TECHNIX OS</text>' +
        '<rect class="scr-track" x="183" y="90" width="44" height="4" rx="2"/>' +
        '<rect class="scr-bar" x="183" y="90" width="44" height="4" rx="2"/></g>' +
        '<g class="scr-live"><polyline class="scr-chart" points="172,98 182,92 192,95 202,82 212,88 222,74 232,78 238,70"/>' +
        '<text x="172" y="75" class="scr-text">TP 1 337</text><rect class="scr-cursor" x="226" y="96" width="5" height="2"/></g>' +
        '<rect class="scr-scan" x="168" y="64" width="74" height="2"/>' +
        '<rect class="scr-flash" x="168" y="64" width="74" height="40" rx="2"/>'
    },
    keyboard: {
      label: 'Klawiatura', box: [95, 111, 56, 10], from: { x: -60, y: 0 },
      svg: '<ellipse class="rig-shadow" cx="123" cy="120.5" rx="28" ry="1.5"/>' +
        '<rect class="rig-body" x="96" y="114" width="54" height="6" rx="2"/>' +
        '<path class="rig-line" d="M100 116h46" stroke-dasharray="3 2"/>' +
        '<circle class="rig-led rig-blink-b" cx="147" cy="112.5" r="1.2"/>'
    },
    mouse: {
      label: 'Mysz', box: [60, 111, 28, 10], from: { x: -70, y: 0 },
      svg: '<ellipse class="rig-shadow" cx="73" cy="120.5" rx="14" ry="1.5"/>' +
        '<path class="rig-body" d="M62 120q2-9 11-9t11 9z"/>' +
        '<circle class="rig-led rig-blink-a" cx="68" cy="117" r="1.2"/>' +
        '<circle class="rig-ring" cx="73" cy="114" r="3"/>'
    }
  };

  var DESK = '<g id="rig-desk"><title>Biurko</title>' +
    '<path class="rig-grid" d="M20 186h284M20 176h284M60 120v66M120 120v66M180 120v66M240 120v66"/>' +
    '<rect class="rig-body" x="20" y="120" width="284" height="8" rx="3"/>' +
    '<rect class="rig-body" x="30" y="128" width="6" height="58"/>' +
    '<rect class="rig-body" x="296" y="128" width="6" height="58"/></g>';

  function thumb(key) {
    var p = PARTS[key];
    if (!p) return '';
    var b = p.box;
    return '<svg class="rig-thumb is-preview" viewBox="' + (b[0] - 4) + ' ' + (b[1] - 4) + ' ' + (b[2] + 8) + ' ' + (b[3] + 8) +
      '" role="img" aria-label="' + p.label + '"><g class="rig-part is-owned is-running' + (key === 'monitor' ? ' is-live' : '') + '">' + p.svg + '</g></svg>';
  }

  function RigBuilder(root, opts) {
    opts = opts || {};
    this.root = root;
    this.partKeys = ORDER.slice();
    this.owned = {};
    this.queued = {};
    this.queue = Promise.resolve();
    this.timers = [];
    this.token = 0;
    this.reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.animOff = !!(window.CONFIG && window.CONFIG.ANIMATIONS === false);
    this.onChange = opts.onChange || function () {};
    this.build();
    this.bindVisibility();
  }

  RigBuilder.prototype.noMotion = function () { return this.reduced || this.animOff; };

  RigBuilder.prototype.build = function () {
    var html = '<svg class="rig-scene" viewBox="0 0 320 200" role="img" aria-label="Stanowisko komputerowe z boku">' +
      '<g class="rig-glow-all"><ellipse cx="160" cy="130" rx="150" ry="70"/></g>' + DESK +
      '<g class="rig-ghosts">';
    ORDER.forEach(function (k) {
      var b = PARTS[k].box;
      html += '<rect class="rig-ghost" data-ghost="' + k + '" x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '" rx="4"/>';
    });
    html += '</g>';
    ORDER.forEach(function (k) {
      html += '<g id="rig-' + k + '" class="rig-part" data-part="' + k + '" role="img" aria-label="' + PARTS[k].label + '"><title>' + PARTS[k].label + '</title>' + PARTS[k].svg + '</g>';
    });
    html += '<g class="rig-fx"></g><text class="rig-online-text" x="160" y="30" text-anchor="middle">RIG ONLINE</text></svg>' +
      '<p class="rig-summary" aria-live="polite"></p>';
    this.root.innerHTML = html;
    this.svg = this.root.querySelector('.rig-scene');
    this.fx = this.root.querySelector('.rig-fx');
    this.summary = this.root.querySelector('.rig-summary');
  };

  RigBuilder.prototype.bindVisibility = function () {
    var self = this, inView = true;
    function apply() { self.svg.classList.toggle('is-paused', document.hidden || !inView); }
    document.addEventListener('visibilitychange', apply);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[entries.length - 1].isIntersecting;
        apply();
      }).observe(this.svg);
    }
    apply();
  };

  RigBuilder.prototype.part = function (k) { return this.svg.querySelector('#rig-' + k); };

  RigBuilder.prototype.count = function () {
    var self = this;
    return this.partKeys.filter(function (k) { return self.owned[k]; }).length;
  };

  RigBuilder.prototype.isFull = function () { return this.count() === this.partKeys.length; };

  RigBuilder.prototype.updateMeta = function () {
    var n = this.count(), total = this.partKeys.length;
    this.svg.style.setProperty('--fan-speed', Math.max(0.35, 1.6 - n * 0.18).toFixed(2) + 's');
    this.summary.textContent = 'Zamontowano ' + n + ' z ' + total + ' części stanowiska.' + (n === total ? ' RIG ONLINE.' : '');
    this.svg.setAttribute('aria-label', 'Stanowisko komputerowe z boku. Zamontowano ' + n + '/' + total + '.');
    this.onChange(n, total);
  };

  RigBuilder.prototype.setFinal = function (k) {
    var g = this.part(k), gh = this.svg.querySelector('[data-ghost="' + k + '"]');
    g.classList.add('is-owned', 'is-running');
    if (k === 'monitor') g.classList.add('is-live');
    if (gh) gh.classList.add('is-hidden');
  };

  RigBuilder.prototype.reset = function () {
    var self = this;
    this.token++;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.queue = Promise.resolve();
    this.queued = {};
    this.svg.getAnimations({ subtree: true }).forEach(function (a) { a.cancel(); });
    this.svg.classList.remove('is-online');
    this.fx.textContent = '';
    this.partKeys.forEach(function (k) {
      self.part(k).classList.remove('is-owned', 'is-running', 'is-live', 'is-booting');
      self.svg.querySelector('[data-ghost="' + k + '"]').classList.remove('is-hidden');
    });
  };

  RigBuilder.prototype.spark = function (k) {
    var b = PARTS[k].box, c = document.createElementNS(NS, 'circle');
    c.setAttribute('class', 'rig-spark');
    c.setAttribute('cx', b[0] + b[2] / 2);
    c.setAttribute('cy', b[1] + b[3] / 2);
    c.setAttribute('r', Math.max(b[2], b[3]) / 2);
    this.fx.appendChild(c);
    var a = c.animate([{ transform: 'scale(0.2)', opacity: 0.9 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 450, easing: 'ease-out' });
    a.onfinish = function () { c.remove(); };
  };

  RigBuilder.prototype.later = function (fn, ms) { this.timers.push(setTimeout(fn, ms)); };

  RigBuilder.prototype.install = function (k) {
    var self = this, token = this.token;
    return new Promise(function (resolve) {
      if (token !== self.token) return resolve();
      var g = self.part(k), from = PARTS[k].from;
      self.owned[k] = true;
      var gh = self.svg.querySelector('[data-ghost="' + k + '"]');
      if (gh) gh.classList.add('is-hidden');
      g.classList.add('is-owned');
      var start = 'translate(' + from.x + 'px,' + from.y + 'px) scale(' + (from.scale || 1) + ')';
      var anim = g.animate([
        { transform: start, opacity: 0 },
        { transform: 'translate(0,0) scale(1)', opacity: 1 }
      ], { duration: 1000, easing: 'cubic-bezier(0.34,1.56,0.64,1)', fill: 'backwards' });
      anim.onfinish = function () {
        if (token !== self.token) return resolve();
        self.spark(k);
        g.classList.add('is-running');
        if (k === 'case') g.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-1.5px)' }, { transform: 'translateX(1.5px)' }, { transform: 'translateX(0)' }], { duration: 300, iterations: 2 });
        if (k === 'monitor') {
          g.classList.add('is-booting');
          self.later(function () { g.classList.remove('is-booting'); g.classList.add('is-live'); }, 1400);
        }
        self.updateMeta();
        resolve();
      };
      anim.oncancel = function () { resolve(); };
    });
  };

  RigBuilder.prototype.startup = function () {
    var self = this, token = this.token;
    if (token !== this.token) return;
    this.svg.classList.add('is-online', 'is-startup');
    var spins = this.svg.getAnimations({ subtree: true }).filter(function (a) { return a.animationName === 'rig-spin'; });
    spins.forEach(function (a) { a.playbackRate = 0.25; });
    [400, 800, 1200].forEach(function (ms, i) {
      self.later(function () { spins.forEach(function (a) { a.playbackRate = 0.25 + 0.25 * (i + 1) * 1.0; }); }, ms);
    });
    this.later(function () { self.svg.classList.remove('is-startup'); }, 2600);
  };

  // ownedParts: { key: boolean }; opts.animateNew plays assembly for newly owned parts (queued)
  RigBuilder.prototype.render = function (ownedParts, opts) {
    var self = this, animate = !!(opts && opts.animateNew) && !this.noMotion();
    var fresh = [];
    this.partKeys.forEach(function (k) {
      var has = !!(ownedParts && ownedParts[k]);
      if (has && !self.owned[k] && !self.queued[k]) fresh.push(k);
      if (!has && self.owned[k]) { self.owned[k] = false; }
    });
    var nowFull = this.partKeys.every(function (k) { return ownedParts && ownedParts[k]; });
    var token = this.token;
    fresh.forEach(function (k) {
      if (!animate) { self.owned[k] = true; self.setFinal(k); return; }
      self.queued[k] = true;
      self.queue = self.queue.then(function () { return token === self.token ? self.install(k) : null; }).then(function () { self.queued[k] = false; });
    });
    if (!animate) {
      this.updateMeta();
      this.svg.classList.toggle('is-online', nowFull);
    } else {
      this.queue = this.queue.then(function () {
        if (token !== self.token) return;
        self.updateMeta();
        if (nowFull && fresh.length) self.startup();
      });
    }
  };

  RigBuilder.prototype.replay = function () {
    var self = this, full = {};
    this.partKeys.forEach(function (k) { if (self.owned[k]) full[k] = true; });
    this.reset();
    this.partKeys.forEach(function (k) { self.owned[k] = false; });
    this.updateMeta();
    this.render(full, { animateNew: true });
  };

  var instance = null;

  window.RigBuilder = {
    parts: ORDER,
    labels: Object.keys(PARTS).reduce(function (o, k) { o[k] = PARTS[k].label; return o; }, {}),
    thumb: thumb,
    init: function (root, opts) { instance = new RigBuilder(root, opts); return instance; },
    renderRig: function (ownedParts, opts) { if (instance) instance.render(ownedParts, opts); },
    replay: function () { if (instance) instance.replay(); },
    scrollIntoView: function () {
      if (instance && instance.root.scrollIntoView) instance.root.scrollIntoView({ behavior: instance.noMotion() ? 'auto' : 'smooth', block: 'center' });
    }
  };
})();
