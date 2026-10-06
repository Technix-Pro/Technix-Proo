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
})();
