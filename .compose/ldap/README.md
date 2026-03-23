# LDAP Development Server

This directory contains the configuration for the development LDAP server using [osixia/openldap](https://github.com/osixia/docker-openldap).

## Overview

The LDAP server is configured via environment variables in `docker-compose.yml` and bootstrap LDIF files. This approach is simpler and more maintainable than the previous custom Dockerfile approach.

### Key Features
- **Image**: osixia/openldap:1.5.0 (800M+ Docker Hub pulls, actively maintained)
- **Base DN**: `dc=docker,dc=localhost`
- **Organization**: Docker
- **Admin credentials**: `cn=admin,dc=docker,dc=localhost` / `admin`
- **Anonymous access**: Fully readable without authentication
- **Custom schema**: `workplaceFqdn` attribute for workplace users

## Directory Structure

```
.compose/ldap/
├── bootstrap/
│   ├── 01-custom-schema.ldif    # Custom workplaceFqdn schema definition
│   ├── 02-base-structure.ldif   # Base DN, organizational units, groups
│   └── 03-users.ldif             # All test users (60+)
└── README.md                     # This file
```

## Bootstrap Files

The osixia/openldap image automatically loads LDIF files from the bootstrap directory **in alphabetical order**. This is why files are numbered:

1. **01-custom-schema.ldif** - Defines custom LDAP schema
   - `workplaceFqdn` attribute: Stores workplace FQDN
   - `workplaceUser` objectClass: Auxiliary class for users with workplace

2. **02-base-structure.ldif** - Creates base structure
   - `ou=users` organizational unit
   - `cn=readers` group

3. **03-users.ldif** - Loads all test users
   - 60+ users with Star Wars and generic names
   - Passwords match usernames (e.g., dwho/dwho)
   - Plain text passwords (osixia auto-hashes them)

## Configuration

LDAP server configuration is managed via environment variables in `docker-compose.yml`:

```yaml
environment:
  LDAP_ORGANISATION: "Docker"           # Organization name (o=Docker)
  LDAP_DOMAIN: "docker.internal"      # Domain (becomes dc=docker,dc=localhost)
  LDAP_ADMIN_PASSWORD: "admin"         # Admin password
  LDAP_CONFIG_PASSWORD: "config"       # Config password
  LDAP_READONLY_USER: "false"          # No read-only user
  LDAP_RFC2307BIS_SCHEMA: "false"      # Use standard schema
  LDAP_BACKEND: "mdb"                  # Use MDB backend (default)
  LDAP_TLS: "false"                    # Disable TLS for development
  LDAP_LOG_LEVEL: "256"                # Log level (256 = stats)
```

## Usage

### Starting LDAP Server

```bash
# Start LDAP server alone
docker-compose up ldap

# Start in background
docker-compose up -d ldap
```

### Inspecting LDAP Data

```bash
# List all entries
docker exec -it ldap ldapsearch -x -b "dc=docker,dc=localhost" -LLL

# Search for specific user
docker exec -it ldap ldapsearch -x -b "dc=docker,dc=localhost" "(uid=dwho)" -LLL

# Count total users
docker exec -it ldap ldapsearch -x -b "ou=users,dc=docker,dc=localhost" "(objectClass=inetOrgPerson)" dn | grep "^dn:" | wc -l

# Search by custom attribute (workplaceFqdn)
docker exec -it ldap ldapsearch -x -b "dc=docker,dc=localhost" "(workplaceFqdn=*)" workplaceFqdn -LLL

# List all attributes for a user
docker exec -it ldap ldapsearch -x -b "dc=docker,dc=localhost" "(uid=dwho)" -LLL
```

### Testing Authentication

```bash
# Bind as admin
docker exec -it ldap ldapsearch -x -D "cn=admin,dc=docker,dc=localhost" -w "admin" -b "dc=docker,dc=localhost" "(objectClass=*)"

# Bind as regular user
docker exec -it ldap ldapsearch -x -D "uid=dwho,ou=users,dc=docker,dc=localhost" -w "dwho" -b "dc=docker,dc=localhost" "(uid=dwho)"
```

### Connecting from Applications

Applications can connect to LDAP using these environment variables:

```bash
LDAP_URI=ldap://ldap:389
LDAP_BASE=ou=users,dc=docker,dc=localhost
LDAP_FILTER=(objectClass=inetOrgPerson)
# No LDAP_USER or LDAP_PASSWORD needed (anonymous read access)
```

## Test Users

The LDAP server includes 60+ test users:

### Star Wars Characters
- **dwho** - Dr Who (with mobile, workplaceFqdn: tardis.docker.internal)
- **rtyler** - Rose Tyler (with email, mobile, workplaceFqdn: badwolf.docker.internal)
- **okenobi** - Obi-Wan Kenobi (with workplaceFqdn: jedi-temple.docker.internal)
- **lskywalker** - Luke Skywalker (with workplaceFqdn: rebel-alliance.docker.internal)
- **myoda** - Master Yoda (with workplaceFqdn: jedi-council.docker.internal)
- And many more...

### Generic Users
- annasmith, johnjohnson, emilybrown, daviddavis, etc.
- Some with `workplaceFqdn` attribute

All users have:
- Password matching their uid (e.g., dwho/dwho)
- Email: `{uid}@docker.internal`
- Standard inetOrgPerson attributes

## Adding New Users

To add new users:

1. Edit `.compose/ldap/bootstrap/03-users.ldif`
2. Add user entry following the pattern:

```ldif
dn: uid=newuser,ou=users,dc=docker,dc=localhost
objectClass: inetOrgPerson
objectClass: workplaceUser                    # Optional, if workplaceFqdn needed
uid: newuser
cn: New User
sn: User
mail: newuser@docker.internal
workplaceFqdn: company.docker.internal       # Optional
userPassword: newuser                         # Plain text, will be auto-hashed
```

3. Restart LDAP container:

```bash
docker-compose down ldap
docker-compose up -d ldap
```

**Note**: Changes to bootstrap files only apply on **first startup**. To reload data:
```bash
docker-compose down ldap
docker volume prune -f  # Remove LDAP data volume
docker-compose up -d ldap
```

## Modifying Existing Users

To modify users after they're loaded:

```bash
# Create an LDIF file with modifications
cat > modify_user.ldif << EOF
dn: uid=dwho,ou=users,dc=docker,dc=localhost
changetype: modify
replace: mail
mail: newemail@docker.internal
EOF

# Apply modifications
docker exec -i ldap ldapmodify -x -D "cn=admin,dc=docker,dc=localhost" -w "admin" < modify_user.ldif
```

## Troubleshooting

### Check LDAP logs
```bash
docker logs ldap
```

### Verify LDAP is running
```bash
docker exec -it ldap slapcat
```

### Test connectivity
```bash
# From host
ldapsearch -x -H ldap://localhost:389 -b "dc=docker,dc=localhost"

# From another container (if on same network)
ldapsearch -x -H ldap://ldap:389 -b "dc=docker,dc=localhost"
```

### Reset LDAP data
```bash
docker-compose down ldap
docker volume prune -f
docker-compose up -d ldap
```

## Custom Schema Details

The custom schema defines:

### Attribute: workplaceFqdn
- **OID**: 1.3.6.1.4.1.99999.1.1.1
- **Type**: String (IA5String - ASCII)
- **Usage**: Stores fully qualified domain name of user's workplace
- **Example**: `tardis.docker.internal`

### ObjectClass: workplaceUser
- **OID**: 1.3.6.1.4.1.99999.2.1.1
- **Type**: AUXILIARY (can be added to existing objectClasses)
- **Attributes**: MAY workplaceFqdn

## Migration from Previous Setup

This setup replaces the previous custom Dockerfile approach:

### What Changed
- ✅ No more custom Dockerfile
- ✅ No more startup scripts
- ✅ No more separate password update step
- ✅ Configuration via environment variables
- ✅ Simpler LDIF structure

### What Stayed the Same
- ✅ Same base DN: `dc=docker,dc=localhost`
- ✅ Same users with same passwords
- ✅ Same custom `workplaceFqdn` schema
- ✅ Same anonymous read access
- ✅ Application connection strings unchanged

## References

- [osixia/docker-openldap GitHub](https://github.com/osixia/docker-openldap)
- [osixia/openldap Docker Hub](https://hub.docker.com/r/osixia/openldap/)
- [OpenLDAP Documentation](https://www.openldap.org/doc/)
- [LDIF Format Specification](https://tools.ietf.org/html/rfc2849)
