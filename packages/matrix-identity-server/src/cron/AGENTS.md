<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# cron/

## Purpose
Scheduled background jobs for the Matrix Identity Server. Manages periodic tasks such as hash pepper rotation, quota enforcement, user data synchronization, and federated identity hash updates. Uses `node-cron` for scheduling.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Scheduler class — initializes and manages lifecycle of all cron tasks |
| `changePepper.ts` | Rotates the lookup hash pepper and re-hashes all stored addresses |
| `check-quota.ts` | Enforces user quotas and cleans up expired access tokens |
| `updateUsers.ts` | Syncs user data from external sources (LDAP/SQL) into the identity DB |
| `update-federated-identity-hashes.ts` | Updates identity hashes for federated server entries |
| `changePepper.test.ts` | Tests for pepper rotation logic |
| `check-quota.test.ts` | Tests for quota checking |
| `update-federated-identity-hashes.test.ts` | Tests for federated hash updates |
| `index.test.ts` | Tests for scheduler initialization |

## For AI Agents

### Working In This Directory
- Cron intervals are configured via config keys (e.g., `pepper_cron`, `userdb_cron`)
- `changePepper.ts` is the most critical job — it invalidates all existing hashes and rebuilds them; run carefully
- Jobs are started automatically when `MatrixIdentityServer` initializes
- Use `node-cron` schedule syntax for new jobs

<!-- MANUAL: -->
