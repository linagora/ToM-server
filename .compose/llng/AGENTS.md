<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# .compose/llng/

## Purpose
LemonLDAP::NG (LLNG) SSO provider configuration for local development. LLNG serves as the OpenID Connect / SAML identity provider in SSO-enabled stacks.

## Key Files

| File | Description |
|------|-------------|
| `lmConf-1.json` | LemonLDAP::NG configuration — defines OIDC clients, SAML providers, LDAP connection, and session settings |

## For AI Agents

### Working In This Directory
- This config is mounted into the LLNG container at startup
- OIDC client IDs and secrets defined here must match the corresponding config in `@twake/tom-server`
- For dev, LLNG is pre-configured with a test OIDC client for Synapse

<!-- MANUAL: -->
