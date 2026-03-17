<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# .compose/ldap/

## Purpose
OpenLDAP service setup for local development. Contains a shell script to seed the LDAP directory with test users and documentation for the LDAP configuration.

## Key Files

| File | Description |
|------|-------------|
| `generate_ldap_entries.sh` | Script to populate LDAP with test user entries (LDIF format) |
| `README.md` | Instructions for LDAP setup and user seeding |

## For AI Agents

### Working In This Directory
- Run `generate_ldap_entries.sh` after the LDAP container starts to populate test users
- LDAP base DN and credentials are defined in the compose override files
- Test user entries match the expected format for `@twake/matrix-identity-server`'s `userdb/ldap.ts`

<!-- MANUAL: -->
