<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# terms/

## Purpose
Terms of Service and Privacy Policy endpoints for the Matrix Identity Server v2 spec. Serves configured policy documents and records user acceptance.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | `GET /_matrix/identity/v2/terms` — returns the configured policies object |
| `index.post.ts` | `POST /_matrix/identity/v2/terms` — records that the authenticated user has accepted the terms |
| `_computePolicies.ts` | Helper — builds the `policies` object from config (privacy_policy, terms_of_service keys) |
| `index.test.ts` | Tests for both endpoints |
| `__testData__/` | Sample policy config fixtures for tests |

## For AI Agents

### Working In This Directory
- Policy URLs and versions are configured via `terms_and_conditions_urls` and `privacy_policy_urls` config keys
- Accepted policies are stored in the `userPolicies` DB collection
- `_computePolicies.ts` transforms flat config keys into the nested `{ policies: { ... } }` response format

<!-- MANUAL: -->
