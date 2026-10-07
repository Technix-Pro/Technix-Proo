// Private template: fill in your own values. Leave placeholders to run fully offline with mock data (localStorage).
// The Supabase anon key is public by design, but NEVER put a service_role key or the bot token in this file.
window.TECHNIX_CONFIG = {
  SUPABASE_URL: 'https://yvzackedovkrdnraznbl.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_WrCP0j-ngvGRYYS8bAAACQ_7W0jwa3b',
  BOT_USERNAME: 'TechnixProBot',
  // Telegram IDs allowed to see the admin panel (UI only; enforce on the backend with RLS / initData verification).
  ADMIN_IDS: [7777540542],
  // Local testing only: allows ?admin=1 on localhost. Keep false in production.
  DEV_MODE: false,
  // Telegram Stars & Payments
  INVOICE_ENDPOINT: 'https://yvzackedovkrdnraznbl.supabase.co/functions/v1/smooth-service',
  PAYMENTS_ENABLED: true,
  CURRENCY: 'PLN'
};
