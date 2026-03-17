<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# common-settings-bridge/src/

## Purpose
TypeScript source for `@twake/common-settings-bridge`. Implements a Matrix Application Service bridge that syncs settings (e.g., user profile data) between ToM-Server and a Matrix homeserver. Uses the `matrix-appservice-bridge` library.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Bridge entry point — initializes the Application Service and registers handlers |
| `bridge.ts` | Core bridge logic — Matrix AS event handling and routing |
| `bridge.test.ts` | Jest tests for bridge logic |
| `types.ts` | TypeScript type definitions for bridge config and events |
| `settings-repository.ts` | Data access layer for reading/writing settings |
| `settings-repository.test.ts` | Tests for settings repository |
| `matrix-profile-updater.ts` | Handles updating Matrix user profiles via the homeserver API |
| `matrix-profile-updater.test.ts` | Tests for profile updater |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `__mocks__/` | `matrix-appservice-bridge.ts` — Jest mock for the Matrix AS bridge library |

## For AI Agents

### Working In This Directory
- The bridge communicates with Synapse via the Application Service API — transactions come in as POST requests to the bridge's HTTP server
- `matrix-appservice-bridge` is mocked in tests — the mock is in `__mocks__/`
- The bridge registration (`registration.example.yaml`) must match the `hs_token`/`as_token` in config

<!-- MANUAL: -->
