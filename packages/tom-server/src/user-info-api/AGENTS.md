<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# user-info-api/

## Purpose
Enriched user profile API. Returns comprehensive user metadata combining Matrix profile data (display_name, avatar_url) with identity server attributes (emails, phones, timezone, language). Also manages user information visibility settings (public/private/contacts-only).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/_twake/v1/user_info/:userId` | Get enriched profile for user `:userId` |
| `GET` | `/_twake/v1/user_info/:userId/visibility` | Get visibility settings for user's info |
| `POST` | `/_twake/v1/user_info/:userId/visibility` | Update visibility settings |

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Module export — router and route registration |
| `middlewares/require-ldap.ts` | Middleware that enforces LDAP availability when LDAP is configured |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `middlewares/` | `require-ldap.ts` — LDAP conditional middleware |
| `tests/` | `middleware.test.ts` |

## For AI Agents

### Working In This Directory
- `UserInfoService` singleton aggregates data from MatrixDB and UserDB (LDAP/SQL)
- `require-ldap.ts` middleware is conditionally applied based on config — only when LDAP is enabled
- Visibility settings are stored in the identity server DB (not MatrixDB)
- The response schema includes: `display_name`, `avatar_url`, `emails`, `phones`, `language`, `timezone`

<!-- MANUAL: -->
