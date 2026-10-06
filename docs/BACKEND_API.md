# Backend API proposal

The frontend currently uses `api.js`, a Promise-based localStorage adapter. Replace its methods with `fetch` calls when a backend is available. Responses should use the same configuration shape as `TECHNIX_CONFIG.DEFAULT_CONFIG`.

## Configuration

### `GET /config`

Returns the published configuration for the current user:

```json
{
  "version": 3,
  "activePhase": 2,
  "features": {
    "clicker": true,
    "rigBuilder": true,
    "wallet": false,
    "referrals": true,
    "leaderboard": true,
    "dailyBonus": true,
    "tasks": true,
    "events": true,
    "posts": true,
    "notifications": true
  },
  "animations": {
    "tokens": true,
    "circuitPulse": true,
    "chipPulse": true,
    "partGlow": true,
    "toastFx": true,
    "reduceMotion": false
  },
  "events": [
    {
      "id": "community-sprint",
      "title": "Community Sprint",
      "desc": "Complete community tasks.",
      "reward": 50,
      "active": true,
      "startAt": null,
      "endAt": null
    }
  ],
  "tasks": [
    {
      "id": "channel",
      "title": "Channel activity",
      "reward": 25,
      "label": "Channel",
      "active": true,
      "order": 1,
      "type": "social"
    }
  ],
  "posts": [
    {
      "id": "launch",
      "text": "Welcome to TechnixPro.",
      "media": "",
      "link": "",
      "pinned": false,
      "visible": true
    }
  ],
  "notifications": [
    {
      "id": "welcome",
      "title": "Welcome",
      "text": "Welcome to the app.",
      "audience": "all",
      "scheduledAt": null,
      "sent": true
    }
  ],
  "statusBanner": {
    "text": "Core Engine Online",
    "level": "ok",
    "visible": true
  },
  "presets": []
}
```

### `GET /admin/draft` and `PUT /admin/draft`

Read or replace the authenticated administrator's complete draft configuration. `PUT` accepts the same JSON shape as `GET /config`; validate fields and non-negative rewards server-side.

### `POST /admin/publish`

Publishes the current draft atomically and retains earlier versions. Example request:

```json
{ "expectedVersion": 3 }
```

Example response:

```json
{ "version": 4, "publishedAt": "2026-10-06T20:00:00Z" }
```

### `POST /admin/rollback`

Restores a prior published version, optionally selected by version:

```json
{ "version": 3 }
```

## Content management

Each collection should support authenticated CRUD operations. Suggested routes:

| Resource | Endpoints |
| --- | --- |
| Tasks | `GET/POST /admin/tasks`, `PUT/DELETE /admin/tasks/{id}` |
| Events | `GET/POST /admin/events`, `PUT/DELETE /admin/events/{id}` |
| Posts | `GET/POST /admin/posts`, `PUT/DELETE /admin/posts/{id}` |
| Notifications | `GET/POST /admin/notifications`, `PUT/DELETE /admin/notifications/{id}` |
| Presets | `GET/POST /admin/presets`, `DELETE /admin/presets/{id}` |
| Statistics | `GET /admin/stats` |

An event uses `{ id, title, desc, reward, active, startAt, endAt }`. A task uses `{ id, title, reward, label, active, order, type }`. A post uses `{ id, text, media, link, pinned, visible }`. A notification uses `{ id, title, text, audience, scheduledAt, sent }`.

## Authentication and publication behavior

Send Telegram Web App `initData` to the backend over HTTPS and validate its signature and freshness on the server for every privileged request. Never trust a client-supplied Telegram user ID, a frontend feature flag, `DEV_MODE`, or localStorage as authorization. The backend must authorize the verified user ID against its admin list, validate inputs, and expose only the published configuration to ordinary users. Admin drafts and publish/rollback operations should be isolated, authenticated, and audited.
