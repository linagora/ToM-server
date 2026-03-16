<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# 3pid/

## Purpose
Third-party identifier (3PID) management endpoints for the Matrix Identity Server v2 spec. Handles retrieving, binding, and unbinding email/phone identifiers to Matrix IDs.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | `GET /_matrix/identity/v2/account/3pid` — returns validated 3PIDs for the authenticated user |
| `bind.ts` | `POST /_matrix/identity/v2/3pid/bind` — binds a validated 3PID to a Matrix ID; validates client_secret, session_id, mxid |
| `unbind.ts` | `POST /_matrix/identity/v2/3pid/unbind` — unbinds a 3PID from its Matrix ID association |

## For AI Agents

### Working In This Directory
- Binding requires a prior validation session (see `validate/` module) — the `sid` and `client_secret` must match an existing session
- Bindings are stored in the `mappings` DB collection
- Unbind accepts both authenticated and signed (from homeserver) requests

<!-- MANUAL: -->
