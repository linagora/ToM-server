<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# lookup/

## Purpose
Privacy-preserving user lookup via hashed addresses (Matrix Identity Server v2 spec). Clients hash email/phone addresses with a pepper before querying, preventing the server from learning which addresses are being searched. Also exposes hash algorithm details.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | `POST /_matrix/identity/v2/lookup` — accepts hashed addresses, returns matched Matrix IDs |
| `hash_details.ts` | `GET /_matrix/identity/v2/hash_details` — returns current pepper and supported hash algorithms |
| `updateHash.ts` | Worker function — re-hashes all stored addresses after a pepper change; uses `generic-pool` for concurrency (5 workers) |
| `README.md` | Documentation for the lookup hash mechanism |

## For AI Agents

### Working In This Directory
- Hash algorithm: SHA-256 of `<address> <medium> <pepper>` encoded as URL-safe base64
- Supported algorithms: `sha256` (see `@twake/crypto`'s `supportedHashes`)
- Pepper is stored in the DB and rotated by `cron/changePepper.ts`
- `updateHash.ts` is CPU-intensive during pepper rotation — the worker pool limits parallelism

<!-- MANUAL: -->
