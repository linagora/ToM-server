<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# wellKnown/

## Purpose
Matrix server discovery endpoint implementing the `.well-known/matrix/client` specification. Returns server metadata for client auto-configuration, including homeserver URL, identity server URL, federated identity services, Jitsi integration config, OpenID Connect issuer, and Twake-specific settings.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/.well-known/matrix/client` | Matrix client auto-discovery configuration |
| `GET` | `/.well-known/twake/client` | Twake-specific configuration (same response) |

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Route handler — assembles and returns the well-known configuration object |
| `index.test.ts` | Tests for response structure and config values |

## For AI Agents

### Working In This Directory
- Response is assembled entirely from config values — no DB queries
- The response includes all values needed by Matrix clients for auto-discovery
- Adding new config fields: update `src/config.json` (in tom-server) first, then include the value in the response object here
- Both `/matrix/client` and `/twake/client` paths serve identical responses

### Response Fields
- `m.homeserver.base_url` — Matrix homeserver URL
- `m.identity_server.base_url` — Identity server URL
- `m.integrations` — Integration manager config
- `org.matrix.msc3575.proxy` — Sliding sync proxy
- Jitsi, OIDC, and Twake-specific keys

<!-- MANUAL: -->
