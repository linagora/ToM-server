<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-04-16 -->

# .compose/chat/

## Purpose
Twake Chat frontend configuration for the local development stack. The config file is served by the Nginx container and tells the client which Matrix homeserver and identity server to connect to.

## Key Files

| File | Description |
|------|-------------|
| `config.sso.json` | Twake Chat client config — sets Matrix homeserver URL, identity server URL, and SSO settings |

## For AI Agents

### Working In This Directory
- This config is mounted into the `twake-chat` container at `/usr/share/nginx/html/web/config.json`
- It is a frontend config, not a Synapse server config — do not confuse the two
- Synapse homeserver config lives in `.compose/synapse/hs-config/`
- SSO is always enabled in the dev stack — there is no non-SSO variant

<!-- MANUAL: -->
