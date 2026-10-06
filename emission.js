/*
 * Global emission cycle: EMISSION_START_AT + EMISSION_DURATION_DAYS, independent of the session.
 * Time comes from the server (GET /api/emission -> serverTime) with a monotonic clock offset, so changing the phone clock
 * does not affect the countdown. Without a backend it falls back to Date.now(). Nothing is persisted.
 */
(function () {
  var cfg = window.TP_CONFIG || {};
  var DAY_MS = 86400000;
  var params = {
    startAt: Date.parse(cfg.EMISSION_START_AT),
    durationDays: cfg.EMISSION_DURATION_DAYS || 60,
    supply: cfg.EMISSION_SUPPLY || 100000000
  };
  var minedOverride = null;
  var synced = false;
  var settled = false; // first sync attempt finished (success or fallback)
  var baseServer = 0;
  var basePerf = 0;
  var listeners = [];
  var timer = null;

  function now() {
    return synced ? baseServer + (performance.now() - basePerf) : Date.now();
  }

  function snapshot() {
    var durationMs = params.durationDays * DAY_MS;
    var t = now();
    var elapsed = Math.min(durationMs, Math.max(0, t - params.startAt));
    var remainingMs = durationMs - elapsed;
    var ended = elapsed >= durationMs;
    var mined = minedOverride !== null ? Math.min(params.supply, Math.max(0, minedOverride)) : params.supply * (elapsed / durationMs);
    var status = !settled ? 'Syncing' : ended ? 'Ended' : t < params.startAt ? 'Upcoming' : 'Live';
    return {
      status: status,
      ended: ended,
      supply: params.supply,
      mined: mined,
      ratio: params.supply ? mined / params.supply : 0,
      perDay: params.supply / params.durationDays,
      remainingMs: remainingMs,
      remainingText: formatRemaining(remainingMs),
      synced: synced
    };
  }

  function formatRemaining(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var d = Math.floor(s / 86400);
    var h = Math.floor((s % 86400) / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    function p(n) { return String(n).padStart(2, '0'); }
    return d + 'd ' + p(h) + ':' + p(m) + ':' + p(sec);
  }

  function emit() {
    var snap = snapshot();
    listeners.forEach(function (fn) { fn(snap); });
  }

  function sync() {
    if (typeof cfg.API_BASE !== 'string') { settled = true; emit(); return Promise.resolve(); }
    var t0 = performance.now();
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var abort = controller ? setTimeout(function () { controller.abort(); }, 4000) : null;
    return fetch((cfg.API_BASE || '') + '/api/emission', { signal: controller ? controller.signal : undefined })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (data) {
        var startAt = Date.parse(data.startAt);
        var serverTime = Date.parse(data.serverTime);
        if (isNaN(startAt) || isNaN(serverTime)) throw new Error('Invalid emission response');
        params.startAt = startAt;
        if (data.durationDays > 0) params.durationDays = data.durationDays;
        if (data.supply > 0) params.supply = data.supply;
        minedOverride = typeof data.minedGlobal === 'number' ? data.minedGlobal : null;
        var rtt = performance.now() - t0;
        baseServer = serverTime + rtt / 2;
        basePerf = performance.now();
        synced = true;
      })
      .catch(function () { /* no backend: keep Date.now() fallback */ })
      .then(function () { if (abort) clearTimeout(abort); settled = true; emit(); });
  }

  function start() {
    if (timer) return;
    emit();
    timer = setInterval(emit, 1000);
  }
  function stop() {
    clearInterval(timer);
    timer = null;
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stop(); return; }
    emit();
    start();
    sync();
  });

  window.Emission = {
    subscribe: function (fn) { listeners.push(fn); fn(snapshot()); },
    snapshot: snapshot,
    formatRemaining: formatRemaining,
    init: function () { start(); return sync(); }
  };
})();
