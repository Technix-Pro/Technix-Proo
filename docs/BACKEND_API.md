# TechnixPro – backend API contract

The frontend is plain HTML/CSS/JS. Set `API_BASE` in `app-config.js` (`null` = no backend; `''` = same origin). All requests send
`X-Telegram-Init-Data: <Telegram.WebApp.initData>` and JSON bodies. **Never put the bot token in the frontend.**

## Auth: verifying `initData`
On every request the server must validate `initData` (HMAC-SHA256 with key `HMAC_SHA256("WebAppData", BOT_TOKEN)` over the sorted
`key=value` lines without `hash`), compare with `hash` in constant time, and reject if `auth_date` is too old (e.g. > 24 h).
The user id is taken only from the validated `initData`, never from the request body.

## Telegram Stars (XTR) payments
Digital goods sold inside Mini Apps must be paid with **Telegram Stars (currency `XTR`)**. Internal activity points (★ / TP) are not
a shop currency.

Flow:
1. Client: `POST /api/shop/invoice` `{ "productId": "gpu", "clientRequestId": "<uuid>" }`.
2. Server: looks up the product price in its own catalog (mirror of `shop-config.js`; never trust a client price) and calls Bot API
   `createInvoiceLink` with `currency: "XTR"`, empty `provider_token`, exactly one item in `prices` (`[{ "label": "GPU", "amount": 200 }]`),
   and `payload` = server-generated id binding user + product + `clientRequestId`. Responds `{ "invoiceUrl": "https://t.me/$..." }`.
3. Client: `Telegram.WebApp.openInvoice(invoiceUrl, cb)`; `cb` gets `paid | cancelled | failed | pending`.
4. Server: receives `pre_checkout_query` → validates payload/product/stock and calls `answerPreCheckoutQuery(ok=true)` within 10 s.
5. Server: receives `successful_payment` (webhook update) → stores `telegram_payment_charge_id`, grants the product **once** (unique key on
   charge id and on `clientRequestId`).
6. Client on `paid`/`pending`: **does not grant anything itself**; calls `POST /api/shop/verify` (retries a few times while `pending`)
   and renders the returned state.

### Idempotency
`clientRequestId` (UUID generated per purchase attempt) is stored with the invoice. Repeating `POST /api/shop/invoice` with the same id
returns the same invoice; `successful_payment` is processed at most once per `telegram_payment_charge_id`. `maxOwned` is enforced server-side.

### Refunds
Refunds use `refundStarPayment(user_id, telegram_payment_charge_id)`. After a refund the purchase gets `status: "refunded"` and the
goods are revoked; the next `GET /api/me` / `GET /api/shop/purchases` reflects it.

### Endpoints
`POST /api/shop/invoice` → `200 { "invoiceUrl": string }` (`409` if `maxOwned` reached, `404` unknown product).

`POST /api/shop/verify` `{ "productId", "clientRequestId" }` → purchases state (below).

`GET /api/shop/purchases` → purchases state:
```json
{
  "owned": { "gpu": 1, "boost_energy": 1 },
  "purchases": [
    { "id": "p_123", "productId": "gpu", "priceXtr": 200, "status": "paid", "createdAt": "2026-10-06T12:00:00Z" }
  ]
}
```
`status`: `paid | pending | refunded | failed`. `owned` counts only paid, non-refunded purchases.

### Product catalog
`shop-config.js`: `id`, `title`, `description`, `priceXtr` (integer), `type` (`rig_part | boost | cosmetic`), `icon`, `effect`, `maxOwned`, optional `phase`.
The server keeps the authoritative copy (it may later serve it from `/api/config`).

## Profile
`GET /api/me` →
```json
{ "user": { "id": 1, "username": "name" }, "owned": { "gpu": 1 }, "purchases": [ ], "stars": 1280, "tp": 240 }
```
The frontend restores owned goods from `owned`. Without a backend, localStorage is used **only in `MOCK_PAYMENTS` mode**.

## Emission (global 60-day cycle)
`GET /api/emission` →
```json
{ "startAt": "2026-10-06T00:00:00Z", "durationDays": 60, "supply": 100000000, "serverTime": "2026-10-20T10:00:00Z", "minedGlobal": 23333338 }
```
`minedGlobal` is optional; if absent the client computes `supply * min(1, elapsed / duration)`. The client derives a clock offset from
`serverTime` (compensating half the round-trip), so changing the phone clock does not affect the countdown; it re-syncs when the app becomes visible again.
Without a backend it uses `EMISSION_START_AT` / `EMISSION_DURATION_DAYS` / `EMISSION_SUPPLY` from `app-config.js` and `Date.now()`.

## Mock mode
`MOCK_PAYMENTS: true` (default only on localhost / `file://`) simulates the whole payment flow in the browser and is clearly marked
in the shop UI. It must be `false` in production (the config enables it automatically only for dev hosts).
# Kontrakt API TechnixPro

Frontend wysyła żądania do `API_BASE_URL`. Odpowiedzi JSON powinny używać liczb dla sald/liczników i zwracać puste kolekcje zamiast `null`. Każde żądanie z Telegrama zawiera `X-Telegram-Init-Data`; serwer musi sprawdzić jego podpis i aktualność przed przypisaniem danych do użytkownika.

## Użytkownik — `GET /api/me`

Odpowiedź:
Frontend wysyła JSON i oczekuje odpowiedzi JSON. Każdy endpoint wymaga w produkcji uwierzytelnienia Telegram Mini App w nagłówku `Authorization: tma <initData>`. Backend musi zweryfikować podpis i świeżość `initData`; wartości z `initDataUnsafe` są wyłącznie danymi do prezentacji. Błędy HTTP (`4xx`/`5xx`) są pokazywane użytkownikowi z możliwością ponowienia.

## Użytkownik i stan gry

`GET /api/me`

```json
{
  "id": 123456789,
  "username": "technix_user",
  "first_name": "Ala",
  "photo_url": "https://t.me/i/userpic/320/example.jpg",
  "username": "technix",
  "first_name": "Jan",
  "photo_url": "https://example.com/avatar.jpg",
  "language_code": "pl",
  "stars": 1280,
  "energy": 1000,
  "energyMax": 1000,
  "tp": 240,
  "mined": 0,
  "emissionEndsAt": 1790000000000,
  "rigParts": { "monitor": true, "fan": false }
}
```

## RIG — `GET /api/rig`, `POST /api/rig`

GET zwraca `{ "parts": { "monitor": true, "fan": false } }`. POST przyjmuje `{ "parts": { "monitor": true, "fan": false } }` i zwraca zapisane `{ "parts": { ... } }`. Serwer jest źródłem prawdy dla zakupów i własności.

## Telegram Stars — `POST /api/payments/stars/invoice`, `POST /api/payments/stars/confirm`

Frontend tworzy fakturę żądaniem `{ "part": "monitor", "currency": "XTR", "stars": 180 }`. Serwer musi sam sprawdzić cenę części w katalogu i utworzyć fakturę Telegram Stars; nie może ufać cenie przesłanej przez klienta. Odpowiedź zawiera `{ "invoiceLink": "https://t.me/$...", "invoiceId": "..." }`. Aplikacja otwiera fakturę przez `Telegram.WebApp.openInvoice`.

Po statusie `paid` klient wywołuje potwierdzenie `{ "part": "monitor", "invoiceId": "..." }`. Serwer potwierdza płatność na podstawie zweryfikowanego update'u `successful_payment` od Telegrama, a nie statusu przekazanego przez przeglądarkę, i zwraca `{ "owned": true, "parts": { "monitor": true } }`. Tryb mock tylko symuluje zakup lokalnie; nie pobiera Stars.

## Synchronizacja gry — `POST /api/sync`

Frontend wysyła partię stanu po zmianach, z opóźnieniem, przy ukryciu dokumentu oraz przy zamykaniu strony:

```json
{
  "stars": 1280,
  "energy": 985,
  "energyMax": 1000,
  "tp": 265,
  "rigParts": { "monitor": true },
  "mined": 25,
  "emissionEndsAt": 1790000000000,
  "clientRequestId": "request-id",
  "timestamp": "2026-10-06T21:00:00.000Z"
}
```

Serwer powinien deduplikować żądania po `clientRequestId`, walidować wartości i nie ufać klientowi w sprawie salda lub nagród.

## Pozostałe odczyty

| Endpoint | Oczekiwany format JSON |
| --- | --- |
| `GET /api/tasks` | Tablica `{ "title": "Zadanie", "reward": 25, "label": "Kanał" }` |
| `GET /api/leaderboard` | Tablica `{ "id": 123456789, "username": "technix_user", "stars": 1280 }` |
| `GET /api/referrals` | `{ "count": 0, "rewards": 0 }` |
| `GET /api/notifications` | Tablica `{ "title": "Powiadomienie", "text": "Treść" }` |
| `GET /api/wallet` | `{ "balance": 0, "currency": "PLN" }` |

`USE_MOCK_API` w `config.js` włącza/wyłącza adapter demonstracyjny oparty o `localStorage`. Tryb produkcyjny wymaga `USE_MOCK_API: false` oraz skonfigurowanego `API_BASE_URL`; żadnych sekretów ani kluczy prywatnych nie należy umieszczać w frontendzie.
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
