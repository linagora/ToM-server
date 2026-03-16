<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# matrix-api/

## Purpose
Proxy/extension of core Matrix Client API endpoints. Overrides specific `/_matrix/client/v3/` endpoints to add Twake-specific behavior: room creation with preset support and display name management. Feature-gated via the `createroom_proxy` config flag.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/_matrix/client/v3/createRoom` | Create room with Twake preset options (if `createroom_proxy` enabled) |
| `PUT` | `/_matrix/client/v3/profile/:userId/displayname` | Update user display name |
| `GET` | `/_matrix/client/v3/profile/:userId/displayname` | Get user display name |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `client/` | All Matrix client API implementations |
| `client/createRoom/` | Room creation proxy implementation (`index.ts`) |
| `client/displayName/` | Display name management: `index.ts`, `controllers/`, `routes/`, `services/`, `tests/` |

## For AI Agents

### Working In This Directory
- `createRoom/` is only mounted when `createroom_proxy: true` in config
- Display name endpoints proxy to the Matrix homeserver — require valid Matrix access token
- Keep the `/_matrix/client/v3/` prefix exactly to match Matrix spec routing

<!-- MANUAL: -->
