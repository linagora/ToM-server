<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# @twake/tom-server

## Purpose
Main Twake on Matrix Server package. Composes `MatrixIdentityServer` with 12 Twake-specific REST API modules into a single Express application (`TwakeServer`). This is the deployable server binary for the Twake Chat backend. It manages shared singleton services (AddressbookService, UserInfoService, TokenService, SmsService) and mounts all API routers onto a central Express router.

## Key Files

| File | Description |
|------|-------------|
| `src/index.ts` | `TwakeServer` class — composition root, exports `default` |
| `src/config.ts` | Configuration description (`confDesc`) for all tom-server config keys |
| `package.json` | Package manifest (`@twake/tom-server`) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | All source code (see `src/AGENTS.md`) |
| `src/identity-server/` | TwakeIdentityServer — extends MatrixIdentityServer with Twake lookup |
| `src/addressbook-api/` | Personal contact list CRUD API |
| `src/admin-settings-api/` | Admin-only user management endpoints |
| `src/deactivate-account-api/` | Admin endpoint to deactivate Matrix accounts |
| `src/invitation-api/` | Email/SMS invitation system |
| `src/matrix-api/` | Matrix Client API proxy (createRoom, displayName) |
| `src/metrics-api/` | DAU/WAU/MAU activity metrics |
| `src/qrcode-api/` | QR code generation for access tokens |
| `src/sms-api/` | SMS sending endpoint |
| `src/user-info-api/` | Enriched user profile data and visibility settings |
| `src/vault-api/` | Recovery word (seed phrase) storage |
| `src/wellKnown/` | `.well-known/matrix/client` server discovery |

## For AI Agents

### Working In This Directory
- `TwakeServer` constructor: `new TwakeServer(conf, confDesc?)` — `conf` must have `server_name`, `base_url`
- `this.endpoints` is the Express Router — mount with `app.use('/', server.endpoints)`
- `this.ready` Promise resolves when DB, key generation, and all services are initialized
- Singleton services are created in `_initServer()` and passed to API modules via dependency injection
- Feature flags: `createroom_proxy` (Matrix room creation override), LDAP config enables LDAP middleware
- Configuration keys are documented in `src/config.ts`

### Testing Requirements
```bash
npx nx run  @twake/tom-server:test
```
Tests use SQLite in-memory and mock external services (SMTP, Matrix homeserver).

### Common Patterns
- All API modules follow: `routes/index.ts` → router → `controllers/` + `middlewares/` + `services/`
- Authentication via Matrix access tokens validated by the identity server's `authenticate()` method
- Admin endpoints use `x-access-token` header with a shared admin token from config

### API Endpoint Summary

| Module | Prefix |
|--------|--------|
| Matrix Identity Server (inherited) | `/_matrix/identity/v2/` |
| Twake lookup/diff | `/_twake/identity/v1/lookup/` |
| Addressbook | `/_twake/addressbook` |
| Admin settings | `/_twake/v1/admin/` |
| Deactivate account | `/_twake/admin/deactivate-user/` |
| Invitations | `/_twake/v1/invite` |
| Matrix client proxy | `/_matrix/client/v3/` |
| Metrics | `/_twake/v1/metrics/` |
| QR code | `/_twake/v1/qrcode` |
| SMS | `/_twake/sms` |
| User info | `/_twake/v1/user_info/` |
| Vault | `/_twake/recoveryWords` |
| Well-known | `/.well-known/matrix/` |

## Dependencies

### Internal
- `@twake/matrix-identity-server` — Base identity server
- `@twake/utils` — HTTP helpers and error codes
- `@twake/config-parser` — Configuration loading
- `@twake/logger` — Logging
- `@twake/db` — Database abstraction

### External
- `express` — HTTP framework
- `pg`, `sqlite3` — Database drivers
- `redis` — Cache backend
- `ldapts` — LDAP user directory
- `nodemailer` — Email sending
- `qrcode` — QR code image generation
- `uuid` — ID generation

<!-- MANUAL: -->
