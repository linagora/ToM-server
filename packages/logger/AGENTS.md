<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# @twake/logger

## Purpose
Winston-based logging package used by all other `@twake/*` packages. Wraps `winston` with a Twake-specific configuration schema loaded via `@twake/config-parser`. Supports console, file, and daily-rotating-file transports configurable via `ETransportType`.

## Key Files

| File | Description |
|------|-------------|
| `src/index.ts` | Exports: `getLogger()`, `ETransportType`, `Config` type, `TwakeLogger` type |
| `package.json` | Package manifest (`@twake/logger`) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | TypeScript source including transport implementations (see `src/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- `getLogger(conf?, confDesc?)` is the main factory — returns a Winston `Logger` instance typed as `TwakeLogger`
- `TwakeLogger` is a type alias for Winston's `Logger` — use it for dependency injection
- `ETransportType` enum values: `Console`, `File`, `DailyRotateFile`
- Logger configuration is loaded from environment variables or config object

### Testing Requirements
```bash
npx nx run  @twake/logger:test
```

### Common Patterns
```typescript
import { getLogger } from '@twake/logger';
const logger = getLogger();
logger.info('Server started');
logger.error('Connection failed', { err });
```

## Dependencies

### Internal
- `@twake/config-parser` — Configuration loading

### External
- `winston ^3.10.0` — Core logging framework
- `winston-daily-rotate-file ^4.7.1` — Daily rotating file transport

<!-- MANUAL: -->
