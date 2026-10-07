// Telegram Stars payments: invoice link from a backend (Bot API createInvoiceLink/sendInvoice), paid via WebApp.openInvoice.
(function (root) {
  'use strict';
  function cfg() { return root.TP_CONFIG || {}; }
  function sec() { return root.TECHNIX_CONFIG || {}; }
  function tgApp() { return root.Telegram && root.Telegram.WebApp; }

  function sortedByPrice(parts) {
    return parts.slice().sort(function (a, b) { return (a.stars - b.stars) || String(a.key).localeCompare(String(b.key)); });
  }
  function plnFor(stars) { return Math.round(stars / (cfg().STARS_PER_PLN || 10) * 100) / 100; }
  function isAvailable() {
    var app = tgApp();
    return /^https:\/\//.test(sec().INVOICE_ENDPOINT || '') && !!app && typeof app.openInvoice === 'function' && !!app.initData;
  }

  function requestInvoice(part, user, fetchFn) {
    var f = fetchFn || root.fetch;
    var app = tgApp();
    return f(sec().INVOICE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ part_key: part.key, stars: part.stars, user_id: user.id, init_data: app ? app.initData : '' })
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || typeof j.invoice_link !== 'string' || j.invoice_link.indexOf('https://') !== 0) throw new Error('invalid_invoice');
      return j.invoice_link;
    });
  }

  // cb(status): 'paid' | 'cancelled' | 'failed' | 'pending'
  function pay(part, user, cb, fetchFn) {
    requestInvoice(part, user, fetchFn).then(function (link) {
      try { tgApp().openInvoice(link, function (status) { cb(status === 'paid' ? 'paid' : status === 'cancelled' ? 'cancelled' : status === 'pending' ? 'pending' : 'failed'); }); }
      catch (e) { cb('failed'); }
    }, function () { cb('failed'); });
  }

  var api = { sortedByPrice: sortedByPrice, plnFor: plnFor, isAvailable: isAvailable, requestInvoice: requestInvoice, pay: pay };
  root.TPPay = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
