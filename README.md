# TechnixPro — Telegram Mini App

Static Telegram Mini App (no build step). Runs offline with mock data in `localStorage`; connect Supabase later by filling in `config.js`.

## Files

- `index.html` — shell (header, content, bottom nav); screens are rendered by `app.js`.
- `app-config.js` — feature flags and constants (levels, tasks, referral milestones, RIG parts, XP timer, events).
- `config.js` — **template** with placeholders (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BOT_USERNAME`, `ADMIN_IDS`). Fill in your own values; never put a service_role key or bot token here.
- `core.js` — pure logic (levels, referrals, tasks, achievements, validation); tested with `node --test test/core.test.js`.
- `data.js` — versioned localStorage store (`technixpro:v<STORAGE_VERSION>:*`, older versions are purged) and optional Supabase REST adapter with fallback to mock data.
- `admin-core.js` — pure admin logic (phases, feature flags, permission check, validation, stats, backup); tested with `node --test test/admin-core.test.js`.
- `admin-ui.js` — admin modal (Posty, Zadania, Eventy, Powiadomienia, Fazy, Ustawienia, Statystyki).
- `app.js` — UI: Kanał (posts + admin panel), Chat, Bonusy, Warsztat RIG, Profil.
- `rig-builder.js` — RIG assembly animation and reduced-motion handling.
- `styles.css` — styles.

## Features

- Identity from Telegram `initDataUnsafe.user` (then parsed `initData`, then a local guest ID). New users start with 0 XP, 0 ★ and 0 balance.
- Levels: Novice 0, Apprentice 500, Technician 1 500, Expert 3 500, Master 7 000, Legend 12 000, Titan 20 000 XP, each with a Font Awesome icon.
- Bonusy: overview, live events, 5 tasks (rewards in ★), referral link and milestones (10/20/50 → +100/+250/+1000 XP), achievements. XP sources: 4h timer (+20 XP) and daily bonus (+10 XP).
- Warsztat: animated assembly of the desk and six computer parts; part purchases use ★ and are saved with the user's RIG ownership.
- Chat: username, avatar, time, online count (polling; shared across tabs via localStorage, or Supabase when configured).
- Profil: avatar upload (PNG/JPEG/WebP ≤ 2 MB), user info, wallet (TON Keeper link, history, deposit/withdraw requests), settings (account, notifications, privacy, language).
- Admin panel (Kanał tab): text/images/videos/links, draft vs. published, user preview, moderation, 4h XP timer. Other users can only like and comment.

## Admin panel & phases

- Visible only for IDs in `ADMIN_IDS` (`config.js`); the header shield button opens the panel. This is a UI check — enforce it server-side with Supabase RLS before production.
- Phase 1 (Stealth): only Kanał. Phase 2 (Community): + Chat, Bonusy, Warsztat. Phase 3 (Token & Wallet): + Wallet, Shop, Airdrop. The admin always sees everything (use "Podgląd użytkownika" to see what users see). With no phase deployed, all features stay on (backward compatible).
- Admin data is kept in `localStorage` (`admin`, `admin:audit`, `admin:phases`, `admin:notifications`, `admin:trash`, `admin:history`) and mirrored best-effort to Supabase tables `admin_actions`, `phases`, `notifications`, `post_trash`. Without a backend, changes apply only on this device.
- Bottom nav: Home, TechnixPro (bonuses), Warsztat, Wallet, Profil; Chat is a header button; the clicker counter is in the header (every 100 clicks +5 XP, every 1000 +50 XP and a loot box, 10 000 an achievement).

## Social links

Buttons (X, Facebook, Instagram, Telegram, Discord, YouTube, TikTok, Oficjalna strona) appear in Profil > Profil and at the bottom of Home. Links are empty by default (button shows „Link wkrótce”). Fill them in `SOCIAL_LINKS` in `app-config.js`, or as admin in Panel > Ustawienia > Społeczność / Social (saved in the admin state, overrides the defaults). Only http(s) URLs are accepted; `t.me` links open via `Telegram.WebApp.openTelegramLink`.

## Run

```sh
python3 -m http.server 8000   # open http://localhost:8000
node --test test/*.test.js
```

## Admin

Add your Telegram ID to `ADMIN_IDS` in `config.js`. For local UI testing only, set `DEV_MODE: true` and open `/?admin=1` on localhost.

## Backend schema

Tables `users`, `tasks`, `messages`, `posts`, `referrals` (columns as in the project brief, e.g. `messages`: id, user_id, username, avatar_url, content, created_at).

## Security notes

Browser code and localStorage are untrusted; the admin check only hides UI, and XP/rewards/balances are demo values. For production verify Telegram `initData` (HMAC-SHA256 with the bot token) on a backend, enforce admin rights with RLS/server checks, award XP and referral rewards server-side, and implement real TON Connect. User content is rendered with `textContent`; only http(s) URLs are accepted.
