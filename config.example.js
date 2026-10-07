// Copy to config.js and fill in. The anon key is public; NEVER add a service_role key or the bot token here.
window.TECHNIX_CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',
  BOT_USERNAME: 'YourBotUsername',
  BOT_ID: '123456789',
  // Endpoint that creates a Telegram Stars invoice link (see DEPLOYMENT.md). Empty = Stars payments off.
  INVOICE_ENDPOINT: 'https://YOUR-PROJECT.supabase.co/functions/v1/create-invoice',
  // Edge Function that verifies Telegram initData and returns a JWT (see DEPLOYMENT.md). Empty = offline/mock mode.
  AUTH_ENDPOINT: 'https://YOUR-PROJECT.supabase.co/functions/v1/auth-telegram',
  REPORT_BUG_URL: 'https://github.com/Technix-Pro/Technix-Proo/issues/new',
  ADMIN_IDS: [123456789],
  DEV_MODE: false
};
