<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-04-16 -->

# .compose/synapse/

## Purpose
Synapse Matrix homeserver configuration files for local development. Contains the homeserver config (with SSO + CS Bridge), server signing key, and logging config.

## Key Files

| File | Description |
|------|-------------|
| `homeserver.yaml` | Synapse homeserver config — SSO via LemonLDAP::NG OIDC + CS Bridge appservice registration |
| `docker.internal.log.config` | Synapse logging configuration for Docker (controls log level, format, output) |
| `docker.internal.signing.key` | Synapse server signing key — **dev only**, never use in production |

## For AI Agents

### Working In This Directory
- `homeserver.yaml` is the only homeserver config in use — it is mounted as `/data/homeserver.yaml` in the `synapse` container
- The signing key is dev-only — rotating it breaks existing federation signatures; leave it unchanged
- Log level in `docker.internal.log.config` can be adjusted for debugging (e.g., change `WARNING` to `DEBUG`)
- The CS Bridge appservice registration path `/data/cs-bridge-registration.yaml` must match what is in `app_service_config_files` in the homeserver config
- `.data/` is the Synapse data volume mount (media store, SQLite fallback, etc.) — gitignored

<!-- MANUAL: -->
