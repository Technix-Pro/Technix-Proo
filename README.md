# TechnixPro — Telegram Mini App

Static Telegram Mini App (no build step). Runs offline with mock data in `localStorage`; connect Supabase later by filling in `config.js`.

## Files

- `index.html` — shell (header, content, bottom nav); screens are rendered by `app.js`.
- `app-config.js` — feature flags and constants (levels, tasks, referral milestones, XP timer, events).
- `config.js` — **template** with placeholders (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BOT_USERNAME`, `ADMIN_IDS`). Fill in your own values; never put a service_role key or bot token here.
- `core.js` — pure logic (levels, referrals, tasks, achievements, validation); tested with `node --test test/core.test.js`.
- `data.js` — versioned localStorage store (`technixpro:v<STORAGE_VERSION>:*`, older versions are purged) and optional Supabase REST adapter with fallback to mock data.
- `app.js` — UI: Kanał (posts + admin panel), Chat, Bonusy, Profil.
- `styles.css` — styles.

## Features

- Identity from Telegram `initDataUnsafe.user` (then parsed `initData`, then a local guest ID). New users start with 0 XP, 0 ★ and 0 balance.
- Levels: Novice 0, Apprentice 500, Technician 1 500, Expert 3 500, Master 7 000, Legend 12 000, Titan 20 000 XP, each with a Font Awesome icon.
- Bonusy: overview, live events, 5 tasks (rewards in ★), referral link and milestones (10/20/50 → +100/+250/+1000 XP), achievements. XP sources: 4h timer (+20 XP) and daily bonus (+10 XP).
- Chat: username, avatar, time, online count (polling; shared across tabs via localStorage, or Supabase when configured).
- Profil: avatar upload (PNG/JPEG/WebP ≤ 2 MB), user info, wallet (TON Keeper link, history, deposit/withdraw requests), settings (account, notifications, privacy, language).
- Admin panel (Kanał tab): text/images/videos/links, draft vs. published, user preview, moderation, 4h XP timer. Other users can only like and comment.

## Run

```sh
python3 -m http.server 8000   # open http://localhost:8000
node --test test/core.test.js
```

## Admin

Add your Telegram ID to `ADMIN_IDS` in `config.js`. For local UI testing only, set `DEV_MODE: true` and open `/?admin=1` on localhost.

## Backend schema

Tables `users`, `tasks`, `messages`, `posts`, `referrals` (columns as in the project brief, e.g. `messages`: id, user_id, username, avatar_url, content, created_at).

## Security notes

Browser code and localStorage are untrusted; the admin check only hides UI, and XP/rewards/balances are demo values. For production verify Telegram `initData` (HMAC-SHA256 with the bot token) on a backend, enforce admin rights with RLS/server checks, award XP and referral rewards server-side, and implement real TON Connect. User content is rendered with `textContent`; only http(s) URLs are accepted.
