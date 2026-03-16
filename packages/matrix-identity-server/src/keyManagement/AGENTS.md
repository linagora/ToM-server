<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# keyManagement/

## Purpose
Ed25519 public key management for the Matrix Identity Server. Serves public keys for signature verification, manages short-term and long-term keypairs, and validates ephemeral key formats.

## Key Files

| File | Description |
|------|-------------|
| `getPubkey.ts` | `GET /_matrix/identity/v2/pubkey/:keyId` — searches short-term then long-term keypairs by keyId |
| `validPubkey.ts` | `GET /_matrix/identity/v2/pubkey/isvalid` — validates whether a public key is current/trusted |
| `validEphemeralPubkey.ts` | `GET /_matrix/identity/v2/pubkey/ephemeral/isvalid` — validates ephemeral key format |
| `updateKey.ts` | Key rotation logic (long-term key refresh) |
| `updateKey.test.ts` | Tests for key update/rotation |

## For AI Agents

### Working In This Directory
- Keys are stored in the identity DB `keys` collection
- Short-term keypairs are generated at startup and rotated periodically
- Long-term keypairs persist across restarts — stored in DB
- `keyId` format: `ed25519:<base64url-encoded-public-key>`

<!-- MANUAL: -->
