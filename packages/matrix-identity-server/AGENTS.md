<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# @twake/matrix-identity-server

## Purpose
Full implementation of the Matrix Identity Server v2 specification. Provides account management, third-party identifier (3PID) binding/unbinding, email validation, hashed user lookup, key management (Ed25519), terms of service, and an optional Redis/memory cache layer. This is the base class extended by `@twake/tom-server`'s `TwakeIdentityServer` and `@twake/federated-identity-service`.

## Key Files

| File | Description |
|------|-------------|
| `src/index.ts` | `MatrixIdentityServer` class — main entry point, registers all route handlers |
| `package.json` | Package manifest (`@twake/matrix-identity-server`) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | All source code organized by feature (see `src/AGENTS.md`) |
| `src/account/` | Account registration, login, logout, and info endpoints |
| `src/3pid/` | Third-party identifier (email/phone) binding and unbinding |
| `src/cache/` | Memory and Redis cache implementations |
| `src/db/` | Identity server database schema and queries (UserDB: LDAP + SQL) |
| `src/keyManagement/` | Ed25519 key generation, rotation, and `/pubkey` endpoint |
| `src/lookup/` | Hashed user lookup (`/_matrix/identity/v2/lookup`) |
| `src/terms/` | Terms of service management endpoints |
| `src/validation/` | Email token validation (request/submit) |

## For AI Agents

### Working In This Directory
- `MatrixIdentityServer` constructor takes `(conf, confDesc?, db?)` — `conf` must include `server_name`
- `this.endpoints` is an Express Router — mount it in the parent application
- `this.ready` is a Promise that resolves when async initialization (key gen, DB setup) completes
- Subclasses override `authenticate()` to plug in custom auth logic
- The `db` property exposes the identity server's database for subclass use
- Email sending requires SMTP config keys: `smtp_server`, `smtp_port`, `smtp_user`, `smtp_password`

### Testing Requirements
```bash
npx nx run  @twake/matrix-identity-server:test
```
Tests use SQLite in-memory DB and mock SMTP.

### Common Patterns
- Extending the server: `class MyServer extends MatrixIdentityServer { ... }`
- All spec endpoints are mounted at `/_matrix/identity/v2/`
- Custom endpoints should be added at different prefixes to avoid spec conflicts

## Dependencies

### Internal
- `@twake/config-parser` — Configuration loading
- `@twake/logger` — Logging
- `@twake/utils` — HTTP helpers and Matrix error codes
- `@twake/crypto` — Hashing and key operations
- `@twake/db` — Database abstraction
- `@twake/matrix-resolve` — Federation server resolution

### External
- `express` — HTTP framework
- `ldapts` — LDAP user directory integration
- `nodemailer` — Email sending for validation tokens
- `redis` — Optional Redis cache backend

<!-- MANUAL: -->
