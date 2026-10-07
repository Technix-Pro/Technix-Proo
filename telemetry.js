// Analytics + offline queue + retry. Events go to Supabase `analytics`; kept in localStorage until delivered.
(function (root) {
  'use strict';
  var MAX_QUEUE = 200;

  function create(opts) {
    var queue = [], flushing = false, retryTimer = null, failures = 0;
    var storage = opts.storage, key = opts.storageKey || 'technixpro:v2:analytics_queue';
    try { queue = JSON.parse(storage.getItem(key) || '[]'); if (!Array.isArray(queue)) queue = []; } catch (e) { queue = []; }
    function persist() { try { storage.setItem(key, JSON.stringify(queue)); } catch (e) { /* storage unavailable */ } }
    function enabled() { return !!opts.url && !!opts.key; }
    function online() { return opts.isOnline ? opts.isOnline() : true; }

    function flush() {
      if (flushing || !queue.length || !enabled() || !online()) return Promise.resolve(false);
      flushing = true;
      var batch = queue.slice(0, 50);
      return opts.fetch(opts.url.replace(/\/$/, '') + '/rest/v1/analytics', {
        method: 'POST',
        headers: { apikey: opts.key, Authorization: 'Bearer ' + opts.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(batch)
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        queue = queue.slice(batch.length); failures = 0; persist(); flushing = false;
        return queue.length ? flush() : true;
      }).catch(function () {
        flushing = false; failures += 1;
        var delay = Math.min(60000, 1000 * Math.pow(2, failures));
        if (opts.setTimeout) { opts.clearTimeout(retryTimer); retryTimer = opts.setTimeout(flush, delay); }
        return false;
      });
    }
    function track(type, data, userId) {
      queue.push({ user_id: userId == null ? null : userId, event_type: String(type), event_data: data || {}, timestamp: new Date().toISOString() });
      if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
      persist();
      return flush();
    }
    return { track: track, flush: flush, size: function () { return queue.length; } };
  }

  var api = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.TECHNIX_CONFIG || root.TP_CONFIG) {
    var S = root.TECHNIX_CONFIG || {};
    var ok = /^https:\/\//.test(S.SUPABASE_URL || '') && !!S.SUPABASE_ANON_KEY && S.SUPABASE_ANON_KEY.indexOf('TUTAJ') === -1;
    var store; try { store = root.localStorage; store.getItem('x'); } catch (e) { store = { getItem: function () { return null; }, setItem: function () {} }; }
    var inst = create({
      url: ok ? S.SUPABASE_URL : '', key: ok ? S.SUPABASE_ANON_KEY : '', storage: store,
      fetch: function (u, o) { return root.fetch(u, o); },
      isOnline: function () { return root.navigator ? root.navigator.onLine !== false : true; },
      setTimeout: function (f, ms) { return root.setTimeout(f, ms); }, clearTimeout: function (t) { root.clearTimeout(t); }
    });
    api.track = inst.track; api.flush = inst.flush; api.size = inst.size;
    if (root.addEventListener) root.addEventListener('online', function () { inst.flush(); });
  }
  root.TPTelemetry = api;
})(typeof window !== 'undefined' ? window : globalThis);
