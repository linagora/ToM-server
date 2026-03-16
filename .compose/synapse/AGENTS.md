<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# .compose/synapse/

## Purpose
Additional Synapse Matrix homeserver configuration files for Docker dev deployments. Contains logging configuration and the server signing key (dev-only).

## Key Files

| File | Description |
|------|-------------|
| `docker.internal.log.config` | Synapse logging configuration for Docker — controls log level, format, and output |
| `docker.internal.signing.key` | Synapse server signing key for local development — NEVER use in production |

## For AI Agents

### Working In This Directory
- The signing key is a dev-only key — rotating it will break existing federation signatures
- For production, generate a new signing key with `generate_signing_key.py` from Synapse tools
- Log level in `docker.internal.log.config` can be adjusted for debugging (e.g., `DEBUG` for federation issues)

<!-- MANUAL: -->
