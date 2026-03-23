<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# vault-api/

## Purpose
Secure storage for user account recovery words (seed phrases/mnemonic). Allows authenticated users to store, retrieve, update, and delete their recovery phrase. Returns 404 when no recovery words exist, 409 on duplicate entries.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/_twake/recoveryWords` | Retrieve stored recovery words |
| `POST` | `/_twake/recoveryWords` | Save recovery words (initial creation) |
| `PUT` | `/_twake/recoveryWords` | Update existing recovery words |
| `DELETE` | `/_twake/recoveryWords` | Delete recovery words |

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Module export and router setup |
| `index.test.ts` | Integration tests |
| `utils.ts` | Encryption/decryption helpers for recovery word storage |
| `utils.test.ts` | Tests for crypto utilities |
| `README.md` | API documentation |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `controllers/` | `vault.ts` — main CRUD controller; `vault.test.ts` — controller tests |
| `middlewares/` | `parser.ts` (request body parsing), `auth.ts` (Matrix token auth) |
| `__testData__/` | `buildTokenTable.ts` — test DB fixture builder |

## For AI Agents

### Working In This Directory
- Recovery words are stored encrypted in the database — `utils.ts` handles the encryption
- `middlewares/auth.ts` validates the Matrix access token before any operation
- 409 Conflict is returned if a user tries to `POST` when recovery words already exist — use `PUT` to update

<!-- MANUAL: -->
