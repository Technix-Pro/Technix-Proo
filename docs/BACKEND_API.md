# Kontrakt API TechnixPro

Frontend wysyła żądania do `API_BASE_URL`. Odpowiedzi JSON powinny używać liczb dla sald/liczników i zwracać puste kolekcje zamiast `null`. Każde żądanie z Telegrama zawiera `X-Telegram-Init-Data`; serwer musi sprawdzić jego podpis i aktualność przed przypisaniem danych do użytkownika.

## Użytkownik — `GET /api/me`

Odpowiedź:

```json
{
  "id": 123456789,
  "username": "technix_user",
  "first_name": "Ala",
  "photo_url": "https://t.me/i/userpic/320/example.jpg",
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
