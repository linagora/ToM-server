<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-04-16 -->

# .compose/ldap/

## Purpose
OpenLDAP service setup for local development. Contains bootstrap LDIF files loaded automatically at container startup and a utility script to generate additional test user entries.

## Key Files

| File | Description |
|------|-------------|
| `bootstrap/00-acl-config.ldif` | ACL configuration (anonymous read access) |
| `bootstrap/01-custom-schema.ldif` | Custom schema — defines `workplaceFqdn` attribute and `workplaceUser` objectClass |
| `bootstrap/02-base-structure.ldif` | Base DN structure — `ou=users`, `cn=readers` group |
| `bootstrap/03-users.ldif` | Test users (60+) pre-loaded at startup |
| `generate_ldap_entries.sh` | Script to generate additional user LDIF entries (outputs LDIF to stdout) |

## For AI Agents

### Working In This Directory
- Bootstrap LDIF files are loaded **in alphabetical order** by the osixia/openldap image at first startup
- Base DN: `dc=docker,dc=internal` — credentials: `cn=admin,dc=docker,dc=internal` / `admin`
- After changing bootstrap files, delete the LDAP data volume and restart to re-initialize
- `generate_ldap_entries.sh` outputs LDIF to stdout — pipe it into `ldapadd` to load entries manually
- Test user passwords match their usernames (e.g., user1/user1)

<!-- MANUAL: -->
