<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# @twake/db

## Purpose
Database abstraction layer that provides a unified interface over PostgreSQL and SQLite backends. Manages connection pooling, schema creation via `createTables`, and query execution with a consistent API. Used by `@twake/matrix-identity-server`, `@twake/tom-server`, and related packages to avoid direct driver coupling.

## Key Files

| File | Description |
|------|-------------|
| `src/index.ts` | Exports: `Database` class, `Pg` adapter, `SQLite` adapter, `createTables`, column/condition types |
| `package.json` | Package manifest (`@twake/db`) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | TypeScript source including SQL adapter implementations (see `src/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- `Database` is the main class — instantiate with a `Pg` or `SQLite` adapter
- `createTables(db, tableDefinitions)` creates tables if they don't exist — safe to call on startup
- Adapters handle connection pooling internally; do not manage connections manually
- The database type is determined by the `database_engine` config key (`pg` or `sqlite`)

### Testing Requirements
```bash
npx nx run  @twake/db:test
```
Tests use SQLite in-memory for isolation.

## Dependencies

### Internal
- `@twake/config-parser` — Loading database configuration
- `@twake/logger` — Query logging

### External
- `pg` — PostgreSQL driver
- `sqlite3` — SQLite driver
- `better-sqlite3` — Alternative synchronous SQLite driver

<!-- MANUAL: -->
