<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# metrics-api/

## Purpose
Usage analytics API that exposes Matrix homeserver activity statistics. Provides daily/weekly/monthly active user counts (DAU/WAU/MAU), new user registration trends, and per-user message counts. Requires elevated/admin permissions.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/_twake/v1/metrics/activity` | Activity metrics: DAU, WAU, MAU, new user counts |
| `GET` | `/_twake/v1/metrics/messages` | Per-user message count statistics |

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Module export |
| `types.ts` | Metric response type definitions |
| `routes/index.ts` | Route definitions |
| `controllers/index.ts` | Request handlers |
| `middlewares/index.ts` | Permission checking (admin/elevated access) |
| `services/index.ts` | Queries MatrixDB for activity statistics |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `routes/` | Route definitions |
| `controllers/` | Request handlers |
| `middlewares/` | Permission validation |
| `services/` | MatrixDB query logic |
| `tests/` | `controller.test.ts`, `middleware.test.ts`, `router.test.ts`, `service.test.ts` |

## For AI Agents

### Working In This Directory
- Queries the Matrix (Synapse) database directly — not the identity server DB
- Permission middleware must validate admin/elevated access before serving metrics
- DAU/WAU/MAU are computed from Synapse's `user_ips` or equivalent tables

<!-- MANUAL: -->
