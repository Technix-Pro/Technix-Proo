/*
 * Interaction effects: one shared requestAnimationFrame loop, spring tap on the core, pooled floating numbers/particles,
 * count-up tweens and button ripples. Animates only transform/opacity. Respects prefers-reduced-motion and TP_CONFIG.ANIMATIONS_ENABLED.
 */
(function () {
  var cfg = window.TP_CONFIG || {};
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function reduced() {
    return cfg.ANIMATIONS_ENABLED === false || !!(mq && mq.matches);
  }
  function applyMotionClass() {
    document.documentElement.classList.toggle('no-anim', reduced());
  }
  applyMotionClass();
  if (mq && mq.addEventListener) mq.addEventListener('change', applyMotionClass);

  /* ---- single rAF loop; tasks return false when finished ---- */
  var tasks = [];
  var rafId = 0;
  var last = 0;
  function frame(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    for (var i = tasks.length - 1; i >= 0; i--) {
      if (tasks[i](dt, ts) === false) tasks.splice(i, 1);
    }
    rafId = tasks.length && !document.hidden ? requestAnimationFrame(frame) : 0;
  }
  function addTask(fn) {
    tasks.push(fn);
    if (!rafId && !document.hidden) { last = performance.now(); rafId = requestAnimationFrame(frame); }
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && !rafId && tasks.length) { last = performance.now(); rafId = requestAnimationFrame(frame); }
  });

  /* ---- haptics ---- */
  var lastHaptic = 0;
  function haptic(kind, style) {
    var tg = window.Telegram && window.Telegram.WebApp;
    var h = tg && tg.HapticFeedback;
    if (!h) return;
    var t = performance.now();
    if (kind === 'impact') {
      if (t - lastHaptic < 40) return;
      lastHaptic = t;
      h.impactOccurred(style || 'light');
    } else if (kind === 'notify') {
      h.notificationOccurred(style || 'success');
    }
  }

  /* ---- count-up tween ---- */
  var counters = new WeakMap();
  function countTo(el, value, format) {
    if (!el) return;
    var fmt = format || function (v) { return String(Math.round(v)); };
    var c = counters.get(el);
    if (!c) {
      c = { cur: value, from: value, to: value, t: 0, dur: 0, running: false, first: true };
      counters.set(el, c);
      el.textContent = fmt(value);
      return;
    }
    if (c.to === value) return;
    if (reduced()) { c.cur = c.to = value; el.textContent = fmt(value); return; }
    c.from = c.cur;
    c.to = value;
    c.t = 0;
    c.dur = 0.45;
    pop(el);
    if (!c.running) {
      c.running = true;
      addTask(function (dt) {
        c.t += dt;
        var k = Math.min(1, c.t / c.dur);
        var e = 1 - Math.pow(1 - k, 3);
        c.cur = c.from + (c.to - c.from) * e;
        el.textContent = fmt(c.cur);
        if (k >= 1) { c.running = false; return false; }
      });
    }
  }

  function pop(el) {
    if (!el || reduced() || !el.animate) return;
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
  }

  /* ---- pools ---- */
  function makePool(parent, className, size) {
    var items = [];
    for (var i = 0; i < size; i++) {
      var el = document.createElement('span');
      el.className = className;
      el.setAttribute('aria-hidden', 'true');
      el.style.opacity = '0';
      parent.appendChild(el);
      items.push({ el: el, anim: null });
    }
    var idx = 0;
    return function next() {
      var item = items[idx];
      idx = (idx + 1) % items.length;
      if (item.anim) item.anim.cancel();
      return item;
    };
  }

  /* ---- tap effects on the core ---- */
  function bindTapCore(core, onTap) {
    if (!core) return;
    var stage = core.parentElement;
    var nextNumber = makePool(stage, 'fx-float', 14);
    var nextDot = makePool(stage, 'fx-dot', 20);
    var nextRing = makePool(stage, 'fx-ring', 5);

    // spring state: scale + tilt
    var s = { sc: 1, vs: 0, rx: 0, vrx: 0, ry: 0, vry: 0 };
    var target = { sc: 1, rx: 0, ry: 0 };
    var running = false;

    function stepSpring(v, x, t, dt) {
      var k = 320, d = 15;
      var a = -k * (x - t) - d * v;
      v += a * dt;
      return [v, x + v * dt];
    }
    function runSpring() {
      if (running) return;
      running = true;
      addTask(function (dt) {
        var a = stepSpring(s.vs, s.sc, target.sc, dt); s.vs = a[0]; s.sc = a[1];
        a = stepSpring(s.vrx, s.rx, target.rx, dt); s.vrx = a[0]; s.rx = a[1];
        a = stepSpring(s.vry, s.ry, target.ry, dt); s.vry = a[0]; s.ry = a[1];
        var settled = Math.abs(s.sc - 1) < 0.002 && Math.abs(s.vs) < 0.02 && Math.abs(s.rx) < 0.1 && Math.abs(s.ry) < 0.1 && Math.abs(s.vrx) < 1 && Math.abs(s.vry) < 1;
        if (settled) {
          core.style.transform = '';
          running = false;
          return false;
        }
        core.style.transform = 'perspective(500px) rotateX(' + s.rx.toFixed(2) + 'deg) rotateY(' + s.ry.toFixed(2) + 'deg) scale(' + s.sc.toFixed(3) + ')';
      });
    }

    function burst(x, y, label) {
      var n = nextNumber();
      n.el.textContent = label;
      n.el.style.left = x + 'px';
      n.el.style.top = y + 'px';
      n.anim = n.el.animate([
        { transform: 'translate(-50%,-50%) scale(0.6)', opacity: 1 },
        { transform: 'translate(-50%,-90%) scale(1.15)', opacity: 1, offset: 0.25 },
        { transform: 'translate(-50%,-260%) scale(1)', opacity: 0 }
      ], { duration: 800, easing: 'cubic-bezier(0.2,0.8,0.3,1)', fill: 'forwards' });

      var r = nextRing();
      r.el.style.left = x + 'px';
      r.el.style.top = y + 'px';
      r.anim = r.el.animate([
        { transform: 'translate(-50%,-50%) scale(0.2)', opacity: 0.7 },
        { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }
      ], { duration: 420, easing: 'ease-out', fill: 'forwards' });

      for (var i = 0; i < 4; i++) {
        var p = nextDot();
        var ang = Math.random() * Math.PI * 2;
        var dist = 26 + Math.random() * 26;
        p.el.style.left = x + 'px';
        p.el.style.top = y + 'px';
        p.anim = p.el.animate([
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          { transform: 'translate(calc(-50% + ' + (Math.cos(ang) * dist).toFixed(1) + 'px), calc(-50% + ' + (Math.sin(ang) * dist).toFixed(1) + 'px)) scale(0.2)', opacity: 0 }
        ], { duration: 480, easing: 'ease-out', fill: 'forwards' });
      }
    }

    function handle(clientX, clientY) {
      var result = onTap ? onTap() : { ok: true, label: '+1' };
      if (!result || !result.ok) return;
      haptic('impact', 'light');
      if (reduced()) return;
      var cr = core.getBoundingClientRect();
      var sr = stage.getBoundingClientRect();
      var nx = Math.max(-1, Math.min(1, ((clientX - cr.left) / cr.width - 0.5) * 2));
      var ny = Math.max(-1, Math.min(1, ((clientY - cr.top) / cr.height - 0.5) * 2));
      s.sc = 0.92; s.vs = 0;
      s.ry = nx * 10; s.rx = -ny * 10;
      s.vrx = s.vry = 0;
      runSpring();
      burst(clientX - sr.left, clientY - sr.top, result.label);
    }

    core.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      handle(e.clientX, e.clientY);
    });
    core.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      var r = core.getBoundingClientRect();
      handle(r.left + r.width / 2, r.top + r.height / 2);
    });
    core.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  /* ---- button ripples (allow-listed buttons only) ---- */
  function bindRipples() {
    var sel = '.task-action, .wallet-toast-btn, .profile-toast-btn, .shop-buy-btn, [data-ripple]';
    document.addEventListener('pointerdown', function (e) {
      if (reduced()) return;
      var btn = e.target.closest ? e.target.closest(sel) : null;
      if (!btn || btn.disabled) return;
      btn.classList.add('fx-ripple-host');
      var rect = btn.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height) * 2;
      var dot = document.createElement('span');
      dot.className = 'fx-ripple';
      dot.style.width = dot.style.height = size + 'px';
      dot.style.left = (e.clientX - rect.left - size / 2) + 'px';
      dot.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(dot);
      var anim = dot.animate([{ transform: 'scale(0)', opacity: 0.35 }, { transform: 'scale(1)', opacity: 0 }], { duration: 500, easing: 'ease-out' });
      anim.onfinish = function () { dot.remove(); };
    }, { passive: true });
  }

  /* ---- spring toast ---- */
  function toastIn(el) {
    if (!el || reduced() || !el.animate) return;
    el.animate([
      { transform: 'translateX(-50%) translateY(24px) scale(0.92)', opacity: 0 },
      { transform: 'translateX(-50%) translateY(-6px) scale(1.03)', opacity: 1, offset: 0.6 },
      { transform: 'translateX(-50%) translateY(0) scale(1)', opacity: 1 }
    ], { duration: 380, easing: 'ease-out' });
  }

  window.FX = {
    reduced: reduced,
    addTask: addTask,
    haptic: haptic,
    countTo: countTo,
    pop: pop,
    bindTapCore: bindTapCore,
    bindRipples: bindRipples,
    toastIn: toastIn
  };
})();
