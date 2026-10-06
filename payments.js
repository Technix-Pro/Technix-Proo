/*
 * Payments layer (Telegram Stars / XTR). Backend contract: docs/BACKEND_API.md.
 * The client never grants goods itself: after `paid` it asks the server (verify / purchases) and renders what the server returns.
 * MOCK_PAYMENTS (app-config.js) simulates everything locally and is only meant for development.
 */
(function () {
  var cfg = window.TP_CONFIG || {};
  var MOCK = !!cfg.MOCK_PAYMENTS;
  var MOCK_KEY = 'tp_mock_shop_v1';
  var inflight = Object.create(null);

  function tgApp() { return window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null; }
  function inTelegram() { var t = tgApp(); return !!(t && t.initData); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function newRequestId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function findProduct(id) {
    var list = window.SHOP_CATALOG || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function apiFetch(path, options) {
    if (typeof cfg.API_BASE !== 'string') return Promise.reject(new Error('Backend not configured'));
    var t = tgApp();
    var opts = options || {};
    var headers = { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': t && t.initData ? t.initData : '' };
    return fetch((cfg.API_BASE || '') + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  /* ---- mock store (localStorage only in mock mode) ---- */
  function mockLoad() {
    try {
      var data = JSON.parse(localStorage.getItem(MOCK_KEY) || 'null');
      if (data && typeof data.owned === 'object' && Array.isArray(data.purchases)) return data;
    } catch (e) { /* ignore */ }
    return { owned: {}, purchases: [] };
  }
  function mockSave(data) {
    try { localStorage.setItem(MOCK_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  /* ---- API wrappers ---- */
  function createInvoice(productId, clientRequestId) {
    return apiFetch('/api/shop/invoice', { method: 'POST', body: { productId: productId, clientRequestId: clientRequestId } })
      .then(function (data) {
        if (!data || typeof data.invoiceUrl !== 'string') throw new Error('Invalid invoice response');
        return data.invoiceUrl;
      });
  }

  function fetchPurchases() {
    if (MOCK) return Promise.resolve(mockLoad());
    return apiFetch('/api/shop/purchases');
  }

  function verify(productId, clientRequestId) {
    if (MOCK) return Promise.resolve(mockLoad());
    return apiFetch('/api/shop/verify', { method: 'POST', body: { productId: productId, clientRequestId: clientRequestId } });
  }

  function loadMe() {
    if (MOCK) return Promise.resolve(mockLoad());
    return apiFetch('/api/me');
  }

  function openInvoice(invoiceUrl) {
    return new Promise(function (resolve) {
      var t = tgApp();
      if (!t || typeof t.openInvoice !== 'function') { resolve('failed'); return; }
      try {
        t.openInvoice(invoiceUrl, function (status) { resolve(status); });
      } catch (e) { resolve('failed'); }
    });
  }

  /* After `paid`/`pending` the server is the source of truth. */
  function confirmWithServer(productId, clientRequestId, attempts) {
    var left = attempts;
    function step() {
      return verify(productId, clientRequestId).then(function (data) {
        var p = (data.purchases || []).filter(function (x) { return x.productId === productId && x.status === 'paid'; });
        if (p.length || left <= 1) return data;
        left--;
        return sleep(2000).then(step);
      });
    }
    return step();
  }

  function mockPurchase(product) {
    return sleep(1400).then(function () {
      if (Math.random() < (cfg.MOCK_FAIL_RATE || 0)) return { status: 'failed', mock: true };
      var data = mockLoad();
      data.owned[product.id] = (data.owned[product.id] || 0) + 1;
      data.purchases.unshift({ id: 'mock-' + newRequestId(), productId: product.id, priceXtr: product.priceXtr, status: 'paid', createdAt: new Date().toISOString() });
      mockSave(data);
      return { status: 'paid', mock: true, data: data };
    });
  }

  /*
   * purchase(productId) -> Promise<{ status: 'paid'|'cancelled'|'failed'|'pending'|'unavailable'|'busy', data?, mock? }>
   * `data` is the server-confirmed state ({ owned, purchases }).
   */
  function purchase(productId) {
    var product = findProduct(productId);
    if (!product) return Promise.resolve({ status: 'failed' });
    if (inflight[productId]) return Promise.resolve({ status: 'busy' });
    inflight[productId] = true;
    var clientRequestId = newRequestId();

    var flow;
    if (MOCK) {
      flow = mockPurchase(product);
    } else if (!inTelegram() || typeof tgApp().openInvoice !== 'function') {
      flow = Promise.resolve({ status: 'unavailable' });
    } else {
      flow = createInvoice(productId, clientRequestId)
        .then(openInvoice)
        .then(function (status) {
          if (status === 'paid' || status === 'pending') {
            return confirmWithServer(productId, clientRequestId, status === 'paid' ? 3 : 5).then(function (data) {
              var confirmed = (data.purchases || []).some(function (x) { return x.productId === productId && x.status === 'paid'; });
              return { status: confirmed ? 'paid' : 'pending', data: data };
            });
          }
          return { status: status === 'cancelled' ? 'cancelled' : 'failed' };
        })
        .catch(function () { return { status: 'failed' }; });
    }

    return flow.then(function (result) { delete inflight[productId]; return result; },
      function () { delete inflight[productId]; return { status: 'failed' }; });
  }

  window.Payments = {
    isMock: MOCK,
    inTelegram: inTelegram,
    findProduct: findProduct,
    purchase: purchase,
    isBusy: function (id) { return !!inflight[id]; },
    createInvoice: createInvoice,
    fetchPurchases: fetchPurchases,
    verify: verify,
    loadMe: loadMe
  };
})();
