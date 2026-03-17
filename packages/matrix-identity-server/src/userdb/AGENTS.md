<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# userdb/

## Purpose
User directory abstraction layer. Provides a unified interface (`get`, `getAll`, `match`) for querying user information from different backends: LDAP, PostgreSQL, SQLite, or a no-op stub. Backend selection is driven by the `user_db` config key.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | `UserDB` factory — selects backend based on `user_db` config; exposes `get()`, `getAll()`, `match()` |
| `ldap.ts` | LDAP backend using `ldapts` — queries LDAP directory for users by filter |
| `empty.ts` | No-op stub — returns empty results; used when user directory is not configured |
| `index.test.ts` | Factory selection tests |
| `ldap.test.ts` | LDAP backend tests |
| `empty.test.ts` | Empty backend tests |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `sql/` | SQL backends: `pg.ts` (PostgreSQL), `sqlite.ts` (SQLite) |

## For AI Agents

### Working In This Directory
- Config key `user_db`: `'ldap'`, `'pg'`, `'sqlite'`, or `''` (empty/disabled)
- LDAP config keys: `ldap_uri`, `ldap_base`, `ldap_user`, `ldap_password`, `ldap_filter`
- All backends implement the same interface — code against `UserDB` type, not a specific backend
- To add a new backend: implement the interface, add a case to `index.ts`

<!-- MANUAL: -->
