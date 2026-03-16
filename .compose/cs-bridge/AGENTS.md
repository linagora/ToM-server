<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# .compose/cs-bridge/

## Purpose
Docker Compose configuration for the Common Settings Bridge service. Contains the application config and Matrix Application Service registration file used when running the bridge alongside Synapse in a local dev stack.

## Key Files

| File | Description |
|------|-------------|
| `config.yaml` | Bridge service configuration (server URLs, tokens, DB connection) |
| `registration.yaml` | Matrix AS registration file — must be referenced in Synapse's `app_service_config_files` |

## For AI Agents

### Working In This Directory
- `registration.yaml` is the AS registration — `hs_token` and `as_token` must match values in `config.yaml`
- Synapse must be restarted after changing the registration file
- The bridge URL in `registration.yaml` must be reachable from the Synapse container

<!-- MANUAL: -->
