# Kontrakt API TechnixPro

Frontend wysyła JSON i oczekuje odpowiedzi JSON. W `config.js` należy ustawić `USE_MOCK_API: false` oraz `API_BASE_URL`. Żądania w trybie Telegram Mini App zawierają nagłówek `Authorization: tma <initData>`. Backend musi zweryfikować podpis `initData`; `initDataUnsafe` służy wyłącznie do wyświetlania danych w interfejsie.

## Użytkownik — `GET /api/me`

```json
{
  "user": {
    "id": 123456789,
    "username": "technix",
    "first_name": "Jan",
    "photo_url": "https://example.com/avatar.jpg",
    "language_code": "pl"
  },
  "gameState": {
    "stars": 1280,
    "energy": 1000,
    "energyMax": 1000,
    "tp": 240,
    "taps": 0,
    "mined": 0,
    "rigParts": {
      "mouse": false,
      "keyboard": false,
      "monitor": false,
      "case": false,
      "ram": false,
      "gpu": false,
      "fan": false
    }
  }
}
```

`gameState` jest źródłem prawdy po uruchomieniu aplikacji. W mocku dane są odczytywane z localStorage.

## RIG — `GET /api/rig`, `POST /api/rig`

GET zwraca `{ "parts": { "mouse": true, "keyboard": false, "monitor": false, "case": false, "ram": false, "gpu": false, "fan": false } }`. POST zapisuje aktualne części:

```json
{ "parts": { "mouse": true, "keyboard": false, "monitor": false, "case": false, "ram": false, "gpu": false, "fan": false } }
```

## Synchronizacja gry — `POST /api/sync`

Żądanie jest batchowane po zmianach, dodatkowo wysyłane przy ukryciu dokumentu i przed opuszczeniem strony. Serwer powinien traktować `clientRequestId` jako klucz idempotencji, a `timestamp` jako czas utworzenia aktualizacji.

```json
{
  "clientRequestId": "uuid",
  "timestamp": "2026-10-06T21:00:00.000Z",
  "state": {
    "stars": 1280,
    "energy": 985,
    "energyMax": 1000,
    "tp": 265,
    "taps": 1,
    "mined": 25,
    "rigParts": { "mouse": false, "keyboard": false, "monitor": false, "case": false, "ram": false, "gpu": false, "fan": false }
  }
}
```

Odpowiedź: `{ "ok": true }`. Lokalny cache jest aktualizowany niezależnie od wyniku żądania.

## Pozostałe dane

- `GET /api/tasks` — tablica `{ "title": "Aktywność w kanale", "reward": 25, "label": "Kanał" }`.
- `GET /api/leaderboard` — tablica `{ "username": "technix", "stars": 1280 }`.
- `GET /api/referrals` — `{ "count": 0, "rewards": 0, "items": [] }`.
- `GET /api/notifications` — tablica `{ "title": "Powiadomienie", "text": "Treść" }`.
- `GET /api/wallet` — `{ "balance": 0, "currency": "PLN" }`.
- `GET /api/posts` — tablica wpisów `{ "author": "Użytkownik", "text": "Treść", "media": "", "time": "teraz" }`.
- `GET /api/channel-posts` — tablica wpisów kanału; pola takie jak w `/api/posts`, opcjonalnie `link`.

Błędy HTTP (`4xx`/`5xx`) są pokazywane w zakładce wraz z możliwością ponowienia żądania.
