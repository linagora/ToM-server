<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# db/src/

## Purpose
TypeScript source for `@twake/db`. Provides a database abstraction layer with a unified interface over PostgreSQL and SQLite. The `sql/` subdirectory contains driver-specific implementations.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Main exports: `Database` class, `Pg`, `SQLite`, `createTables` |
| `database.ts` | `Database` base class — connection management and query interface |
| `types.ts` | Column definitions, condition operators, table schema types |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `sql/` | SQL adapter implementations |

## Key Files in sql/

| File | Description |
|------|-------------|
| `sql.ts` | Base SQL utilities and shared query logic |
| `pg.ts` | PostgreSQL adapter using `pg` driver — connection pooling, parameterized queries |
| `sqlite.ts` | SQLite adapter using `sqlite3`/`better-sqlite3` |
| `_createTables.ts` | `createTables()` implementation — creates tables from schema definitions if not exist |

## For AI Agents

### Working In This Directory
- `createTables(db, tableDefinitions)` is idempotent — safe to call on every startup
- Both `Pg` and `SQLite` implement the same interface — code against `Database` not a specific adapter
- The database engine is selected by config key `database_engine`: `'pg'` or `'sqlite'`
- Table schemas are defined as objects with column definitions — see `types.ts` for the schema DSL

<!-- MANUAL: -->
