<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-16 | Updated: 2026-04-16 -->

# .compose/traefik/

## Purpose
Traefik reverse-proxy dynamic file-provider configuration for the local dev stack. Provides TLS termination, CORS middleware, and static route definitions that cannot be expressed via Docker labels.

## Key Files

| File | Description |
|------|-------------|
| `dynamic/dev.yml` | Dev mode config — TLS certs, CORS middleware, and routes for tom → `host.docker.internal:3000` |
| `dynamic/deploy.yml` | Deploy mode config — TLS certs and CORS middleware only (tom routing uses Docker labels) |

## For AI Agents

### Working In This Directory
- `dev.yml` is mounted by `compose.override.yml` (auto-loaded in `docker compose up`)
- `deploy.yml` is mounted by `compose.deploy.yml`
- Both files define the same `cors-policy` middleware and TLS certificate store
- In dev mode, all tom routes (direct, `.well-known`, identity, `createRoom`) point to `host.docker.internal:3000`
- In deploy mode, those routes are defined as Docker labels on the `tom` container in `compose.deploy.yml`
- Adding a new route: edit the relevant dynamic file and restart Traefik (or wait for file-watch reload)

<!-- MANUAL: -->
