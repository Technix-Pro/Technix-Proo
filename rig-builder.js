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
(function () {
  const PART_NAMES = {
  const partKeys = ['monitor', 'keyboard', 'mouse', 'case', 'ram', 'gpu', 'fan'];
  const labels = {
    monitor: 'Monitor',
    keyboard: 'Klawiatura',
    mouse: 'Mysz',
    case: 'Obudowa komputera',
    fan: 'Chłodzenie',
    ram: 'RAM',
    gpu: 'Karta graficzna'
  };
  const DIRECTIONS = {
    monitor: [-24, -90],
    keyboard: [0, 36],
    mouse: [0, 36],
    case: [-90, 0],
    fan: [0, -24],
    ram: [0, -24],
    gpu: [30, 0]
  };
  const stage = () => document.querySelector('.rig-station');
  const reducedMotion = () => (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    || (window.CONFIG && window.CONFIG.ENABLE_ANIMATIONS === false);
  let owned = {};
  let queue = Promise.resolve();
  let sequenceId = 0;
  let runningAnimations = [];
  let visible = false;
  let intersectionVisible = true;
  let online = false;

  function isVisible() {
    return visible && intersectionVisible && !document.hidden;
  }

  function updateAnimationPlayback() {
    runningAnimations.forEach(animation => {
      if (isVisible()) animation.play();
      else animation.pause();
    });
    const root = stage();
    const screen = document.getElementById('screen-crypto');
    if (root) {
      root.classList.toggle('rig-paused', !isVisible());
      root.classList.toggle('rig-motion-disabled', Boolean(window.CONFIG && window.CONFIG.ENABLE_ANIMATIONS === false));
    }
    if (screen) screen.classList.toggle('rig-paused', !isVisible());
    document.documentElement.classList.toggle('animations-disabled', Boolean(window.CONFIG && window.CONFIG.ENABLE_ANIMATIONS === false));
  }

  function setMounted(key, mounted) {
    const node = document.getElementById(`rig-${key}`);
    if (!node) return;
    node.classList.toggle('is-mounted', mounted);
    node.classList.toggle('is-running', mounted);
    node.setAttribute('aria-hidden', String(!mounted));
  }

  function updateStatus() {
    const keys = Object.keys(PART_NAMES);
    const count = keys.filter(key => document.getElementById(`rig-${key}`)?.classList.contains('is-mounted')).length;
    const summary = document.getElementById('rig-status');
    const progress = document.getElementById('rig-progress');
    const badge = document.getElementById('rig-online');
    if (summary) summary.textContent = `${count} z ${keys.length} części zamontowanych`;
    if (progress) progress.textContent = `Zamontowano ${count}/${keys.length}`;
    if (badge) badge.classList.toggle('hidden', count !== keys.length || !online);
    const root = stage();
    if (root) root.classList.toggle('rig-online-active', count === keys.length && online);
    if (count !== keys.length) online = false;
  }

  function playInstall(key) {
    const node = document.getElementById(`rig-${key}`);
    if (!node || reducedMotion()) {
      setMounted(key, true);
      updateStatus();
      return Promise.resolve();
    }
    const [x, y] = DIRECTIONS[key];
    setMounted(key, true);
    updateStatus();
    const animation = node.animate([
      { opacity: 0, transform: `translate(${x}px, ${y}px) scale(.78)` },
      { opacity: 1, transform: 'translate(0, 0) scale(1.06)', offset: .78 },
      { opacity: 1, transform: 'translate(0, 0) scale(1)' }
    ], { duration: 1050, easing: 'cubic-bezier(.2, 1.35, .35, 1)', fill: 'both' });
    const flash = node.querySelector('.rig-flash');
    if (flash) {
      const flashAnimation = flash.animate([{ opacity: 0 }, { opacity: .9, offset: .25 }, { opacity: 0 }], { duration: 850 });
      runningAnimations.push(flashAnimation);
      flashAnimation.finished.catch(() => {}).then(() => {
        runningAnimations = runningAnimations.filter(item => item !== flashAnimation);
        flashAnimation.cancel();
      });
    }
    runningAnimations.push(animation);
    updateAnimationPlayback();
    return animation.finished.catch(() => {}).then(() => {
      runningAnimations = runningAnimations.filter(item => item !== animation);
      node.style.transform = '';
      node.style.opacity = '';
      animation.cancel();
    });
  }

  async function playQueue(keys, id = sequenceId) {
    for (const key of keys) {
      if (id !== sequenceId) return;
      await playInstall(key);
      if (id !== sequenceId) return;
    }
    updateStatus();
    if (Object.keys(PART_NAMES).every(key => owned[key])) {
      online = true;
      updateStatus();
    }
  }

  function renderRig(parts = {}, options = {}) {
    const newlyOwned = [];
    Object.keys(PART_NAMES).forEach(key => {
      const hasPart = parts[key] === true;
      const animatePart = hasPart && !owned[key] && options.animateNew;
      if (animatePart) newlyOwned.push(key);
      setMounted(key, hasPart && !animatePart);
    });
    owned = { ...parts };
    if (!newlyOwned.length && Object.keys(PART_NAMES).every(key => owned[key])) online = true;
    updateStatus();
    if (newlyOwned.length) {
      const id = sequenceId;
      queue = queue.then(() => playQueue(newlyOwned, id));
    }
    return queue;
  }

  function replay() {
    online = false;
    sequenceId += 1;
    runningAnimations.forEach(animation => animation.cancel());
    runningAnimations = [];
    const root = stage();
    if (root) root.scrollIntoView({ behavior: 'auto', block: 'center' });
    Object.keys(PART_NAMES).forEach(key => setMounted(key, false));
    updateStatus();
    queue = Promise.resolve().then(() => playQueue(Object.keys(PART_NAMES).filter(key => owned[key]), sequenceId));
    return queue;
  }

  function bindScene() {
    const root = stage();
    if (!root) return;
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        intersectionVisible = entries[0].isIntersecting;
        updateAnimationPlayback();
      });
      observer.observe(root);
    }
    const button = document.getElementById('rig-replay');
    if (button) button.addEventListener('click', replay);
    document.addEventListener('visibilitychange', updateAnimationPlayback);
  }

  function bindThumbnails() {
    document.querySelectorAll('.shop-item-preview use').forEach(use => {
      use.setAttribute('href', `#rig-${use.closest('[data-preview]')?.dataset.preview || ''}`);
    });
  }

  window.rigBuilder = { renderRig, setVisible(value) { visible = value; updateAnimationPlayback(); }, bindScene, bindThumbnails, names: PART_NAMES };
    ram: 'Pamięć RAM',
    gpu: 'Karta graficzna',
    fan: 'Wentylator'
  };
  const scene = () => document.getElementById('rig-scene');
  let animationQueue = Promise.resolve();
  let observer;
  let intersects = true;
  let cryptoVisible = false;

  function shouldReduceMotion() {
    return window.CONFIG?.ANIMATIONS_ENABLED === false
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function updatePauseState() {
    const svg = scene();
    if (!svg) return;
    const paused = document.hidden || !cryptoVisible || !intersects;
    svg.classList.toggle('is-paused', paused);
    if (paused) {
      (svg._rigAnimations || []).forEach(animation => animation.pause());
    } else {
      (svg._rigAnimations || []).forEach(animation => animation.play());
    }
  }

  function animatePart(key) {
    const svg = scene();
    const part = svg?.querySelector(`#rig-${key}`);
    if (!part) return Promise.resolve();
    part.classList.add('is-installed');
    if (shouldReduceMotion() || !part.animate) return Promise.resolve();

    const offsets = {
      monitor: ['translateY(-28px) scale(.92)', 'translateY(0) scale(1)'],
      keyboard: ['translateX(-38px) scale(.94)', 'translateX(0) scale(1)'],
      mouse: ['translateX(34px) scale(.9)', 'translateX(0) scale(1)'],
      case: ['translateX(-54px) translateY(8px)', 'translateX(0) translateY(0)'],
      ram: ['translateY(-24px)', 'translateY(0)'],
      gpu: ['translateX(42px)', 'translateX(0)'],
      fan: ['scale(.55) rotate(-25deg)', 'scale(1) rotate(0deg)']
    };
    const [from, to] = offsets[key];
    const animation = part.animate(
      [{ opacity: 0, transform: from }, { opacity: 1, transform: to, offset: 0.76 }, { opacity: 1, transform: to }],
      { duration: 960, easing: 'cubic-bezier(.18,.86,.28,1.24)', fill: 'both' }
    );
    svg._rigAnimations = [...(svg._rigAnimations || []), animation];
    updatePauseState();
    return animation.finished.catch(() => {}).then(() => {
      animation.cancel();
      if (key === 'monitor') part.classList.add('is-booted');
      svg._rigAnimations = (svg._rigAnimations || []).filter(item => item !== animation);
    });
  }

  function install(ownedParts, keys, scrollToScene) {
    const svg = scene();
    if (!svg) return;
    const owned = new Set(ownedParts.filter(key => partKeys.includes(key)));
    svg.querySelectorAll('.rig-part').forEach(part => {
      const key = part.id.replace('rig-', '');
      const installed = owned.has(key) && (key !== 'fan' || owned.has('case'));
      part.classList.toggle('is-installed', installed);
      part.classList.toggle('is-booted', installed && key === 'monitor'
        && (!keys.includes(key) || shouldReduceMotion()));
    });
    svg.classList.toggle('is-complete', owned.size === partKeys.length);
    const progress = document.getElementById('rig-progress');
    const status = document.getElementById('rig-status');
    if (progress) progress.textContent = `Zamontowano ${owned.size}/${partKeys.length}`;
    if (status) status.textContent = owned.size === partKeys.length
      ? 'RIG ONLINE · stanowisko wydobywa'
      : owned.size ? `Działa: ${[...owned].map(key => labels[key]).join(', ')}`
        : 'Puste biurko · kup część, aby rozpocząć montaż';

    if (!keys.length) {
      updatePauseState();
      return;
    }
    if (scrollToScene) {
      document.getElementById('rig-builder')?.scrollIntoView({ behavior: shouldReduceMotion() ? 'auto' : 'smooth', block: 'center' });
    }
    animationQueue = animationQueue.then(async () => {
      for (const key of keys) {
        if (owned.has(key) && (key !== 'fan' || owned.has('case'))) await animatePart(key);
      }
      svg.classList.toggle('is-complete', owned.size === partKeys.length);
      if (status && owned.size === partKeys.length) status.textContent = 'RIG ONLINE · stanowisko wydobywa';
    });
  }

  function renderRig(ownedParts, options = {}) {
    const owned = Array.isArray(ownedParts) ? ownedParts : [];
    install(owned, Array.isArray(options.animateNew) ? options.animateNew : [], Boolean(options.focus));
  }

  function replay(ownedParts) {
    const svg = scene();
    if (!svg) return;
    const owned = partKeys.filter(key => ownedParts.includes(key) && (key !== 'fan' || ownedParts.includes('case')));
    svg.classList.remove('is-complete');
    svg.querySelectorAll('.rig-part').forEach(part => part.classList.remove('is-installed'));
    svg.querySelectorAll('.rig-part').forEach(part => part.classList.remove('is-booted'));
    const status = document.getElementById('rig-status');
    if (status) status.textContent = 'Odtwarzanie montażu…';
    install([], [], false);
    animationQueue = animationQueue.then(async () => {
      const progress = document.getElementById('rig-progress');
      for (const [index, key] of owned.entries()) {
        await animatePart(key);
        if (progress) progress.textContent = `Zamontowano ${index + 1}/${partKeys.length}`;
      }
      svg.classList.toggle('is-complete', owned.length === partKeys.length);
      if (status) status.textContent = owned.length === partKeys.length
        ? 'RIG ONLINE · stanowisko wydobywa'
        : `Montaż zakończony · ${owned.length}/${partKeys.length} części`;
    });
    document.getElementById('rig-builder')?.scrollIntoView({ behavior: shouldReduceMotion() ? 'auto' : 'smooth', block: 'center' });
  }

  function createPreview(key) {
    const original = document.getElementById(`rig-${key}`);
    if (!original) return document.createElement('span');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', key === 'case' || key === 'fan' || key === 'ram' || key === 'gpu' ? '85 135 115 105' : '105 45 190 105');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('rig-shop-preview');
    const preview = original.cloneNode(true);
    preview.removeAttribute('id');
    preview.classList.add('is-installed');
    svg.append(preview);
    return svg;
  }

  function init() {
    const svg = scene();
    if (!svg) return;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        intersects = entries.some(entry => entry.isIntersecting);
        updatePauseState();
      });
      observer.observe(svg);
    }
    document.addEventListener('visibilitychange', updatePauseState);
    document.addEventListener('rig-screen-visibility', event => {
      cryptoVisible = Boolean(event.detail);
      updatePauseState();
    });
    document.getElementById('rig-replay')?.addEventListener('click', () => {
      replay(window.getOwnedRigParts ? window.getOwnedRigParts() : []);
    });
    updatePauseState();
  }

  window.RigBuilder = { renderRig, replay, createPreview, init };
  window.addEventListener('load', init, { once: true });
})();
