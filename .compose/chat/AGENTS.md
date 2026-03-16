<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# .compose/chat/

## Purpose
Synapse Matrix homeserver configuration for local development Docker Compose stacks. Contains the homeserver config for SSO-enabled setups.

## Key Files

| File | Description |
|------|-------------|
| `config.sso.json` | Synapse homeserver configuration for SSO (LemonLDAP::NG) integration |

## For AI Agents

### Working In This Directory
- This config is mounted into the Synapse container at startup
- Do not commit real signing keys or tokens — use placeholder values for dev configs
- For non-SSO setups, Synapse config is typically defined inline in the compose override files

<!-- MANUAL: -->
