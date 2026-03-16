<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# db/ (matrix-identity-server)

## Purpose
Identity Server database schema and operations. Defines all identity server tables (`accessTokens`, `attempts`, `hashes`, `invitations`, `keys`, `mappings`, `userPolicies`, etc.) and provides CRUD methods. Supports PostgreSQL and SQLite via `sql/` adapters.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | `IdentityServerDb` class — `Collections` enum, table definitions, CRUD methods (`getAll`, `get`, `insert`, `update`, `deleteWhere`) |
| `index.test.ts` | DB operation tests using SQLite in-memory |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `sql/` | Driver-specific SQL: `pg.ts` (PostgreSQL), `sqlite.ts` (SQLite) |

## For AI Agents

### Working In This Directory
- `Collections` enum in `index.ts` is the canonical list of all identity server tables — add new tables here
- To add a new table: add to `Collections`, define schema in `index.ts`, add SQL in both `sql/pg.ts` and `sql/sqlite.ts`
- All queries use parameterized statements — never string-interpolate user input into SQL

<!-- MANUAL: -->
