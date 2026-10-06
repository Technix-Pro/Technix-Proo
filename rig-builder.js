/*
 * RIG Builder: step-by-step assembly animation of the whole workstation (inline SVG + Web Animations API).
 * Only transform/opacity are animated. Owned parts are shown assembled immediately; a newly bought part plays its own step.
 * Parts keep their `data-part` attribute for the shop logic.
 */
(function () {
  var STEPS = [
    { key: 'desk', label: 'Montaż biurka', from: [0, 26] },
    { key: 'case', label: 'Montaż obudowy', from: [70, 0] },
    { key: 'ram', label: 'Montaż RAM', from: [0, -46] },
    { key: 'gpu', label: 'Montaż GPU', from: [-62, 0] },
    { key: 'monitor', label: 'Montaż monitora', from: [0, -56] },
    { key: 'keyboard', label: 'Montaż klawiatury', from: [0, 36] },
    { key: 'mouse', label: 'Montaż myszy', from: [48, 10] }
  ];
  var PARTS = STEPS.filter(function (s) { return s.key !== 'desk'; }).map(function (s) { return s.key; });
  var STEP_MS = 720;
  var GAP_MS = 240;

  var root, svg, labelEl, fillEl, replayBtn;
  var owned = {};
  var token = 0;
  var active = [];

  function reduced() { return window.FX ? window.FX.reduced() : false; }
  function el(key) { return svg.querySelector('[data-part="' + key + '"], [data-rig-base="' + key + '"]'); }
  function ownedCount() { return PARTS.filter(function (k) { return owned[k]; }).length; }
  function complete() { return ownedCount() === PARTS.length; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function setProgress(ratio) { if (fillEl) fillEl.style.transform = 'scaleX(' + Math.max(0, Math.min(1, ratio)).toFixed(3) + ')'; }
  function setLabel(text) { if (labelEl) labelEl.textContent = text; }

  function track(anim) { active.push(anim); return anim; }
  function cancelAll() {
    active.forEach(function (a) { try { a.cancel(); } catch (e) { /* ignore */ } });
    active = [];
  }
  function finished(anim) { return anim.finished.catch(function () { /* cancelled */ }); }

  function idleLabel() {
    var n = ownedCount();
    if (complete()) setLabel('System uruchomiony · wydajność 100%');
    else setLabel('Zamontowano ' + n + '/' + PARTS.length + ' części' + (n ? '' : ' — kup pierwszą część'));
    setProgress((n + 1) / STEPS.length);
  }

  function setRunning(on) {
    svg.classList.toggle('rig-running', on);
    var power = ownedCount() / PARTS.length;
    var glow = svg.querySelector('.rig-glow-wrap');
    if (glow) glow.style.opacity = (on ? 0.35 + 0.65 * power : 0.15 * power).toFixed(2);
  }

  // Final state without animation. `skip` lists keys left as outlines (they are about to be animated in).
  function applyFinal(skip) {
    cancelAll();
    STEPS.forEach(function (s) {
      var node = el(s.key);
      if (!node) return;
      var on = s.key === 'desk' ? !(skip && skip.desk) : !!owned[s.key] && !(skip && skip[s.key]);
      node.classList.toggle('is-on', on);
    });
    setRunning(complete() && !skip);
    if (!skip) idleLabel();
  }

  async function animateIn(node, step) {
    node.classList.add('is-on');
    var dx = step.from[0], dy = step.from[1];
    await finished(track(node.animate([
      { opacity: 0, transform: 'translate(' + dx + 'px,' + dy + 'px) scale(0.96)' },
      { opacity: 1, transform: 'translate(0,0) scale(1)', offset: 0.62, easing: 'ease-in' },
      { opacity: 1, transform: 'translate(0,-3px) scale(1.02)', offset: 0.8 },
      { opacity: 1, transform: 'translate(0,0) scale(1)' }
    ], { duration: STEP_MS, easing: 'cubic-bezier(0.22,1,0.36,1)' })));
    var flash = node.querySelector('.rig-flash');
    if (flash) {
      track(flash.animate([
        { opacity: 0, transform: 'scale(0.6)' },
        { opacity: 0.55, transform: 'scale(1)', offset: 0.3 },
        { opacity: 0, transform: 'scale(1.15)' }
      ], { duration: 420, easing: 'ease-out' }));
    }
    if (window.FX) window.FX.haptic('impact', 'light');
  }

  async function boot(t) {
    setLabel('Uruchamianie systemu…');
    setProgress(1);
    var screen = svg.querySelector('.rig-screen');
    svg.classList.add('rig-running');
    var glow = svg.querySelector('.rig-glow-wrap');
    if (glow) glow.style.opacity = '1';
    if (screen) {
      await finished(track(screen.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.2 }, { opacity: 0.15, offset: 0.4 }, { opacity: 1, offset: 0.6 }, { opacity: 0.6, offset: 0.8 }, { opacity: 1 }], { duration: 1000, easing: 'linear' })));
    }
    if (t !== token) return;
    var lines = svg.querySelectorAll('.rig-screen-lines rect');
    for (var i = 0; i < lines.length; i++) {
      track(lines[i].animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 300, delay: i * 110, easing: 'ease-out', fill: 'backwards' }));
    }
    await wait(300 + lines.length * 110);
    if (window.FX) window.FX.haptic('notify', 'success');
  }

  async function sequence(keys, withBase, startBlank) {
    var t = ++token;
    cancelAll();
    var skip = {};
    keys.forEach(function (k) { skip[k] = true; });
    if (withBase) skip.desk = true;
    if (startBlank) PARTS.forEach(function (k) { skip[k] = true; });
    applyFinal(skip);
    for (var i = 0; i < STEPS.length; i++) {
      var s = STEPS[i];
      var play = s.key === 'desk' ? withBase : keys.indexOf(s.key) !== -1;
      if (!play) continue;
      var node = el(s.key);
      if (!node) continue;
      setLabel('Krok ' + (i + 1) + '/' + STEPS.length + ': ' + s.label);
      setProgress((i + 1) / STEPS.length);
      await animateIn(node, s);
      if (t !== token) return;
      await wait(GAP_MS);
      if (t !== token) return;
    }
    if (complete()) {
      await boot(t);
      if (t !== token) return;
    } else {
      await wait(250);
      if (t !== token) return;
    }
    applyFinal();
  }

  function replay() {
    if (!svg) return;
    if (reduced()) { token++; applyFinal(); return; }
    sequence(PARTS.filter(function (k) { return owned[k]; }), true, true);
  }

  // Called with the set of owned rig parts. Animates only newly owned ones (unless `silent`).
  function setOwned(next, silent) {
    if (!svg) return;
    var fresh = [];
    PARTS.forEach(function (k) {
      var was = !!owned[k];
      owned[k] = !!(next && next[k]);
      if (owned[k] && !was) fresh.push(k);
    });
    if (silent || !fresh.length || reduced()) { token++; applyFinal(); return; }
    sequence(fresh, false, false);
  }

  function init() {
    root = document.getElementById('rig-station');
    svg = document.getElementById('rig-svg');
    if (!root || !svg) return;
    labelEl = document.getElementById('rig-step-label');
    fillEl = document.getElementById('rig-progress-fill');
    replayBtn = document.getElementById('rig-replay-btn');
    if (replayBtn) replayBtn.addEventListener('click', replay);
    applyFinal();
  }

  window.RigBuilder = { init: init, setOwned: setOwned, replay: replay };
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
