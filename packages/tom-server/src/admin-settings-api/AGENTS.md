<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# admin-settings-api/

## Purpose
Admin-only API for managing user settings. Currently provides an endpoint to update a user's display name. Uses token-based admin authentication (not Matrix token) via the `x-access-token` header.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/_twake/v1/admin/settings/information/:id` | Set display name for user `:id` (admin only) |

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Module export |
| `routes/index.ts` | Route definitions |
| `controllers/index.ts` | Request handlers |
| `middlewares/index.ts` | Admin token validation middleware |
| `services/index.ts` | Business logic for display name updates |
| `types.ts` | Type definitions for request/response shapes |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `routes/` | Route definitions |
| `controllers/` | Request handlers |
| `middlewares/` | Admin token auth middleware |
| `services/` | Business logic |
| `tests/` | `controller.test.ts`, `middleware.test.ts`, `service.test.ts` |

## For AI Agents

### Working In This Directory
- Admin auth uses `x-access-token` header validated against `admin_token` config key — NOT Matrix tokens
- This is intentionally separate from Matrix auth to allow machine-to-machine admin operations

<!-- MANUAL: -->
