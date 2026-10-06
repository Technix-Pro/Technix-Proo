# TechnixPro

TechnixPro is a dark, neon-styled frontend demo for a Telegram Mini App concept: a community hub with a crypto-clicker/mining interface, rewards, and an admin panel.

## Project structure

- `index.html` — page markup and screen layout.
- `styles.css` — application styles and animations.
- `app.js` — Tailwind theme configuration and frontend interactions.
- `app-config.js` — runtime config (API base, `MOCK_PAYMENTS`, emission cycle, animation switch).
- `shop-config.js` — shop catalog priced in Telegram Stars (XTR).
- `payments.js` — Telegram Stars payment layer (invoice → `openInvoice` → server verify, with mock mode).
- `emission.js` — global 60-day emission countdown based on server time.
- `rig-builder.js` — RIG Builder assembly animation.
- `fx.js` — tap effects, count-up, ripples and the shared animation loop.
- `docs/BACKEND_API.md` — backend API contract.
- `config.js` / `api.js` — API configuration and mock/HTTP data adapters.
- `rig-builder.js` — SVG rig state, queued assembly, and animation lifecycle.

The page also loads Tailwind CSS, Font Awesome, Inter, and the Telegram Web App SDK from their respective CDNs.
Add an `assets/` directory when the project needs local images, icons, or other static files.

## Run locally

No build step or package installation is required. From the project directory, start a local static server:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The interface can also be opened directly as `index.html`, though a local server more closely matches web-app hosting.

To test as a Telegram Mini App, host the page over HTTPS and configure its URL with a Telegram bot. Telegram user details are used when the Web App SDK is available; otherwise the page uses a guest profile.

## Demo limitations

This repository contains a frontend prototype, not a production crypto or wallet service. Mining, rewards, and profile values are simulated in the browser; there is no backend, real token, or secure transaction flow. The admin panel visibility setting in `app.js` is only a UI demo and must not be treated as authorization. Production access control and user state must be implemented and verified on a trusted backend.

## Jak podpiąć backend

W `config.js` ustaw `USE_MOCK_API: false` i wpisz bazowy adres serwera w `API_BASE_URL` (np. `https://api.example.com`). Frontend wywoła endpointy opisane w [docs/BACKEND_API.md](docs/BACKEND_API.md), a `api.js` przekaże Telegram `initData` w nagłówku `X-Telegram-Init-Data`. Backend musi zweryfikować podpis `initData`; identyfikatorów z `initDataUnsafe` nie wolno traktować jako uwierzytelnienia. Bezpieczny tryb demonstracyjny działa z `USE_MOCK_API: true` i używa lokalnego cache przeglądarki.
W `config.js` ustaw `USE_MOCK_API: false` oraz `API_BASE_URL` na adres backendu (np. `https://api.example.com`). Frontend wysyła żądania opisane w [`docs/BACKEND_API.md`](docs/BACKEND_API.md); backend musi zweryfikować Telegram `initData` otrzymane w nagłówku `Authorization: tma …`. W trybie domyślnym `USE_MOCK_API: true` dane demonstracyjne i stan gry są przechowywane w `localStorage`.
