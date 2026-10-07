// Telegram Stars & TON payments integration
(function () {
  'use strict';
  
  var CFG = window.TECHNIX_CONFIG;
  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  
  window.TPPayments = {
    // Send Telegram Stars invoice
    sendStarsInvoice: function (userId, amount, title, description, payload) {
      if (!CFG.INVOICE_ENDPOINT) {
        console.warn('Payments: endpoint not configured');
        return Promise.reject({ error: 'endpoint_not_configured' });
      }
      
      return fetch(CFG.INVOICE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          amount: amount,
          title: title,
          description: description,
          payload: payload,
          currency: CFG.CURRENCY
        })
      })
      .then(function (res) {
        if (!res.ok) throw new Error('Payment request failed: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data.ok) {
          console.log('Invoice sent successfully');
          return { ok: true, invoice_id: data.result.message_id };
        }
        throw new Error(data.description || 'Unknown error');
      })
      .catch(function (err) {
        console.error('Payment error:', err);
        return { ok: false, error: err.message };
      });
    },

    // Handle successful payment (webhook callback)
    onPaymentSuccess: function (payload, callback) {
      if (!tg) return;
      if (tg.onEvent) {
        tg.onEvent('invoice_closed', function (data) {
          if (data.status === 'paid') {
            callback({ ok: true, payload: payload });
          }
        });
      }
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
