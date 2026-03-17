<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# matrix-resolve/src/

## Purpose
TypeScript source for the `matrix-resolve` package. Single `index.ts` implementing the Matrix federation server resolution algorithm plus an optional caching wrapper class.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | `matrixResolve()` function, `MatrixResolve` class, all resolution logic, type definitions |

## For AI Agents

### Working In This Directory
- Resolution steps are executed in order: IP literal → `.well-known` → SRV DNS → A/AAAA DNS
- `toad-cache` is dynamically imported (`await import('toad-cache')`) — handles missing optional dep gracefully
- Returns `string | string[]` — an array when multiple SRV targets resolve

<!-- MANUAL: -->
