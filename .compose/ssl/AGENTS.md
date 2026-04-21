<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-16 | Updated: 2026-04-16 -->

# .compose/ssl/

## Purpose
mkcert-based TLS certificate generation for the local dev stack. A one-shot Docker container builds and runs mkcert to generate self-signed certificates trusted by the local machine, which are then shared with Traefik and other services via a volume.

## Key Files

| File | Description |
|------|-------------|
| `Dockerfile` | Builds the mkcert image — installs mkcert and the local CA |
| `entrypoint.sh` | Generates `docker.internal` and `*.docker.internal` certs into `/certs` |
| `certs/` | Output directory — populated at stack start, mounted read-only by Traefik and Synapse |

## For AI Agents

### Working In This Directory
- `certs/` is gitignored (except `.gitkeep`) — certs are generated fresh each time the `mkcert` service runs
- The `mkcert` service runs to completion (`service_completed_successfully`) before Traefik starts
- Cert filenames follow mkcert convention: `docker.internal+1.pem` / `docker.internal+1-key.pem`
- These are dev-only self-signed certs — never use in production

<!-- MANUAL: -->
