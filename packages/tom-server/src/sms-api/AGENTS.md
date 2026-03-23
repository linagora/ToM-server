<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# sms-api/

## Purpose
SMS sending endpoint for authenticated users. Validates phone numbers and dispatches SMS messages via `SmsService`. Requires SMS service to be configured — returns an appropriate error if SMS is not enabled.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/_twake/sms` | Send an SMS to one or more phone numbers |

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Module export |
| `types.ts` | Request/response type definitions |
| `middlewares/index.ts` | Phone number validation middleware |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `middlewares/` | Phone number format validation |
| `tests/` | `controller.test.ts`, `middleware.test.ts`, `service.test.ts` |

## For AI Agents

### Working In This Directory
- `SmsService` singleton is injected from `TwakeServer` — it checks config for SMS provider settings
- If SMS is not configured, the endpoint should return a meaningful error (not 500)
- Phone validation middleware must run before the controller

<!-- MANUAL: -->
