<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# federated-identity-service/src/

## Purpose
TypeScript source for `@twake/federated-identity-service`. Extends `MatrixIdentityServer` with federation-specific authentication, IP filtering, and routing. Contains extensive integration test data for multi-server federation scenarios.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | `FederatedIdentityService extends MatrixIdentityServer` — main class |
| `index.test.ts` | Integration tests |
| `types.ts` | Type definitions for federation config and responses |
| `config.json` | Default configuration values |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `controllers/` | Request handlers (`controllers.ts`) |
| `middlewares/` | `auth.ts` (federation auth), `errors.ts`, `validation.ts`, `utils.ts` |
| `routes/` | Route definitions (`routes.ts`) |
| `utils/` | `ip-address.ts` — IP range/allowlist checking for trusted servers |
| `__testData__/` | Full integration test stack: LDAP config, Synapse configs (3 homeservers), HAProxy, SSL certs, LLNG config |

## For AI Agents

### Working In This Directory
- `middlewares/auth.ts` validates that requests originate from trusted Matrix servers (via `trusted_servers_addresses` config)
- `utils/ip-address.ts` handles CIDR range matching for IP allowlisting
- Integration tests in `__testData__/` require Docker to run the full stack (LDAP, Synapse, HAProxy)
- Do not modify SSL certs in `__testData__/ssl/` — they are pre-generated for local dev

<!-- MANUAL: -->
