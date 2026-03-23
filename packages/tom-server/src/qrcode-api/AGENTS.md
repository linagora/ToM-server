<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# qrcode-api/

## Purpose
Generates QR codes encoding the authenticated user's access token. Used to facilitate mobile device login flows where a user scans a QR code displayed on a desktop client to log in on their mobile device. Returns SVG image format.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/_twake/v1/qrcode` | Return SVG QR code image encoding the user's access token |

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | Module export — router registration |
| `types.ts` | Type definitions for QR code config/response |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `test/` | `controller.test.ts`, `service.test.ts` |

## For AI Agents

### Working In This Directory
- Requires Matrix token authentication — extracts user's access token from the request
- Uses the `qrcode` npm package to generate SVG output
- Response `Content-Type` is `image/svg+xml`
- `TokenService` singleton is used to manage/validate tokens

<!-- MANUAL: -->
