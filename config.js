// Private template: fill in your own values. Leave placeholders to run fully offline with mock data (localStorage).
// The Supabase anon key is public by design, but NEVER put a service_role key or the bot token in this file.
window.TECHNIX_CONFIG = {
  SUPABASE_URL: 'TUTAJ WSTAW SWÓJ URL',
  SUPABASE_ANON_KEY: 'TUTAJ WSTAW SWÓJ KEY',
  BOT_USERNAME: 'TechnixProBot',
  // Telegram IDs allowed to see the admin panel (UI only; enforce on the backend with RLS / initData verification).
  ADMIN_IDS: [],
  // Local testing only: allows ?admin=1 on localhost. Keep false in production.
  DEV_MODE: false
};
