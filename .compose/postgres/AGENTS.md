<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-04-16 -->

# .compose/postgres/

## Purpose
PostgreSQL database initialization for local development. The SQL script creates databases and roles needed by both Synapse and the ToM Server.

## Key Files

| File | Description |
|------|-------------|
| `init.sql` | Initialization SQL — creates `synapse` and `tom_db` databases, roles, and initial schemas |

## For AI Agents

### Working In This Directory
- This script runs automatically when the PostgreSQL container starts for the **first time**
- After changing `init.sql`, delete the `postgres-data` volume and restart to re-initialize:
  `docker compose down -v && docker compose up -d`
- Database names and credentials must match values in `.compose/synapse/hs-config/sso-cs-bridge.yaml` and `.compose/tom/config.yaml`

<!-- MANUAL: -->
