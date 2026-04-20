# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working on the Code

This repo is advocating the use of guidelines for code contribution.
Please refere to:

- CODING_STYLE.md: for all code related rules
- CONTRIBUTING.md: for all developer guidelines

## Commands

```bash
# Install dependencies
npm install

# Serve with auto-reload (primary dev command)
npx nx serve tom-server

# Run tests
npx nx test tom-server

# Build
npx nx build tom-server

# Format check / fix
npm run format:check
npm run format:fix

# Start the full-stack dev environment (tom runs on host)
docker compose up -d

# Start the full-stack deploy environment (tom runs in Docker)
docker compose -f compose.yml -f compose.deploy.yml up -d
```

### Skip NX Cache

```bash
npx nx <script> <project> --no-cloud # To only skip cloud cache
npx nx <script> <project> --skip-nx-cache # To entirely skip the cache
```

## Development Setup

1. Copy config: `cp .tomconfig.example.yaml .tomconfig.yaml`
2. Edit `.tomconfig.yaml` — fill in required fields (Matrix domain, DB credentials, etc.)
3. `docker compose up -d` — starts Synapse, PostgreSQL, Traefik, LDAP, LemonLDAP::NG (SSO), RabbitMQ, Common Settings Bridge, Twake Chat. Traefik routes `tom.docker.internal` → `localhost:3000`.
4. `npx nx serve tom-server` — starts the server with hot-reload

## Compose Structure

Three files at the repo root:

| File | Purpose |
|------|---------|
| `compose.yml` | Base — all shared services (traefik, ldap, postgres, synapse, auth, rabbitmq, cs-bridge, twake-chat) |
| `compose.override.yml` | Dev overrides — auto-loaded; adds traefik file provider routing tom to `host.docker.internal:3000` |
| `compose.deploy.yml` | Deploy overrides — adds tom as a Docker container (`apps/tom-server/Dockerfile`) |

Config files under `.compose/`:
- `.compose/tom/config.example.yaml` — tom config template for deploy mode (copy to `config.yaml`)

## Architecture

This is an **Nx monorepo**. The active server lives in `apps/tom-server`; `packages/` is reserved for shared libraries.

> The legacy packages (`packages/tom-server`, `packages/matrix-identity-server`, `packages/federated-identity-service`, `packages/logger`, `packages/config-parser`, `packages/utils`) are deprecated. Their functionality is being migrated incrementally to `apps/tom-server`. Do not add new code to deprecated packages.

### `apps/tom-server`

The unified server entrypoint. Uses **Express**, **Winston** for logging, and **Zod + YAML** for configuration. Config schema and types are in `apps/tom-server/src/`.

Feature modules follow a consistent pattern: `routes/` → `controllers/` → `services/` with `middlewares/` and `types.ts`. Tests live alongside source in `tests/`.

### Configuration

Config is loaded from `.tomconfig.yaml` (Zod-validated). Overloading via environment variables is **not supported** — all configuration is in the YAML file. See `.tomconfig.example.yaml` for the full reference.

### Assets

- `assets/templates/` — mail and SMS templates
- `i18n/` — internationalisation translations
- `static/` — server landing page

### Testing

Tests use Jest + ts-jest. Run with `npx nx test tom-server`. New projects should be created with `npx nx generate`.

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

### Build & Compile

```bash
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
```

### Test

```bash
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git

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

### GitHub

```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling

```bash
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
```

### Files & Search

```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug

```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure

```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
```

### Network

```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```
