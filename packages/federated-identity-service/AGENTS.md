<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# @twake/federated-identity-service

## Purpose
Extends `@twake/matrix-identity-server` for federated multi-server deployments. Adds trusted server allowlisting, IP address/network filtering, and custom federation authentication middleware. Designed to run as a standalone service that federates identity lookups across multiple Matrix homeservers.

## Key Files

| File | Description |
|------|-------------|
| `src/index.ts` | `FederatedIdentityService extends MatrixIdentityServer` — main class |
| `package.json` | Package manifest (`@twake/federated-identity-service`) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | TypeScript source (see `src/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- Inherits all Matrix Identity Server v2 endpoints from `MatrixIdentityServer`
- Additional config keys: `trusted_servers_addresses` (IP allowlist), federation trust policies
- The `authenticate()` override validates that requests come from trusted Matrix servers
- Use this package when deploying a standalone federated identity service (not embedded in tom-server)

### Testing Requirements
```bash
npx nx run  @twake/federated-identity-service:test
```

## Dependencies

### Internal
- `@twake/matrix-identity-server` — Base class (and all its transitive deps)

### External
- `express` — HTTP framework

<!-- MANUAL: -->
