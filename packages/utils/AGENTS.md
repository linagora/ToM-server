<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# @twake/utils

## Purpose
Shared utility functions and Matrix error code definitions used across all `@twake/*` server packages. Provides HTTP response helpers, request body parsing, parameter validation, Matrix ID construction/validation, and standardized error response objects matching the Matrix specification.

## Key Files

| File | Description |
|------|-------------|
| `src/errors.ts` | `errCodes` map, `errMsg()` factory, `defaultMsg()` — Matrix error response helpers |
| `src/utils.ts` | `send()`, `jsonContent()`, `validateParameters()`, `epoch()`, `toMatrixId()`, `isMatrixId()`, `isValidUrl()`, `getLocalPart()`, `hostnameRe`, `expressAppHandler` type |
| `src/index.ts` | Re-exports everything from errors.ts and utils.ts |
| `package.json` | Package manifest (`@twake/utils`) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | TypeScript source (see `src/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- `errMsg(code, explanation?)` returns `{ errcode: 'M_...', error: '...' }` — use for all error responses
- `send(res, status, body)` sends JSON and ends the response — always use instead of `res.json()`
- `validateParameters(res, desc, content, logger, cb)` validates required/extra params; calls `cb` on success
- `jsonContent(req, res, logger, cb)` parses JSON or urlencoded body; calls `cb(body)` on success
- `errCodes` contains all Matrix error strings: `M_FORBIDDEN`, `M_UNAUTHORIZED`, `M_NOT_FOUND`, etc.
- `expressAppHandler` is the type for Express request handlers throughout the codebase

### Testing Requirements
```bash
npx nx run  @twake/utils:test
```

## Dependencies

### Internal
- `@twake/logger` — TwakeLogger type for function signatures

### External
None — no additional runtime dependencies.

<!-- MANUAL: -->
