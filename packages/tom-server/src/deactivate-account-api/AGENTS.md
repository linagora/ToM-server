<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# deactivate-account-api/

## Purpose
Admin-only endpoint to deactivate Matrix user accounts. Validates that the target user exists in the Matrix database before deactivating. Uses `x-access-token` header for admin authentication.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/_twake/admin/deactivate-user/:id` | Deactivate Matrix user account `:id` (admin only) |

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Module export |
| `routes/index.ts` | Route definitions |
| `controllers/index.ts` | Deactivation request handler |
| `middlewares/index.ts` | Admin token validation, user existence check |
| `services/index.ts` | DB operations to deactivate the user |
| `types.ts` | Request/response types |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `routes/` | Route definitions |
| `controllers/` | Request handlers |
| `middlewares/` | Admin auth and user validation |
| `services/` | Deactivation business logic |
| `tests/` | `controller.test.ts`, `middleware.test.ts`, `router.test.ts`, `service.test.ts` |

## For AI Agents

### Working In This Directory
- Uses MatrixDB to verify user existence and perform deactivation
- Admin auth: `x-access-token` header, same mechanism as `admin-settings-api`
- Returns 404 if user not found before attempting deactivation

<!-- MANUAL: -->
