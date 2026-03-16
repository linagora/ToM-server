<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# .compose/examples/

## Purpose
Ready-to-use Docker Compose override files for different local development configurations. Each file defines a complete variant of the stack (SQLite vs PostgreSQL, with/without SSO, with/without CS bridge).

## Key Files

| File | Description |
|------|-------------|
| `sqlite.yml` | Minimal stack using SQLite — fastest to start, no external DB needed |
| `pgsql.yml` | Stack using PostgreSQL — closer to production |
| `sso.yml` | Stack with LemonLDAP::NG SSO provider (OIDC/SAML) |
| `cs-bridge.yml` | Stack including the Common Settings Bridge service |

## For AI Agents

### Working In This Directory
- Use with: `docker compose -f .compose/examples/<variant>.yml up`
- Override files extend the base `docker-compose.yml` — do not duplicate service definitions
- When adding a new service variant, create a new override file here

<!-- MANUAL: -->
