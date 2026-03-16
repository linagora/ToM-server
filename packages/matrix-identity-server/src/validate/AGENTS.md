<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# validate/

## Purpose
Email address validation flow for the Matrix Identity Server v2 spec. Manages validation sessions: requesting a token (sends email), and submitting the token to complete validation. Validated sessions are prerequisites for 3PID binding.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `email/` | Email validation endpoints: request token, submit/validate token |

## For AI Agents

### Working In This Directory
- Validation creates a session with `sid` and `client_secret` stored in DB `attempts` collection
- Token is sent to the user's email via `Mailer`
- After successful validation, the session is marked as validated — required for `3pid/bind.ts`
- Session TTL is configurable via config key

<!-- MANUAL: -->
