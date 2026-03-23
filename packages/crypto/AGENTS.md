<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# @twake/crypto

## Purpose
Cryptographic utility package for the Twake/Matrix ecosystem. Provides SHA-256/SHA-512 hashing (via js-nacl), Ed25519/Curve25519 key pair generation (via tweetnacl), canonical JSON serialization, and JSON object signing for Matrix federation. Also exposes random string generation and base64url encoding helpers.

## Key Files

| File | Description |
|------|-------------|
| `src/index.ts` | All exports: `Hash`, `generateKeyPair`, `signJson`, `canonicalJson`, `randomString`, `toBase64Url`, `supportedHashes` |
| `package.json` | Package manifest (`@twake/crypto`) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | TypeScript source (see `src/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- `Hash` class requires async initialization: `await hash.ready` before calling `.sha256()` or `.sha512()`
- `generateKeyPair` returns `{ keyId, publicKey, privateKey }` — `keyId` is in `ed25519:<base64>` format
- `signJson` mutates the input object in-place (adds `signatures` field) and returns it
- `canonicalJson` sorts keys recursively — use it before signing to ensure deterministic output
- `supportedHashes` is an array used by identity server lookup to advertise hash algorithms

### Testing Requirements
```bash
npx nx run  @twake/crypto:test
```

### Common Patterns
```typescript
const hash = new Hash();
await hash.ready;
const digest = hash.sha256('pepper', 'user@example.com', 'email');

const { keyId, publicKey, privateKey } = generateKeyPair('ed25519');
const signed = signJson(obj, privateKey, 'myserver.com', keyId);
```

## Dependencies

### Internal
None — no `@twake/*` runtime dependencies.

### External
- `js-nacl ^1.4.0` — SHA-256/SHA-512 hashing (WebAssembly NaCl)
- `tweetnacl` — Ed25519/Curve25519 key operations (declared in root package.json)

<!-- MANUAL: -->
