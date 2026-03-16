<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# @twake/common-settings-bridge

## Purpose
Matrix Application Service (AS) bridge that synchronizes common settings between the ToM-Server and a Matrix homeserver. Runs as a standalone service registered with Synapse via the Application Service API. Contains its own Dockerfile for independent container deployment, separate from the main tom-server image.

## Key Files

| File | Description |
|------|-------------|
| `src/index.ts` | Bridge entry point and Application Service handler |
| `config.example.yaml` | Example configuration file for the bridge service |
| `registration.example.yaml` | Matrix AS registration file template (used by Synapse) |
| `Dockerfile` | Container image for standalone bridge deployment |
| `package.json` | Package manifest (`@twake/common-settings-bridge`) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | TypeScript source (see `src/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- This is an independent service — it runs separately from `tom-server`
- The `registration.example.yaml` must be registered with Synapse before the bridge starts
- Configuration is loaded from `config.yaml` (copy from `config.example.yaml`)
- Compose file at `.compose/cs-bridge/` configures this service for Docker deployments

### Testing Requirements
```bash
npx nx run  @twake/common-settings-bridge:test
```

## Dependencies

### External
- `express` — HTTP server for the Application Service endpoint
- Matrix Application Service protocol (Synapse integration)

<!-- MANUAL: -->
