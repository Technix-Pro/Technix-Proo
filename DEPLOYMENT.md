# Deployment & backend setup (Stage 1)

The app runs offline with mock data when `config.js` has no Supabase values. This guide connects it to Supabase.

## 1. Supabase project
1. Create a project at supabase.com. Note the **Project URL**, **anon key**, and (Settings → API → JWT Settings) the **JWT secret**.
2. In the SQL editor run, in order:
   1. `supabase-engagement.sql`
   2. `supabase/migrations/20261007000000_stage1_backend_foundation.sql`
   3. `supabase/migrations/20261008000000_stage2_progression_rpcs.sql` (server-side claim/purchase RPCs, seeded default tasks)
   (or `supabase db push` if you use the Supabase CLI).
3. Make yourself the first admin (your numeric Telegram ID; get it from @userinfobot):
   ```sql
   insert into admins (telegram_id, role) values (123456789, 'owner');
   ```
   Admin rights live only in the `admins` table, never in `config.js`.

## 2. Auth Edge Function
```sh
supabase functions deploy auth-telegram --no-verify-jwt
supabase secrets set TELEGRAM_BOT_TOKEN=<token from @BotFather> APP_JWT_SECRET=<project JWT secret>
# optional: supabase secrets set ALLOWED_ORIGIN=https://your-host
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically. Never put the bot token or service_role key in `config.js` or the repo.

Contract: `POST /functions/v1/auth-telegram` with `{ "initData": "<Telegram.WebApp.initData>" }` →
`{ token, expires_at, role, user }` (401 `{error}` if the signature is bad or older than 1 h).
The `token` is an HS256 JWT (`role: authenticated`, claims `telegram_id`, `tp_role`). Send it as the bearer token in the `Authorization` header (with the anon key as `apikey`) to Supabase REST/Realtime; RLS then identifies the user via `tp_uid()` and admins via `is_admin()`.

## 3. Telegram bot
1. @BotFather → `/newbot` (or reuse yours) → copy the token (used only as the secret above).
2. `/newapp` or Bot Settings → Menu Button → set the URL of the hosted static site (HTTPS required).
3. Set `BOT_USERNAME` / `BOT_ID` (the number before `:` in the token) in `config.js`.

## 4. Frontend config
Copy `config.example.js` to `config.js` and fill `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BOT_USERNAME`, `BOT_ID`, `AUTH_ENDPOINT`. `ADMIN_IDS` only hides UI; the real check is RLS. Leave values as placeholders to stay in offline/mock mode.

## 5. Run locally
```sh
python3 -m http.server 8000     # http://localhost:8000 (mock data unless config.js is filled in)
node --test test/*.test.js      # unit tests (includes Telegram initData verification)
```
Telegram requires HTTPS for real Mini App testing; use a tunnel (e.g. `cloudflared tunnel --url http://localhost:8000`) and point the bot's menu button at it.

## Security model
- Clients can only read their own rows, published content, and public settings; they cannot write `xp`, `stars`, `balance`, or progress tables directly.
- Admin writes (tasks, posts, settings, phases, flags, notifications, sponsors…) require `is_admin()`; `admin_actions` is an append-only audit log.
- Reward/claim logic runs in server RPCs (Stage 2): `tp_claim_timer`, `tp_claim_daily`, `tp_claim_task`, `tp_buy_rig_part`, `tp_register_referral`, `tp_claim_referrals`, `tp_sync_clicks`, `tp_request_wallet`, `tp_leaderboard`.
- Frontend (`data.js` + `backend-adapter.js`): with Supabase configured and Telegram `initData` present, the app authenticates via `auth-telegram`, loads the user's progress and admin content, applies actions optimistically and then replaces local numbers with the server's. Without config/initData/network it keeps working on `localStorage` mock data. Existing local-only progress is not migrated (the server is authoritative).
- Admin changes (tasks, posts, notifications, phases/flags/config/events) are written to Supabase only when the session role is admin; all users fetch them on start and every 60 s. Withdraw requests reserve the balance immediately; refund a rejected one manually (SQL: add the amount back to `users.balance` and set the transaction to `rejected`). Likes/comments and parts paid with Telegram Stars remain local until a payment webhook/server support exists.
