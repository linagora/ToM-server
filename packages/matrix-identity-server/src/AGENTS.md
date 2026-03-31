<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# matrix-identity-server/src/

## Purpose
TypeScript source for `@twake/matrix-identity-server`. Organized into feature modules mirroring the Matrix Identity Server v2 specification. Each subdirectory handles one area of the spec (account, 3PID, lookup, etc.) plus shared infrastructure (cache, db, userdb, cron, utils).

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | `MatrixIdentityServer` class — registers all route handlers, exports `this.endpoints` and `this.ready` |
| `types.ts` | Global type definitions shared across all modules |
| `utils.ts` | Shared utility functions (used internally) |
| `api-doc.ts` | API documentation endpoint handler |
| `status.ts` | Server status endpoint (`/_matrix/identity/v2`) |
| `versions.ts` | Version info endpoint |
| `index.test.ts` | Server initialization integration tests |
| `terms.test.ts` | Terms endpoint tests |
| `utils.test.ts` | Utility function tests |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `account/` | Account registration, login (`register.ts`), logout (`logout.ts`), account info (`index.ts`) |
| `3pid/` | Third-party ID endpoints: get mappings (`index.ts`), bind (`bind.ts`), unbind (`unbind.ts`) |
| `cache/` | Cache abstraction: factory (`index.ts`), memory cache (`memory.ts`), Redis cache (`redis.ts`) |
| `cron/` | Scheduled jobs: pepper rotation (`changePepper.ts`), user sync (`updateUsers.ts`), federated hash update (`update-federated-identity-hashes.ts`) |
| `db/` | Identity server DB: main class (`index.ts`), SQL implementations (`sql/pg.ts`, `sql/sqlite.ts`) |
| `ephemeral_signing/` | Ephemeral Ed25519 signing endpoint (`index.ts`) |
| `invitation/` | Room invitation via email/SMS (`index.ts`) |
| `keyManagement/` | Key retrieval (`getPubkey.ts`), ephemeral key validation (`validEphemeralPubkey.ts`), standard key validation (`validPubkey.ts`) |
| `lookup/` | Hashed address lookup (`index.ts`), hash details (`hash_details.ts`), hash updater (`updateHash.ts`) |
| `matrixDb/` | Direct Synapse DB queries (`index.ts`), SQL adapters (`sql/`) |
| `terms/` | Terms-of-service GET (`index.ts`), POST acceptance (`index.post.ts`), policy builder (`_computePolicies.ts`) |
| `userdb/` | User directory abstraction: factory (`index.ts`), LDAP (`ldap.ts`), SQL (`sql/`), empty stub (`empty.ts`) |
| `utils/` | `mailer.ts` (SMTP), `sms-service.ts`, `validateMatrixToken.ts` |
| `validate/` | Email validation sessions (`email/` subdirectory) |
| `__testData__/` | Test fixtures: `buildUserDB.ts`, `registerConf.json`, `termsConf.json` |

## For AI Agents

### Working In This Directory
- To add a new Matrix Identity Server endpoint: create a new module file, register it in `index.ts`
- All endpoints are mounted at `/_matrix/identity/v2/` — respect this prefix
- `db/index.ts` defines `Collections` enum — add new table names here for new DB tables
- `cron/` jobs run on server startup — configure intervals via config keys
- `userdb/` backend is selected by `user_db` config key: `sqlite`, `pg`, `ldap`, or `''` (empty)
- `cache/` backend selected by `cache_engine` config key: `memory` or `redis`

### Testing Requirements
```bash
npx nx run  @twake/matrix-identity-server:test
```
Tests use SQLite in-memory; SMTP and external services are mocked.

<!-- MANUAL: -->
