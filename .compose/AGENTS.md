<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-04-16 -->

# .compose/

## Purpose
Docker Compose service configuration files and supplementary configs for the full ToM-Server local development stack. Each subdirectory configures a specific service (database, identity provider, LDAP, reverse proxy, etc.) and is referenced by the compose files at the repo root (`compose.yml`, `compose.override.yml`, `compose.deploy.yml`).

## Key Files

| File | Description |
|------|-------------|
| `chat/config.json` | Twake Chat frontend config (served at `/web/config.json`) |
| `cs-bridge/config.yaml` | Common Settings Bridge application config |
| `cs-bridge/registration.yaml` | Matrix Application Service registration for cs-bridge |
| `ldap/bootstrap/` | LDIF files auto-loaded by OpenLDAP at startup (schema, structure, users) |
| `ldap/generate_ldap_entries.sh` | Script to generate additional test user LDIF entries |
| `llng/lmConf-1.json` | LemonLDAP::NG SSO provider configuration |
| `postgres/init.sql` | PostgreSQL initialization script (creates schemas/tables) |
| `ssl/Dockerfile` | mkcert-based image that generates self-signed TLS certs |
| `ssl/entrypoint.sh` | Entrypoint for the mkcert container |
| `ssl/certs/` | Generated TLS certs (populated at stack start, gitignored except `.gitkeep`) |
| `synapse/homeserver.yaml` | Synapse homeserver config — SSO (LemonLDAP::NG) + CS Bridge |
| `synapse/docker.internal.log.config` | Synapse logging configuration for Docker |
| `synapse/docker.internal.signing.key` | Synapse server signing key (dev only) |
| `tom/config.yaml` | ToM Server config for deploy mode (mounted into the `tom` container) |
| `traefik/dynamic/dev.yml` | Traefik file-provider config for dev mode (routes tom → host:3000, TLS, CORS) |
| `traefik/dynamic/deploy.yml` | Traefik file-provider config for deploy mode (TLS, CORS only — tom routed via Docker labels) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `chat/` | Twake Chat frontend config |
| `cs-bridge/` | Common Settings Bridge service configs |
| `ldap/` | OpenLDAP bootstrap LDIF files and seed script |
| `llng/` | LemonLDAP::NG SSO provider configuration |
| `postgres/` | PostgreSQL initialization SQL |
| `ssl/` | mkcert TLS certificate generation (Dockerfile + entrypoint) |
| `synapse/` | Synapse homeserver config, signing key, and logging config |
| `tom/` | ToM Server config for containerised (deploy) mode |
| `traefik/` | Traefik dynamic file-provider configs (dev and deploy) |

## For AI Agents

### Working In This Directory
- These files configure external services — do NOT use them as application code references
- Secrets and keys in `synapse/` are for local dev only — never commit real keys
- `tom/config.yaml` is a dev config with placeholder credentials — do not use in production
- When adding a new service, create a new subdirectory with its config and update the relevant compose file

### Testing Requirements
Start the full stack (dev mode — tom runs on host):
```bash
docker compose up -d
npx nx serve tom-server
```

Start the full stack (deploy mode — tom in Docker):
```bash
docker compose -f compose.yml -f compose.deploy.yml up -d
```

<!-- MANUAL: -->
