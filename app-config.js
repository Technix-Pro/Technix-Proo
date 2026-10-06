/*
 * Frontend runtime config. No secrets here: the bot token lives only on the backend.
 * (config.js is a separate, currently unused Supabase module, hence the name app-config.js.)
 */
(function () {
  var host = window.location.hostname;
  var isDev = window.location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || /\.local$/.test(host);

  window.TP_CONFIG = Object.freeze({
    // Base URL of the backend API ('' = same origin). null = no backend yet (local fallbacks / mock only).
    API_BASE: null,

    // MOCK PAYMENTS: simulates the whole Telegram Stars flow locally. ON only in dev (localhost/file://); must be OFF in production.
    MOCK_PAYMENTS: isDev,
    MOCK_FAIL_RATE: 0.1,

    // Global emission cycle (later served by GET /api/emission).
    EMISSION_START_AT: '2026-10-06T00:00:00Z',
    EMISSION_DURATION_DAYS: 60,
    EMISSION_SUPPLY: 100000000,

    // Global animation switch (prefers-reduced-motion is always respected too).
    ANIMATIONS_ENABLED: true
  });
})();
