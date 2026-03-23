<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# account/

## Purpose
Matrix Identity Server v2 account management endpoints. Handles user registration (obtaining an access token), account info retrieval, and logout.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | `GET /_matrix/identity/v2/account` — returns `{ user_id }` for the authenticated token |
| `register.ts` | `POST /_matrix/identity/v2/account/register` — validates homeserver token, creates access token, stores in DB |
| `logout.ts` | `POST /_matrix/identity/v2/account/logout` — deletes the current access token from DB |

## For AI Agents

### Working In This Directory
- Registration validates the Matrix homeserver token by calling the homeserver's `/_matrix/federation/v1/openid/userinfo` endpoint
- Access tokens are stored in the `accessTokens` DB collection
- All endpoints except `register` require authentication via the identity server's `authenticate()` method

<!-- MANUAL: -->
