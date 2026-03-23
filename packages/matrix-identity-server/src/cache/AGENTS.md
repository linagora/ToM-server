<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# cache/

## Purpose
Pluggable cache abstraction for the Matrix Identity Server. Provides a unified interface over in-memory and Redis backends. Used for caching lookup results and other frequently-read data.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Cache factory — selects `MemoryCache` or `RedisCache` based on `cache_engine` config key |
| `memory.ts` | In-memory cache using Node.js `Map` — suitable for single-instance deployments |
| `redis.ts` | Redis-backed cache using the `redis` npm package — suitable for multi-instance deployments |

## For AI Agents

### Working In This Directory
- Config key `cache_engine`: `'memory'` (default) or `'redis'`
- Redis config keys: `redis_host`, `redis_port`, `redis_password`
- Both implementations expose the same interface: `get(key)`, `set(key, value, ttl?)`, `delete(key)`
- When adding a new cache backend, implement the same interface and register in `index.ts`

<!-- MANUAL: -->
