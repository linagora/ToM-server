<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# invitation-api/

## Purpose
User-to-user invitation system supporting email and SMS delivery. Allows authenticated users to invite others to join Twake Chat. Manages invitation lifecycle: creation, link generation, status tracking, acceptance (with redirect), and revocation.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/_twake/v1/invite` | Send an invitation (email or SMS) |
| `POST` | `/_twake/v1/invite/generate` | Generate an invitation link without sending |
| `GET` | `/_twake/v1/invite/list` | List all invitations sent by the current user |
| `GET` | `/_twake/v1/invite/:id` | Accept/redeem an invitation (redirects to client) |
| `GET` | `/_twake/v1/invite/:id/status` | Check status of a specific invitation |
| `DELETE` | `/_twake/v1/invite/:id` | Revoke an invitation |

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Module export |
| `routes/index.ts` | Route definitions |
| `controllers/index.ts` | Request handlers for all invitation operations |
| `middlewares/index.ts` | Auth, rate limiting, and input validation middleware |
| `services/index.ts` | Invitation business logic — DB operations, email/SMS dispatch |
| `types.ts` | Invitation data types |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `routes/` | Route definitions |
| `controllers/` | Request handlers |
| `middlewares/` | Auth and rate limiting |
| `services/` | Business logic |
| `tests/` | `controller.test.ts`, `middleware.test.ts`, `routes.test.ts`, `service.test.ts` |

## For AI Agents

### Working In This Directory
- Invitation acceptance (`GET /:id`) uses cookie-based auth (not Matrix token) to support browser redirect flows
- Rate limiting is applied to prevent invitation spam — configured via config keys
- Email templates are in `packages/tom-server/src/` email template directory
- `UserInfoService` and `TokenService` singletons are injected as dependencies

<!-- MANUAL: -->
