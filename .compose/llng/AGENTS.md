<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-04-16 -->

# .compose/llng/

## Purpose
LemonLDAP::NG (LLNG) SSO provider configuration for local development. LLNG serves as the OpenID Connect identity provider used by both Synapse and the ToM Server.

## Key Files

| File | Description |
|------|-------------|
| `lmConf-1.json` | LemonLDAP::NG configuration — defines OIDC clients, LDAP connection, and session settings |

## For AI Agents

### Working In This Directory
- This config is mounted into the `auth` container at startup (read-only)
- OIDC client IDs and secrets defined here must match the corresponding config in `apps/tom-server`
- The dev stack pre-configures one OIDC client: `synapse` (used by Synapse for SSO)
- LLNG is reachable at `https://auth.docker.internal` in the dev stack

<!-- MANUAL: -->
