<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# .compose/

## Purpose
Docker Compose service configuration files and supplementary configs for the full ToM-Server local development stack. Each subdirectory configures a specific service (database, identity provider, LDAP, reverse proxy, etc.) and is referenced by the compose files in the repo root and subdirectories under `.compose/examples/`.

## Key Files

| File | Description |
|------|-------------|
| `examples/sqlite.yml` | Minimal compose stack using SQLite |
| `examples/pgsql.yml` | Compose stack using PostgreSQL |
| `examples/sso.yml` | Compose stack with SSO (LemonLDAP::NG) |
| `examples/cs-bridge.yml` | Compose stack including the CS bridge |
| `chat/config.sso.json` | Synapse Matrix homeserver config for SSO setups |
| `cs-bridge/config.yaml` | Common Settings Bridge application config |
| `cs-bridge/registration.yaml` | Matrix Application Service registration for cs-bridge |
| `ldap/generate_ldap_entries.sh` | Script to seed LDAP with test users |
| `llng/lmConf-1.json` | LemonLDAP::NG SSO provider configuration |
| `postgres/init.sql` | PostgreSQL initialization script (creates schemas/tables) |
| `synapse/docker.internal.log.config` | Synapse logging configuration for Docker |
| `synapse/docker.internal.signing.key` | Synapse server signing key (dev only) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `chat/` | Synapse Matrix homeserver configuration files |
| `cs-bridge/` | Common Settings Bridge service configs |
| `examples/` | Ready-to-use compose override files for different setups |
| `ldap/` | OpenLDAP service setup and seed scripts |
| `llng/` | LemonLDAP::NG SSO provider configuration |
| `postgres/` | PostgreSQL initialization SQL |
| `synapse/` | Additional Synapse server configs (keys, logging) |

## For AI Agents

### Working In This Directory
- These files configure external services — do NOT use them as application code references
- The `examples/` compose files are meant to be used with `docker compose -f ... up`
- Secrets and keys in `synapse/` are for local dev only — never commit real keys
- When adding a new service, create a new subdirectory with its config and add an example compose override

### Testing Requirements
Start the full stack with:
```bash
docker compose -f .compose/examples/pgsql.yml up
```

<!-- MANUAL: -->
