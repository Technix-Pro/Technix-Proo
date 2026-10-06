# TechnixPro

TechnixPro is a dark, neon-styled Telegram Mini App frontend demo with a clicker, rewards, community content, and an Admin Control Center.

## Project structure

- `index.html` — app markup and screens.
- `styles.css` — app styles and configurable animations.
- `config.js` — public defaults and admin UI configuration.
- `api.js` — Promise-based localStorage API adapter.
- `store.js` — configuration validation and draft/published state.
- `admin.js` — administrator-only control center.
- `app.js` — Telegram profile, navigation, and user-facing rendering.
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

Tailwind CSS, Font Awesome, Inter, and the Telegram Web App SDK load from CDNs. No build step or package installation is required.

## Run locally

Start a static server from the project directory:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. To test as a Telegram Mini App, host over HTTPS and configure the URL with a Telegram bot.

## Admin Control Center

Set administrator Telegram user IDs in `TECHNIX_CONFIG.ADMIN_IDS` in `config.js`. The list is intentionally empty by default; add IDs only in a private deployment/configuration. For local UI testing only, set `DEV_MODE: true` and open the app with `?admin=1`. Do not enable developer mode in a public deployment.

Only configured administrators get the **Panel administratora** entry under **Bonusy → Przegląd**. Admin edits are saved to a local draft. **Opublikuj** changes the published configuration; normal visitors use only that published version. **Podgląd użytkownika** shows the current draft to the admin and has a quick return to the panel. Rejecting a draft or restoring a previous publication is also available.

The configuration includes the active phase, feature flags, animation preferences, tasks, events, posts, notifications, status banner, and presets. Draft/published data and up to five earlier publications are stored in browser localStorage using versioned keys. Local data is not shared between devices or users; connect the API adapter to a backend for a shared production configuration.

## Security and demo limitations

The admin ID check only controls frontend UI visibility; it is not authorization. Browser code and localStorage can be modified by users. Before production, verify Telegram `initData` and authorize every admin operation on a trusted backend. Mining, balances, rewards, wallet, and statistics are demo-only, with no real token, secure transaction flow, or shared persistence.
