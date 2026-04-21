<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-16 | Updated: 2026-04-16 -->

# .compose/tom/

## Purpose
ToM Server configuration for containerised (deploy) mode. The config file is mounted into the `tom` container and must be edited before running `compose.deploy.yml`.

## Key Files

| File | Description |
|------|-------------|
| `config.yaml` | ToM Server config — server URLs, Synapse connection, DB credentials, LDAP, email, OIDC |

## For AI Agents

### Working In This Directory
- `config.yaml` is the deploy config — it contains dev-only placeholder credentials
- Before running deploy mode: review `config.yaml` and fill in any required fields
- The config schema is defined in `apps/tom-server/src/` and validated by Zod at startup
- See `.tomconfig.example.yaml` at the repo root for the full reference config
- In deploy mode, the file is mounted at `/etc/twake/chat/tom/config.yaml` inside the container

<!-- MANUAL: -->
