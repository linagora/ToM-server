<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# matrix-resolve

## Purpose
Resolves Matrix homeserver addresses from domain names following the Matrix Federation specification. Implements the full resolution algorithm: IP literal check → `.well-known/matrix/server` delegation → DNS SRV records (`_matrix-fed._tcp`, `_matrix._tcp`) → DNS A/AAAA fallback with port 8448. Supports optional LRU caching via `toad-cache`.

## Key Files

| File | Description |
|------|-------------|
| `src/index.ts` | Exports: `matrixResolve()`, `MatrixResolve` class, `WellKnownMatrixServer` type, `MatrixResolveArgs`, `CacheType` |
| `package.json` | Package manifest (`matrix-resolve`, version `1.0.1`) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | TypeScript source (see `src/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- `matrixResolve(name)` is the simple stateless API — no caching
- `MatrixResolve` class supports optional `toad-cache` LRU caching (configurable TTL/size)
- `cacheReady` promise must be awaited before calling `resolve()` when caching is enabled
- `toad-cache` is an optional peer dependency — dynamically imported at runtime

### Testing Requirements
```bash
npx nx run  matrix-resolve:test
```
Tests mock `node-fetch` and DNS — no network required.

### Common Patterns
```typescript
// Simple (no cache)
const urls = await matrixResolve('matrix.example.com');

// With caching
const resolver = new MatrixResolve({ cache: { type: 'toad-cache', ttl: 3600, max: 100 } });
await resolver.cacheReady;
const url = await resolver.resolve('matrix.example.com');
```

## Dependencies

### Internal
None — no `@twake/*` dependencies.

### External
- `node-fetch ^3.3.0` — HTTP fetch for `.well-known` lookup
- `toad-cache ^3.3.0` — Optional LRU cache (optional dependency)

<!-- MANUAL: -->
