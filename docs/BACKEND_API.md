# Backend API (contract used by the frontend)

All requests go to `CONFIG.API_BASE_URL` and carry the header `X-Telegram-Init-Data: <Telegram.WebApp.initData>`.
**The backend must verify this string (HMAC-SHA256 with the bot token) and derive the user id from it; never trust ids sent in the body.**
Errors: non-2xx status with `{ "error": "message" }`. The frontend shows an error state with a "Spróbuj ponownie" action.

## GET /api/me
```json
{ "tp": 1250, "taps": 480, "energy": 870, "stars": 1280 }
```
The source of truth for game state after start-up (the local cache is only a fallback).

## GET /api/rig
```json
{ "owned": { "monitor": true, "keyboard": true, "fan": false } }
```
Part keys: `mouse`, `keyboard`, `monitor`, `case`, `ram`, `gpu`, `fan`.

## POST /api/rig
Request `{ "part": "fan" }` → same body as `GET /api/rig`. For paid parts the backend must confirm the Telegram Stars (XTR) payment before marking a part as owned.

## POST /api/sync
Batched, debounced (and sent on `visibilitychange` / `beforeunload`).
```json
{ "clientRequestId": "lq3x9k2a8f", "clientTime": 1760000000000,
  "state": { "stars": 1280, "rigParts": { "monitor": true } } }
```
Response `{ "ok": true, "serverTime": 1760000000500 }`. Use `clientRequestId` for idempotency.

## GET /api/tasks
`[ { "id": "t1", "title": "Aktywność w kanale", "reward": 25, "label": "Kanał", "done": false } ]`

## GET /api/leaderboard
`[ { "rank": 1, "userId": 123, "username": "name", "score": 99999 } ]`

## GET /api/referrals
`{ "count": 3, "earned": 300, "items": [ { "userId": 456, "username": "friend", "joinedAt": "2026-01-01T00:00:00Z" } ] }`
Referral link: `https://t.me/<BOT_USERNAME>?start=ref_<telegramId>`.

## GET /api/notifications
`[ { "id": "n1", "title": "Tekst", "createdAt": "2026-01-01T00:00:00Z", "read": false } ]`

## GET /api/wallet
`{ "balance": 0, "history": [ { "id": "w1", "type": "reward", "amount": 25, "createdAt": "2026-01-01T00:00:00Z" } ] }`
