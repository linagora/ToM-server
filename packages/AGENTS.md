<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# packages/

## Purpose
Container for all npm workspace packages that make up the ToM-Server monorepo. Packages range from low-level utilities (config-parser, crypto, logger) to high-level application servers (tom-server, federated-identity-service). Each package is independently buildable and testable, and they depend on each other via the `@twake/*` workspace protocol.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `common-settings-bridge/` | Matrix Application Service bridge for syncing settings (see `common-settings-bridge/AGENTS.md`) |
| `config-parser/` | Multi-source configuration loader with type coercion (see `config-parser/AGENTS.md`) |
| `crypto/` | Hashing, key generation, and JSON signing utilities (see `crypto/AGENTS.md`) |
| `db/` | Database abstraction layer for PostgreSQL and SQLite (see `db/AGENTS.md`) |
| `federated-identity-service/` | Federated Matrix Identity Server for multi-server deployments (see `federated-identity-service/AGENTS.md`) |
| `logger/` | Winston-based logger with configurable transports (see `logger/AGENTS.md`) |
| `matrix-identity-server/` | Full Matrix Identity Server v2 spec implementation (see `matrix-identity-server/AGENTS.md`) |
| `matrix-resolve/` | Matrix server address resolution via DNS/well-known (see `matrix-resolve/AGENTS.md`) |
| `tom-server/` | Main Twake on Matrix server — composes all API modules (see `tom-server/AGENTS.md`) |
| `utils/` | Shared HTTP helpers, Matrix ID utilities, and error codes (see `utils/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- Each package has its own `package.json`, `tsconfig.json`, `rollup.config.js`, and `src/`
- All packages compile to `dist/` — never edit `dist/` files directly
- Shared config at root: `jest-base.config.js`, `tsconfig.json`, `rollup.config.js`
- This directory itself contains only `tsconfig-test.json` (shared test TypeScript config)

### Dependency Graph (simplified)
```
config-parser  ← (no @twake deps)
crypto         ← (no @twake deps)
matrix-resolve ← (no @twake deps)
logger         ← config-parser
utils          ← logger
db             ← config-parser, logger
matrix-identity-server ← config-parser, logger, utils, crypto, db, matrix-resolve
federated-identity-service ← matrix-identity-server (+ all its deps)
tom-server     ← matrix-identity-server, utils, config-parser, logger, db
common-settings-bridge ← (independent, uses own deps)
```

<!-- MANUAL: -->
