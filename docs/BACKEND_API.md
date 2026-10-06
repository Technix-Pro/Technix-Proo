# Kontrakt API TechnixPro

Frontend wysyła JSON i oczekuje odpowiedzi JSON. Każdy endpoint wymaga w produkcji uwierzytelnienia Telegram Mini App w nagłówku `Authorization: tma <initData>`. Backend musi zweryfikować podpis i świeżość `initData`; wartości z `initDataUnsafe` są wyłącznie danymi do prezentacji. Błędy HTTP (`4xx`/`5xx`) są pokazywane użytkownikowi z możliwością ponowienia.

## Użytkownik i stan gry

`GET /api/me`

```json
{
  "id": 123456789,
  "username": "technix",
  "first_name": "Jan",
  "photo_url": "https://example.com/avatar.jpg",
  "language_code": "pl",
  "stars": 1280,
  "energy": 1000,
  "energyMax": 1000,
  "tp": 240,
  "taps": 0,
  "ownedParts": []
}
```

`POST /api/sync` batches the current game state after user actions and when the app is backgrounded or closed. The client caches the same payload locally and includes a unique request ID and client timestamp; the server should process requests idempotently.

```json
{
  "stars": 1280,
  "energy": 985,
  "energyMax": 1000,
  "tp": 265,
  "taps": 1,
  "ownedParts": ["monitor"],
  "clientRequestId": "uuid",
  "updatedAt": "2026-10-06T21:30:00.000Z"
}
```

Response: `{ "ok": true, "receivedAt": "2026-10-06T21:30:00.000Z" }`.

## RIG

`GET /api/rig`

```json
{ "ownedParts": ["monitor", "keyboard"] }
```

`POST /api/rig`

```json
{
  "ownedParts": ["monitor", "keyboard", "fan"],
  "updatedAt": "2026-10-06T21:30:00.000Z"
}
```

Return the saved object. Supported part keys: `monitor`, `keyboard`, `mouse`, `case`, `ram`, `gpu`, `fan`.

## Zakładki

- `GET /api/tasks` → array of `{ "title": "Aktywność w kanale", "reward": 25, "label": "Kanał" }`.
- `GET /api/leaderboard` → array of `{ "username": "technix", "first_name": "Jan", "stars": 1280 }`.
- `GET /api/referrals` → `{ "count": 2, "stars": 200 }`.
- `GET /api/notifications` → array of `{ "title": "Aktualizacja", "message": "Treść powiadomienia" }`.
- `GET /api/wallet` → `{ "balance": "0,00 PLN" }`.

Empty task, leaderboard and notification arrays are supported. The frontend displays localized empty states and a retry button after request failures.

## Tryb mock

`config.js` controls `USE_MOCK_API`, `API_BASE_URL`, and `BOT_USERNAME`. Mock data is used only when `USE_MOCK_API` is `true`; production requests use the configured base URL and Telegram authorization header.
