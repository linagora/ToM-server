<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# matrixDb/

## Purpose
Direct read-only access to the Matrix homeserver (Synapse) database. Used to query user registrations, active user counts, and other homeserver data that the identity server needs but doesn't own. Supports PostgreSQL and SQLite Synapse configurations.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | `MatrixDB` class — connects to Synapse DB; implements `getAll()`, `get()`, `match()` for querying Synapse tables |
| `README.md` | Documentation for Matrix DB integration and table references |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `sql/` | Driver-specific queries for Synapse DB schema (`pg.ts`, `sqlite.ts`) |

## For AI Agents

### Working In This Directory
- This is READ-ONLY access to Synapse's DB — never write to Synapse tables from this module
- Config keys: `matrix_database_engine` (`pg`/`sqlite`), `matrix_database_host`, `matrix_database_name`, etc.
- Synapse DB schema may change between Synapse versions — keep queries minimal and schema-version-aware
- Used by `cron/changePepper.ts` to filter active Matrix users when updating hashes

<!-- MANUAL: -->
