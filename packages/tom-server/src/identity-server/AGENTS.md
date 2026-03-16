<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# identity-server/

## Purpose
`TwakeIdentityServer` — extends `MatrixIdentityServer` with Twake-specific user lookup and search capabilities. Adds two endpoints for searching organization users by field values and retrieving users updated since a timestamp (diff). Integrates addressbook and user-info services for enriched results.

## Endpoints (Twake-specific, in addition to all inherited Matrix Identity v2 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/_twake/identity/v1/lookup/match` | Search users by field (mail, uid, sn, givenName, etc.) |
| `POST` | `/_twake/identity/v1/lookup/diff` | Get users updated since a given timestamp |

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | `TwakeIdentityServer extends MatrixIdentityServer` — adds Twake DB tables and registers lookup routes |
| `index.test.ts` | Integration tests |
| `with-cache.test.ts` | Tests for cache-enabled lookup behavior |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `lookup/` | Search and diff implementation: `_search.ts`, `autocompletion.ts`, `diff.ts`, `types.ts`, `tests/` |
| `utils/` | `authenticate.ts` — custom authentication for Twake identity server |
| `__testData__/` | Test fixtures: `buildUserDB.ts`, `termsConf.json` |

## For AI Agents

### Working In This Directory
- `TwakeIdentityServer` adds `twakeDbCollections` to extend the identity server database schema
- The `authenticate()` override delegates to `utils/authenticate.ts`
- `lookup/autocompletion.ts` powers the `match` endpoint — searches user fields with prefix matching
- `lookup/diff.ts` powers the `diff` endpoint — returns users modified after a given epoch timestamp

### Testing Requirements
```bash
npx nx run  @twake/tom-server:test -- --testPathPattern=identity-server
```

<!-- MANUAL: -->
