# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run all tests
npm run test

# Run tests for a single package (e.g. tom-server)
cd packages/tom-server && npm run test

# Run tests matching a pattern (from within a package directory)
npx jest --testPathPattern="addressbook"

# Format check / fix
npm run format:check
npm run format:fix

# Dev mode (watch + auto-reload server)
npm run dev

# Start dev dependencies (Postgres + LDAP)
docker compose -f .compose/examples/dev.pgsql+ldap.yml up -d
```

Tests run with `LOG_TRANSPORTS=File LOG_FILE=/dev/null jest` to suppress log output. The jest config maps `@twake/*` imports to local `packages/*/src` directories, so tests run against source directly without building.

## Architecture

This is an **npm workspaces + Lerna monorepo** with ESM modules (`"type": "module"`). Packages are built with Rollup.

### Package Hierarchy

```
@twake/matrix-identity-server   ← Base Matrix Identity Server (spec-compliant)
        ↑
@twake/server (tom-server)      ← Extends identity server with Twake-specific APIs
        ↑
@twake/federated-identity-service ← Cross-server federated identity lookup
```

Supporting packages: `@twake/config-parser`, `@twake/crypto`, `@twake/logger`, `@twake/utils`, `@twake/db`, `@twake/amqp-connector`, `matrix-resolve`.

### `@twake/matrix-identity-server`

Implements the [Matrix Identity Service API v2](https://spec.matrix.org/latest/identity-service-api/). The main class (`MatrixIdentityServer`) initializes two databases:

- **`IdentityServerDb`** (`db/`): owns identity-server tables (accessTokens, hashes, mappings, keys, etc.) — backed by SQLite or PostgreSQL.
- **`UserDB`** (`userdb/`): user directory — backed by SQLite, PostgreSQL, or LDAP.

Routes are registered on `this.api.get` / `this.api.post` maps and mounted by the parent server.

### `@twake/server` (tom-server)

The main entrypoint. `TwakeServer` extends `MatrixIdentityServer` by adding:

- A second DB connection to the **Matrix (Synapse) database** (`MatrixDB`) for reading room/user state.
- Feature APIs as Express Router modules under `src/`:
  - `addressbook-api`, `user-info-api`, `invitation-api` — contact/user management
  - `vault-api` — end-to-end key backup
  - `matrix-api/client` — proxies/extends Matrix client-server API
  - `admin-settings-api`, `metrics-api`, `sms-api`, `qrcode-api`, `deactivate-account-api`
  - `wellKnown` — `.well-known` discovery endpoints
  - `identity-server` — wires lookup routes to singleton services

Feature API modules follow a consistent pattern: `routes/` → `controllers/` → `services/` with `middlewares/` and `types.ts`. Tests live in `tests/`.

Singleton services (`AddressbookService`, `UserInfoService`, `TokenService`, `SmsService`) are created in `TwakeServer._initServer()` and injected into feature routers.

### Configuration

Config is loaded via `@twake/config-parser` from (in priority order): `/etc/twake/server.conf`, `TWAKE_SERVER_CONF` env var, or constructor argument. Defaults are in each package's `src/config.json`. See `packages/tom-server/src/types.ts` (`Config` type) for all options.

### Databases

- `database_engine`: `sqlite` (default/dev) or `pg` (production)
- `userdb_engine`: `sqlite`, `pg`, or `ldap`
- `matrix_database_engine`: connects to Synapse's own DB (read-only)
- Optional: Redis cache (`cache_engine`), RabbitMQ (`rabbitmq`) for AMQP features

### Testing

Tests use Jest + ts-jest and `testcontainers` for spinning up real PostgreSQL/LDAP in CI. Coverage thresholds: 70% branches, 80% lines. Each package has its own `jest.config.ts` extending `jest-base.config.js` at the root.

<!-- rtk-instructions v2 -->

# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:

```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)

```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (90-99% savings)

```bash
rtk cargo test          # Cargo test failures only (90%)
rtk vitest run          # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)

```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)

```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)

```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)

```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)

```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)

```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)

```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands

```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category         | Commands                       | Typical Savings |
| ---------------- | ------------------------------ | --------------- |
| Tests            | vitest, playwright, cargo test | 90-99%          |
| Build            | next, tsc, lint, prettier      | 70-87%          |
| Git              | status, log, diff, add, commit | 59-80%          |
| GitHub           | gh pr, gh run, gh issue        | 26-87%          |
| Package Managers | pnpm, npm, npx                 | 70-90%          |
| Files            | ls, read, grep, find           | 60-75%          |
| Infrastructure   | docker, kubectl                | 85%             |
| Network          | curl, wget                     | 65-70%          |

Overall average: **60-90% token reduction** on common development operations.

<!-- /rtk-instructions -->
