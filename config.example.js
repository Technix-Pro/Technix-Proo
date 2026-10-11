// Copy to config.js and replace placeholders with public values only. Never add a service_role key or bot token.
window.TECHNIX_CONFIG = {
  SUPABASE_URL: 'https://TUTAJ.supabase.co',
  SUPABASE_ANON_KEY: 'TUTAJ',
  // Empty uses the default /functions/v1/auth-telegram endpoint derived from SUPABASE_URL.
  AUTH_ENDPOINT: '',
  // Optional Telegram Stars invoice function.
  INVOICE_ENDPOINT: '',
  REPORT_BUG_URL: 'https://github.com/Technix-Pro/Technix-Proo/issues/new',
  ADMIN_IDS: [],
  BOT_USERNAME: 'TUTAJ',
  BOT_ID: 'TUTAJ',
  DEV_MODE: false,
  PAYMENTS_ENABLED: false,
  CURRENCY: 'PLN'
};
