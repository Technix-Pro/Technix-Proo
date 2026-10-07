// Telegram Stars & TON payments integration
(function () {
  'use strict';
  
  var CFG = window.TECHNIX_CONFIG;
  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  
  window.TPPayments = {
    pending: {},
    QUEUE_KEY: 'technixpro:payments:queue',

    // Send Telegram Stars invoice (smooth-service). Resolves { ok, invoice_id, invoice_link } or { ok:false, error, retryable }
    sendStarsInvoice: function (userId, amount, title, description, payload) {
      if (!CFG.INVOICE_ENDPOINT) {
        console.warn('Payments: endpoint not configured');
        return Promise.resolve({ ok: false, error: 'endpoint_not_configured' });
      }
      var body = { user_id: userId, amount: amount, title: title, description: description, payload: payload, currency: CFG.CURRENCY };
      return fetch(CFG.INVOICE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(function (res) {
        if (!res.ok) throw new Error('Payment request failed: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data && data.invoice_link) {
          console.log('Invoice ID:', data.invoice_link);
          return { ok: true, invoice_id: data.invoice_link, invoice_link: data.invoice_link };
        }
        if (data && data.ok && data.result) {
          console.log('Invoice ID:', data.result.message_id);
          return { ok: true, invoice_id: String(data.result.message_id) };
        }
        throw new Error((data && data.description) || 'Unknown error');
      })
      .catch(function (err) {
        console.error('Payment error:', err);
        var network = err instanceof TypeError;
        if (network) window.TPPayments.queueRequest(body);
        return { ok: false, error: err.message, retryable: true, queued: network };
      });
    },

    // Offline queue: requests that failed on network errors are kept and retried on next load
    queueRequest: function (body) {
      try {
        var q = JSON.parse(localStorage.getItem(window.TPPayments.QUEUE_KEY) || '[]');
        q.push(body);
        localStorage.setItem(window.TPPayments.QUEUE_KEY, JSON.stringify(q.slice(-20)));
      } catch (e) { /* storage unavailable */ }
    },
    retryQueued: function () {
      var P = window.TPPayments, q = [];
      try { q = JSON.parse(localStorage.getItem(P.QUEUE_KEY) || '[]'); localStorage.removeItem(P.QUEUE_KEY); } catch (e) { return Promise.resolve([]); }
      return Promise.all(q.map(function (b) { return P.sendStarsInvoice(b.user_id, b.amount, b.title, b.description, b.payload); }));
    },

    // Register callbacks for an invoice and listen for Telegram's invoiceClosed event / openInvoice status
    trackInvoice: function (invoiceId, handlers) {
      window.TPPayments.pending[invoiceId] = handlers || {};
    },
    handlePaymentCallback: function (invoiceId, success) {
      var P = window.TPPayments, entry = P.pending[invoiceId];
      if (!entry) return false;
      delete P.pending[invoiceId];
      if (success) { if (entry.onPaid) entry.onPaid(); } else if (entry.onCancel) entry.onCancel();
      return true;
    },
    openInvoice: function (invoiceLink) {
      var P = window.TPPayments;
      if (tg && tg.openInvoice && invoiceLink) {
        tg.openInvoice(invoiceLink, function (status) { P.handlePaymentCallback(invoiceLink, status === 'paid'); });
        return true;
      }
      return false;
    },

    // TON Keeper integration
    connectTONKeeper: function () {
      if (typeof window.tonconnect !== 'undefined') {
        return { ok: true, message: 'TON Keeper connected' };
      }
      if (tg && tg.openLink) {
        tg.openLink('https://app.tonkeeper.com/');
        return { ok: true, message: 'Opening TON Keeper...' };
      }
      return { ok: false, error: 'TON Keeper not available' };
    },

    // Validate payment amount
    validateAmount: function (amount, type) {
      if (!amount || isNaN(amount) || amount <= 0) {
        return { ok: false, error: 'Kwota musi byc wieksza niz 0' };
      }
      if (type === 'withdraw' && amount > 10000) {
        return { ok: false, error: 'Maksymalna wyplata to 10000 TON' };
      }
      return { ok: true, value: parseFloat(amount) };
    },

    // Format price for display
    formatPrice: function (stars) {
      var pln = stars / 10;
      return pln.toFixed(2) + ' PLN (~' + stars + ' stars)';
    }
  };
})();
