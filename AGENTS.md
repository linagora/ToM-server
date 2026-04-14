<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# ToM-Server

## Purpose

ToM-Server (Twake on Matrix Server) is a npm monorepo that implements a Matrix Identity Server spec–compliant backend for the Twake Chat application. It extends the Matrix Identity Server v2 protocol with Twake-specific REST APIs for addressbooks, user info, invitations, metrics, vault (recovery words), SMS, QR codes, and more. The project is built in TypeScript, runs on Node.js with Express, and supports PostgreSQL and SQLite databases.

## Key Files

| File                  | Description                                                        |
| --------------------- | ------------------------------------------------------------------ |
| `package.json`        | Root workspace manifest — scripts: `build`, `test`, `dev`, `watch` |
| `lerna.json`          | Lerna configuration for monorepo build/publish orchestration       |
| `tsconfig.json`       | Root TypeScript configuration (strict mode, ES module target)      |
| `jest-base.config.js` | Shared Jest configuration extended by all packages                 |
| `rollup.config.js`    | Shared Rollup bundler configuration                                |
| `compose.yml`         | Base compose — shared infrastructure (traefik, ldap, postgres, synapse, auth, rabbitmq, cs-bridge, chat) |
| `compose.override.yml` | Dev overrides — auto-loaded; routes tom to host (`npx nx serve`) |
| `compose.deploy.yml`  | Deploy overrides — adds tom as a Docker container                  |
| `biome.json`          | Biome linter and formatter configuration                           |
| `README.md`           | Project overview and setup instructions                            |
| `TODO.md`             | In-progress work notes                                             |
| `flake.nix`           | Nix development environment definition                             |

## Subdirectories

| Directory   | Purpose                                                                        |
| ----------- | ------------------------------------------------------------------------------ |
| `apps/tom-server/` | The active unified server (`npx nx serve tom-server`); has its own `Dockerfile` and `docker.md` |
| `packages/` | Legacy workspace packages — deprecated, being migrated to `apps/tom-server` (see `packages/AGENTS.md`) |
| `.compose/` | Docker Compose service configs and assets (synapse, ldap, traefik, cs-bridge…) (see `.compose/AGENTS.md`) |
| `.github/`  | GitHub Actions CI/CD workflows (see `.github/AGENTS.md`)                       |
| `docs/`     | Swagger UI API documentation assets (see `docs/AGENTS.md`)                     |
| `.husky/`   | Git hooks: `pre-commit` (lint), `pre-push` (test)                              |

## For AI Agents

### Working In This Directory

- Root-level files are shared config — edit with care, changes affect all packages
- Use `npm` for all package management operations
- Always run `npm install` after modifying any `package.json`
- The project uses ES modules (`"type": "module"` in root package.json)
- TypeScript strict mode is enforced across all packages

### Testing Requirements

```bash
npm test              # Run all tests across all packages (via Lerna)
npx nx run  <pkg>:test   # Run tests for a single package
```

- All tests use Jest; configuration extends `jest-base.config.js`
- Tests require built packages: run `npm build` first if running tests on fresh checkout

### Build

```bash
npm build             # Build all packages via Lerna + Rollup
npm dev               # Watch mode + serve concurrently
```

### Common Patterns

- Each package has its own `package.json`, `tsconfig.json`, and `rollup.config.js`
- Packages produce `dist/` output (excluded from git)
- Internal packages reference each other as `@twake/<name>: "*"`

## Dependencies

### Internal

All inter-package dependencies are managed via npm workspace protocol.

### External

- `express` — HTTP server framework
- `ldapts` — LDAP client for user directory integration
- `tweetnacl` — NaCl cryptography (Ed25519/Curve25519)
- `dotenv` — Environment variable loading
- `concurrently` — Dev: parallel watch + serve
- `lerna` — Monorepo build orchestration
- `rollup` — Module bundler for all packages

<!-- MANUAL: -->
