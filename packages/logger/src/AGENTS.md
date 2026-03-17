<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# logger/src/

## Purpose
TypeScript source for `@twake/logger`. Implements a Winston logger factory with Twake-specific configuration schema and pluggable transport support (console, file, daily-rotate). Organized into the main factory, transport builder, and per-transport configuration modules.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | `getLogger()` factory, `ETransportType` enum, `TwakeLogger` and `Config` type exports |
| `types.ts` | Type definitions for logger config and transport options |
| `config.json` | Default configuration values for the logger |
| `configDesc.json` | `ConfigDescription` schema defining all supported logger config keys |
| `index.test.ts` | Jest tests for logger initialization with various config combinations |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `logger-options/` | Builds Winston `LoggerOptions` from config; delegates to transport factory |
| `logger-options/transport/` | Transport factory that creates Winston transports based on `ETransportType` |
| `logger-options/transport/options/` | Per-transport option builders (console, file, daily-rotate, default) |

## For AI Agents

### Working In This Directory
- To add a new transport type: add to `ETransportType`, add an options module in `transport/options/`, register in transport factory
- `configDesc.json` drives config validation — add new config keys here first
- `__testData__/` contains JSON fixtures for testing config error paths

<!-- MANUAL: -->
