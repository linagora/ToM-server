<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# crypto/src/

## Purpose
TypeScript source for the `@twake/crypto` package. Single `index.ts` implementing all cryptographic operations: SHA-256/SHA-512 hashing, Ed25519/Curve25519 key pair generation, canonical JSON serialization, JSON signing, random string generation, and base64url encoding.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | All exports: `Hash` class, `generateKeyPair`, `signJson`, `canonicalJson`, `randomString`, `randomChar`, `toBase64Url`, `supportedHashes` |

## For AI Agents

### Working In This Directory
- `Hash` uses js-nacl (WebAssembly) — requires `await hash.ready` before use
- `generateKeyPair` uses tweetnacl for actual key generation; wraps result in `{ keyId, publicKey, privateKey }`
- `keyId` format: `ed25519:<base64urlkey>` — this format is required by Matrix federation
- `canonicalJson` is recursive and sorts object keys lexicographically

<!-- MANUAL: -->
