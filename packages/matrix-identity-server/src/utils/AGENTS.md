<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# utils/ (matrix-identity-server)

## Purpose
Internal utility modules for the Matrix Identity Server: email sending via SMTP, SMS dispatch, and Matrix homeserver token validation. These are shared across multiple server modules.

## Key Files

| File | Description |
|------|-------------|
| `mailer.ts` | `Mailer` class — sends emails via `nodemailer`; configures SMTP with optional TLS/auth |
| `sms-service.ts` | `SmsService` class — SMS sending abstraction for invitation delivery |
| `sms-service.test.ts` | Tests for SMS service |
| `validateMatrixToken.ts` | Validates a Matrix homeserver access token by calling `/_matrix/federation/v1/openid/userinfo` |

## For AI Agents

### Working In This Directory
- SMTP config keys: `smtp_server`, `smtp_port`, `smtp_user`, `smtp_password`, `smtp_tls`
- `validateMatrixToken` is called during account registration to verify the homeserver token
- `Mailer` is used by `invitation/index.ts` and `validate/email/` modules

<!-- MANUAL: -->
