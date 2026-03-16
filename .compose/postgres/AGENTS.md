<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# .compose/postgres/

## Purpose
PostgreSQL database initialization for local development. The SQL script creates databases and schemas needed by both Synapse and the ToM identity server.

## Key Files

| File | Description |
|------|-------------|
| `init.sql` | Initialization SQL — creates databases (`synapse`, `tom_server`), roles, and initial schemas |

## For AI Agents

### Working In This Directory
- This script runs automatically when the PostgreSQL container starts for the first time
- After changing `init.sql`, delete the PostgreSQL data volume and restart to re-initialize
- Database names and credentials must match values in the corresponding `@twake/tom-server` and Synapse configs

<!-- MANUAL: -->
