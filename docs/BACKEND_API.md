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
