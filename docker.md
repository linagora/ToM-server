# Serve Twake-on-Matrix as a Container

Docker images are published on Docker Hub:

- [ToM Server](https://hub.docker.com/r/linagora/tom-server)
- [Federated Identity Service](https://hub.docker.com/r/linagora/tom-federated-identity-service)
- [Matrix Identity Server](https://hub.docker.com/r/linagora/matrix-identity-server)

## Building Docker Images

The project uses Nx to build Docker images with multi-stage builds for optimized production images.

### Build Commands

```bash
# Build individual services
npx nx docker-build tom-server
npx nx docker-build federated-identity-service
npx nx docker-build matrix-identity-server
```

### Image Optimization

The Dockerfiles feature:

- Multi-stage builds to reduce final image size
- Non-root user for improved security
- Only production dependencies included
- Alpine-based Node.js images

## Configuration

Applications can be configured via:

1. **Environment variables** (recommended for containers)
2. **JSON config file** specified by environment variable
3. **Default config file** at `config.json` in project root

### Config File Environment Variables

| Variable                                | Description                                    |
| --------------------------------------- | ---------------------------------------------- |
| `TWAKE_SERVER_CONF`                     | Path to TOM Server config JSON                 |
| `TWAKE_IDENTITY_SERVER_CONF`            | Path to Matrix Identity Server config JSON     |
| `TWAKE_FEDERATED_IDENTITY_SERVICE_CONF` | Path to Federated Identity Service config JSON |

---

## Environment Variables

| Status       | Description                                  |
| ------------ | -------------------------------------------- |
| **required** | Server cannot start without                  |
| recommended  | Server can start without, but advised to use |
| _optional_   | Use to enable specific features              |

### Core Server

| Name                    | Description                                          | Default   | Status       |
| ----------------------- | ---------------------------------------------------- | --------- | ------------ |
| `BASE_URL`              | Public URL (e.g., `https://tom.example.com`)         | -         | **required** |
| `SERVER_NAME`           | Matrix server name (same as homeserver.yaml)         | localhost | **required** |
| `TRUSTED_PROXIES`       | Space-separated IPs allowed to set `X-Forwarded-For` | -         | _optional_   |
| `TRUST_X_FORWARDED_FOR` | Trust X-Forwarded-For header                         | false     | _optional_   |

### Database

| Name                    | Description                                | Default | Status              |
| ----------------------- | ------------------------------------------ | ------- | ------------------- |
| `DATABASE_ENGINE`       | Database type (`pg` or `sqlite`)           | -       | **required**        |
| `DATABASE_HOST`         | `pg`: hostname, `sqlite`: path to .db file | -       | **required**        |
| `DATABASE_NAME`         | Database name (pg only)                    | -       | **required** for pg |
| `DATABASE_USER`         | Database username (pg only)                | -       | **required** for pg |
| `DATABASE_PASSWORD`     | Database password (pg only)                | -       | **required** for pg |
| `DATABASE_SSL`          | SSL config as JSON (pg only)               | false   | _optional_          |
| `DATABASE_VACUUM_DELAY` | Vacuum delay in seconds                    | 3600    | _optional_          |

### User Database

| Name              | Description                               | Default    | Status     |
| ----------------- | ----------------------------------------- | ---------- | ---------- |
| `USERDB_ENGINE`   | User database engine (`ldap` or `sqlite`) | ldap       | _optional_ |
| `USERDB_HOST`     | User DB host or path                      | ./users.db | _optional_ |
| `USERDB_NAME`     | User DB name                              | -          | _optional_ |
| `USERDB_USER`     | User DB username                          | -          | _optional_ |
| `USERDB_PASSWORD` | User DB password                          | -          | _optional_ |
| `USERDB_SSL`      | User DB SSL config as JSON                | false      | _optional_ |

### LDAP

| Name             | Description                                        | Default                     | Status      |
| ---------------- | -------------------------------------------------- | --------------------------- | ----------- |
| `LDAP_URI`       | LDAP server URI (e.g., `ldaps://ldap.company.com`) | -                           | recommended |
| `LDAP_BASE`      | Base DN (e.g., `dc=example,dc=com`)                | -                           | recommended |
| `LDAP_USER`      | Full LDAP DN for binding                           | -                           | recommended |
| `LDAP_PASSWORD`  | LDAP bind password                                 | -                           | recommended |
| `LDAP_FILTER`    | Search filter                                      | (objectClass=inetOrgPerson) | recommended |
| `LDAP_UID_FIELD` | Field for user ID                                  | uid                         | _optional_  |

### Matrix

| Name                       | Description                            | Default       | Status       |
| -------------------------- | -------------------------------------- | ------------- | ------------ |
| `MATRIX_SERVER`            | Matrix homeserver URL                  | localhost     | **required** |
| `MATRIX_INTERNAL_HOST`     | Internal Matrix host for backend calls | MATRIX_SERVER | _optional_   |
| `MATRIX_ADMIN_LOGIN`       | Matrix admin username                  | admin         | _optional_   |
| `MATRIX_ADMIN_PASSWORD`    | Matrix admin password                  | change-me     | _optional_   |
| `ADMIN_ACCESS_TOKEN`       | Admin API access token                 | secret        | _optional_   |
| `MATRIX_DATABASE_ENGINE`   | Matrix DB type (`pg` or `sqlite`)      | -             | _optional_   |
| `MATRIX_DATABASE_HOST`     | Matrix DB host or path                 | -             | _optional_   |
| `MATRIX_DATABASE_NAME`     | Matrix DB name (pg only)               | -             | _optional_   |
| `MATRIX_DATABASE_USER`     | Matrix DB username (pg only)           | -             | _optional_   |
| `MATRIX_DATABASE_PASSWORD` | Matrix DB password (pg only)           | -             | _optional_   |
| `MATRIX_DATABASE_SSL`      | Matrix DB SSL config (pg only)         | false         | _optional_   |

### OIDC

| Name          | Description               | Default | Status       |
| ------------- | ------------------------- | ------- | ------------ |
| `OIDC_ISSUER` | OpenID Connect issuer URL | -       | **required** |

### RabbitMQ

| Name                | Description           | Default   | Status     |
| ------------------- | --------------------- | --------- | ---------- |
| `RABBITMQ_HOST`     | RabbitMQ host         | localhost | _optional_ |
| `RABBITMQ_PORT`     | RabbitMQ port         | 5672      | _optional_ |
| `RABBITMQ_VHOST`    | RabbitMQ virtual host | /         | _optional_ |
| `RABBITMQ_USER`     | RabbitMQ username     | guest     | _optional_ |
| `RABBITMQ_PASSWORD` | RabbitMQ password     | guest     | _optional_ |
| `RABBITMQ_TLS`      | Enable RabbitMQ TLS   | false     | _optional_ |

### SMTP

| Name                      | Description             | Default   | Status     |
| ------------------------- | ----------------------- | --------- | ---------- |
| `SMTP_SERVER`             | SMTP server host        | localhost | _optional_ |
| `SMTP_PORT`               | SMTP server port        | 25        | _optional_ |
| `SMTP_USER`               | SMTP username           | -         | _optional_ |
| `SMTP_PASSWORD`           | SMTP password           | -         | _optional_ |
| `SMTP_SENDER`             | From email address      | -         | _optional_ |
| `SMTP_TLS`                | Enable SMTP TLS         | false     | _optional_ |
| `SMTP_VERIFY_CERTIFICATE` | Verify SMTP certificate | false     | _optional_ |

### SMS

| Name            | Description      | Default | Status     |
| --------------- | ---------------- | ------- | ---------- |
| `SMS_API_URL`   | SMS API endpoint | -       | _optional_ |
| `SMS_API_LOGIN` | SMS API login    | -       | _optional_ |
| `SMS_API_KEY`   | SMS API key      | -       | _optional_ |

### Jitsi

| Name                     | Description               | Default | Status     |
| ------------------------ | ------------------------- | ------- | ---------- |
| `JITSI_BASE_URL`         | Jitsi instance URL        | -       | _optional_ |
| `JITSI_JWT_ALGORITHM`    | JWT signing algorithm     | HS256   | _optional_ |
| `JITSI_JWT_ISSUER`       | JWT issuer identifier     | -       | _optional_ |
| `JITSI_SECRET`           | Jitsi JWT secret          | -       | _optional_ |
| `JITSI_PREFERRED_DOMAIN` | Preferred Jitsi domain    | -       | _optional_ |
| `JITSI_USE_JWT`          | Enable JWT authentication | false   | _optional_ |

### Crowdsec

| Name           | Description                 | Default | Status     |
| -------------- | --------------------------- | ------- | ---------- |
| `CROWDSEC_URI` | Crowdsec API URI            | -       | _optional_ |
| `CROWDSEC_KEY` | Crowdsec authentication key | -       | _optional_ |

### Cache

| Name           | Description                     | Default | Status     |
| -------------- | ------------------------------- | ------- | ---------- |
| `CACHE_ENGINE` | Cache engine type (e.g., redis) | -       | _optional_ |
| `REDIS_URI`    | Redis connection URI            | -       | _optional_ |

### Rate Limiting

| Name                        | Description                     | Default | Status      |
| --------------------------- | ------------------------------- | ------- | ----------- |
| `RATE_LIMITING_WINDOW`      | Window duration in milliseconds | 600000  | recommended |
| `RATE_LIMITING_NB_REQUESTS` | Max requests per window         | 100     | recommended |
| `HASHES_RATE_LIMIT`         | Hash lookup rate limit          | 100     | _optional_  |

### Cron Jobs

| Name                                    | Description                          | Default         | Status     |
| --------------------------------------- | ------------------------------------ | --------------- | ---------- |
| `CRON_SERVICE`                          | Enable cron tasks                    | false           | _optional_ |
| `PEPPER_CRON`                           | Pepper update schedule (cron syntax) | 9 1 \* \* \*    | _optional_ |
| `UPDATE_USERS_CRON`                     | User data refresh schedule           | _/10 _ \* \* \* | _optional_ |
| `UPDATE_FEDERATED_IDENTITY_HASHES_CRON` | Federated hash update schedule       | _/10 _ \* \* \* | _optional_ |

### Federated Identity

| Name                          | Description                                      | Default | Status      |
| ----------------------------- | ------------------------------------------------ | ------- | ----------- |
| `FEDERATED_IDENTITY_SERVICES` | Comma/space-separated list of federation servers | -       | recommended |
| `TRUSTED_SERVERS_ADDRESSES`   | Trusted server IP addresses/networks             | -       | _optional_  |

### Feature Flags

| Name                                      | Description                    | Default | Status      |
| ----------------------------------------- | ------------------------------ | ------- | ----------- |
| `ADDITIONAL_FEATURES`                     | Enable all search features     | false   | recommended |
| `FEATURE_COMMON_SETTINGS_ENABLED`         | Enable common settings service | false   | _optional_  |
| `FEATURE_USER_PROFILE_DEFAULT_VISIBILITY` | Default profile visibility     | private | _optional_  |
| `FEATURE_USER_DIRECTORY_ENABLED`          | Enable user directory search   | false   | _optional_  |
| `FEATURE_MATRIX_PROFILE_UPDATES_ALLOWED`  | Allow Matrix profile updates   | false   | _optional_  |

### Twake Chat Client

| Name                                 | Description                    | Default | Status     |
| ------------------------------------ | ------------------------------ | ------- | ---------- |
| `TCHAT_ENABLE_INVITATIONS`           | Enable email invitations       | false   | _optional_ |
| `TCHAT_APPLICATION_NAME`             | Application display name       | -       | _optional_ |
| `TCHAT_APPLICATION_WELCOME_MESSAGE`  | Welcome message                | -       | _optional_ |
| `TCHAT_PRIVACY_URL`                  | Privacy policy URL             | -       | _optional_ |
| `TCHAT_REGISTRATION_URL`             | User registration URL          | -       | _optional_ |
| `TCHAT_SUPPORT_URL`                  | Support page URL               | -       | _optional_ |
| `TCHAT_SUPPORT_CONTACT`              | Support contact info           | -       | _optional_ |
| `TCHAT_QR_CODE_DOWNLOAD_URL`         | QR code app download URL       | -       | _optional_ |
| `TCHAT_DEV_MODE`                     | Enable development mode        | false   | _optional_ |
| `TCHAT_ENABLE_LOGS`                  | Enable client-side logging     | false   | _optional_ |
| `TCHAT_MAX_UPLOAD_AVATAR_SIZE`       | Max avatar upload size (bytes) | -       | _optional_ |
| `TCHAT_RENDER_HTML`                  | Render HTML in messages        | false   | _optional_ |
| `TCHAT_HIDE_REDACTED_EVENTS`         | Hide deleted messages          | false   | _optional_ |
| `TCHAT_HIDE_UNKNOWN_EVENTS`          | Hide unknown event types       | false   | _optional_ |
| `TCHAT_APP_GRID_DASHBOARD_AVAILABLE` | Enable app grid dashboard      | false   | _optional_ |
| `TCHAT_TWAKE_WORKPLACE_HOMESERVER`   | Twake workplace homeserver     | -       | _optional_ |
| `TCHAT_PLATFORM`                     | Platform identifier            | -       | _optional_ |

### URLs

| Name               | Description                | Default                             | Status     |
| ------------------ | -------------------------- | ----------------------------------- | ---------- |
| `QRCODE_URL`       | QR code login URL scheme   | twake.chat://login                  | _optional_ |
| `CHAT_URL`         | Chat application URL       | https://chat.twake.app              | _optional_ |
| `AUTH_URL`         | Authentication service URL | -                                   | _optional_ |
| `SIGNUP_URL`       | User signup URL            | https://sign-up.twake.app/?app=chat | _optional_ |
| `SENDER_LOCALPART` | Matrix sender localpart    | twake                               | _optional_ |

### Timing & Security

| Name              | Description                                | Default | Status     |
| ----------------- | ------------------------------------------ | ------- | ---------- |
| `KEY_DELAY`       | Key rotation delay (seconds)               | 3600    | _optional_ |
| `KEYS_DEPTH`      | Number of keys to maintain                 | 5       | _optional_ |
| `MAIL_LINK_DELAY` | Email verification link validity (seconds) | 7200    | _optional_ |

### Logging

| Name             | Description                                                | Default | Status     |
| ---------------- | ---------------------------------------------------------- | ------- | ---------- |
| `LOG_TRANSPORTS` | Log output destinations                                    | Console | _optional_ |
| `LOG_LEVEL`      | Log level (error, warn, info, http, verbose, debug, silly) | info    | _optional_ |

### Templates

| Name           | Description                    | Default                              | Status      |
| -------------- | ------------------------------ | ------------------------------------ | ----------- |
| `TEMPLATE_DIR` | Path to email templates folder | node_modules/@twake/server/templates | recommended |

---

## Running with Docker

Example deployment with PostgreSQL database, LDAP directory, and Matrix integration:

```bash
docker run -d -p 3000:3000 \
    -e BASE_URL=https://tom.example.com/ \
    -e SERVER_NAME=example.com \
    -e OIDC_ISSUER=https://auth.example.com/ \
    -e DATABASE_ENGINE=pg \
    -e DATABASE_HOST=pg-host.xyz \
    -e DATABASE_NAME=twake \
    -e DATABASE_USER=twake \
    -e DATABASE_PASSWORD=mydbpassword \
    -e DATABASE_SSL=true \
    -e LDAP_URI=ldap://ldap.example.com \
    -e LDAP_BASE=dc=example,dc=com \
    -e LDAP_FILTER="(objectClass=inetOrgPerson)" \
    -e MATRIX_SERVER=matrix.example.com \
    -e MATRIX_DATABASE_ENGINE=pg \
    -e MATRIX_DATABASE_HOST=synapse-db \
    -e MATRIX_DATABASE_NAME=synapse \
    -e MATRIX_DATABASE_USER=synapse \
    -e MATRIX_DATABASE_PASSWORD=synapse_password \
    -e ADDITIONAL_FEATURES=true \
    -e CRON_SERVICE=true \
    linagora/tom-server
```

---

## Docker Compose

Development environments are provided in `.compose/examples/`:

- [`pgsql.yml`](./.compose/examples/pgsql.yml) - PostgreSQL with persistent storage
- [`sqlite.yml`](./.compose/examples/sqlite.yml) - SQLite for quick testing
- [`sso.yml`](./.compose/examples/sso.yml) - SSO with LemonLDAP::NG (HTTPS)

### Architecture

Both environments include:

| Service                | Description                         | Port                 |
| ---------------------- | ----------------------------------- | -------------------- |
| **Traefik**            | Reverse proxy and routing           | 80, 8080 (dashboard) |
| **ToM Server**         | Twake-on-Matrix identity server     | 3000                 |
| **Synapse**            | Matrix homeserver                   | 8008                 |
| **OpenLDAP**           | User directory                      | 389                  |
| **SMTP**               | Development email server (Papercut) | 2525                 |
| **Federated Identity** | Federation service                  | 3000                 |

PostgreSQL variant additionally includes:

- **PostgreSQL** database for ToM and Synapse

### Prerequisites

#### `/etc/hosts`

Add these entries to your hosts file:

```
127.0.0.1 docker.internal
127.0.0.1 matrix.docker.internal
127.0.0.1 tom.docker.internal
127.0.0.1 fed.docker.internal
```

#### SSL Certificates (Optional)

For HTTPS support, generate certificates:

```bash
cd .compose/ssl/
mkcert -install
mkcert docker.internal *.docker.internal
cat docker.internal+1.pem docker.internal+1-key.pem > both.pem
```

### Running the Environments

#### PostgreSQL (Recommended)

```bash
# Start all services
docker compose -f .compose/examples/pgsql.yml up -d

# Rebuild after code changes
docker compose -f .compose/examples/pgsql.yml up -d --build
```

#### SQLite (Lightweight)

```bash
# Start all services
docker compose -f .compose/examples/sqlite.yml up -d

# Rebuild after code changes
docker compose -f .compose/examples/sqlite.yml up -d --build
```

### Accessing Services

| Service            | URL                           |
| ------------------ | ----------------------------- |
| ToM Server API     | http://tom.docker.internal    |
| Matrix Homeserver  | http://matrix.docker.internal |
| Federation Service | http://fed.docker.internal    |
| Traefik Dashboard  | http://localhost:8080         |

### Test Users

| Name       | Username | Password |
| ---------- | -------- | -------- |
| Doctor Who | dwho     | dwho     |
| Rose Tyler | rtyler   | rtyler   |

See [`.compose/ldap/README.md`](./.compose/ldap/README.md) for the full list of 60+ test users.

---

## Sending Invitations

With `TCHAT_ENABLE_INVITATIONS=true`, ToM can send email invitations:

```bash
curl -X POST 'https://tom.example.com/_twake/v1/invite' \
  -H 'Authorization: Bearer <access_token>' \
  -H 'Content-Type: application/json' \
  -d '{"contact":"invitee@example.com","medium":"email"}'
```
