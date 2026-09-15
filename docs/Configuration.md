# Configuration

ToM Server is configured through a YAML file (`.tomconfig.yaml` or
`.tomconfig.yml`). A full annotated example is provided at
[`.tomconfig.example.yaml`](../.tomconfig.example.yaml).

Copy the example to the project root and edit it:

```bash
cp .tomconfig.example.yaml .tomconfig.yaml
```

Required fields are marked **[REQUIRED]** and use `<PLACEHOLDER>` values.
Optional fields are commented out with their defaults shown.

---

## Table of Contents

- [Server](#server)
- [URLs](#urls)
- [Synapse](#synapse)
- [ToM Database](#tom-database)
- [Hash Lookups](#hash-lookups)
- [Invitations](#invitations)
- [Terms of Service](#terms-of-service)
- [Email (SMTP)](#email-smtp)
- [LDAP](#ldap)
- [Cache](#cache)
- [SMS](#sms)
- [Federation](#federation)
- [Jitsi](#jitsi)
- [OIDC](#oidc)
- [Twake Chat](#twake-chat)
- [Features](#features)
- [Logging](#logging)
- [Internationalisation](#internationalisation)
- [Landing Page](#landing-page)
- [Matrix Client Discovery (Well-Known)](#matrix-client-discovery-well-known)
- [Telemetry (OpenTelemetry)](#telemetry-opentelemetry)

---

## Server

Top-level `server` block.

```yaml
server:
  name: "<YOUR_MATRIX_DOMAIN>"
```

| Field                    Required    Default      Description                                                                              |
| -----------------------  ----------  -----------  ---------------------------------------------------------------------------------------- |
| `name`                   **Yes**         —            Matrix domain used in MXIDs (`@user:example.com`).                                       |
| `base_url`               No          `""`         Public-facing URL of this identity server. Used in email templates and invitation links. |
| `host`                   No          `"0.0.0.0"`  Bind address for the HTTP server.                                                        |
| `port`                   No          `3000`       Listen port.                                                                             |
| `trust_x_forwarded_for`  No          `false`      Enable when behind a reverse proxy.                                                      |
| `trusted_proxies`        No          `[]`         List of trusted proxy IPs.                                                               |
| `additional_features`    No          `false`      Enable extra company features.                                                           |
| `enable_cron_jobs`       No          `false`      Master switch for all scheduled background jobs.                                         |

### Rate Limiting

```yaml
server:
  rate_limiting:
    window_ms: 60000
    max_requests: 100
```

| Field           Default    Description                                   |
| --------------  ---------  --------------------------------------------- |
| `window_ms`     `60000`    Rate-limit window in milliseconds (1 minute). |
| `max_requests`  `100`      Maximum requests per window.                  |

---

## URLs

External endpoints referenced in emails, QR codes, and redirects. All optional,
all default to `""`.

```yaml
urls:
  signup: ""
  chat: ""
  auth: ""
  qr_code: ""
  invitation_redirect: ""
```

| Field                  Default    Description                                    |
| ---------------------  ---------  ---------------------------------------------- |
| `signup`               `""`       URL for the signup page.                       |
| `chat`                 `""`       URL for the chat application.                  |
| `auth`                 `""`       URL for the authentication page.               |
| `qr_code`              `""`       URL used in QR codes.                          |
| `invitation_redirect`  `""`       Redirect target after accepting an invitation. |

---

## Synapse

Homeserver integration. This block configures the connection to your Matrix
Synapse homeserver.

```yaml
synapse:
  server_url: "<https://matrix.example.com>"
  internal_host: "http://localhost:8008"
```

| Field            Required    Default                    Description                               |
| ---------------  ----------  -------------------------  ----------------------------------------- |
| `server_url`     **Yes**         —                          Public URL of the homeserver.             |
| `internal_host`  No          `"http://localhost:8008"`  Internal URL for Synapse admin API calls. |

### Admin Credentials

```yaml
synapse:
  admin:
    login: "<ADMIN_USER>"
    password: "<ADMIN_PASSWORD>"
    access_token: ""
```

| Field           Required    Default    Description                                              |
| --------------  ----------  ---------  -------------------------------------------------------- |
| `login`         **Yes**         —          Synapse admin username.                                  |
| `password`      **Yes**         —          Synapse admin password.                                  |
| `access_token`  No          `""`       Set if using token-based auth instead of login/password. |

### Synapse Database

Direct read access to the Synapse PostgreSQL database.

```yaml
synapse:
  database:
    host: "<SYNAPSE_DB_HOST>"
    name: "<SYNAPSE_DB_NAME>"
    user: "<SYNAPSE_DB_USER>"
    password: "<SYNAPSE_DB_PASSWORD>"
    ssl: false
    vacuum_delay: 3600
```

| Field           Required    Default    Description                             |
| --------------  ----------  ---------  --------------------------------------- |
| `host`          **Yes**         —          Database hostname.                      |
| `name`          **Yes**         —          Database name.                          |
| `user`          **Yes**         —          Database user.                          |
| `password`      **Yes**         —          Database password.                      |
| `ssl`           No          `false`    Enable SSL for the database connection. |
| `vacuum_delay`  No          `3600`     Seconds between vacuum operations.      |

---

## ToM Database

ToM Server's own database connection.

```yaml
database:
  host: "<TOM_DB_HOST>"
  name: "<TOM_DB_NAME>"
  user: "<TOM_DB_USER>"
  password: "<TOM_DB_PASSWORD>"
  ssl: false
  vacuum_delay: 3600
```

| Field           Required    Default    Description                             |
| --------------  ----------  ---------  --------------------------------------- |
| `host`          **Yes**         —          Database hostname.                      |
| `name`          **Yes**         —          Database name.                          |
| `user`          **Yes**         —          Database user.                          |
| `password`      **Yes**         —          Database password.                      |
| `ssl`           No          `false`    Enable SSL for the database connection. |
| `vacuum_delay`  No          `3600`     Seconds between vacuum operations.      |

---

## Hash Lookups

3PID-to-MXID pepper management. Controls the key rotation policy for privacy
preserving hash lookups.

```yaml
hash:
  rate_limit: 100
  key_delay: 3600
  keys_depth: 5
  pepper_cron: "0 0 * * *"
```

| Field          Default        Description                                                                      |
| -------------  -------------  -------------------------------------------------------------------------------- |
| `rate_limit`   `100`          Max hash lookup requests per rate window.                                        |
| `key_delay`    `3600`         Seconds before a new pepper key activates.                                       |
| `keys_depth`   `5`            Number of old pepper keys to retain.                                             |
| `pepper_cron`  `"0 0 * * *"`  Cron schedule for pepper key rotation. Requires `server.enable_cron_jobs: true`. |

---

## Invitations

```yaml
invitations:
  server_name: "matrix.to"
```

| Field          Default        Description                           |
| -------------  -------------  ------------------------------------- |
| `server_name`  `"matrix.to"`  Server name used in invitation links. |

---

## Terms of Service

Define policies per the Matrix specification. If omitted, no terms are served.

```yaml
terms:
  policies:
    privacy_policy:
      version: "1.0"
      en:
        name: "Privacy Policy"
        url: "https://example.com/privacy"
```

Each policy has a `version` and language-keyed entries (`en`, `fr`, etc.) with
`name` and `url`.

---

## Email (SMTP)

Required if sending verification emails or invitations.

```yaml
email:
  smtp_host: "<SMTP_HOST>"
  smtp_port: 587
  tls: true
  username: ""
  password: ""
  sender: ""
  sender_localpart: "twake"
  verify_certificate: true
  templates_dir: ""
  link_expiry: 3600
```

| Field                 Required    Default    Description                                                          |
| --------------------  ----------  ---------  -------------------------------------------------------------------- |
| `smtp_host`           **Yes**         —          SMTP server hostname.                                                |
| `smtp_port`           No          `587`      SMTP port.                                                           |
| `tls`                 No          `true`     Use TLS for the SMTP connection.                                     |
| `username`            No          `""`       SMTP username. Omit for unauthenticated SMTP.                        |
| `password`            No          `""`       SMTP password.                                                       |
| `sender`              No          `""`       From address for outgoing emails.                                    |
| `sender_localpart`    No          `"twake"`  Local part of the sender address.                                    |
| `verify_certificate`  No          `true`     Verify the SMTP server's TLS certificate.                            |
| `templates_dir`       No          `""`       Path to email templates. Resolved from platform share dirs if empty. |
| `link_expiry`         No          `3600`     Seconds before verification links expire.                            |

---

## LDAP

Optional directory integration. Entire section defaults to disabled.

```yaml
ldap:
  uri: "ldap://localhost:389"
  base: "dc=example,dc=com"
  user: ""
  password: ""
  filter: ""
  uid_field: "uid"
  sync_cron: "*/10 * * * *"
  client_options: {}
```

| Field             Default                   Description                                                            |
| ----------------  ------------------------  ---------------------------------------------------------------------- |
| `uri`             `"ldap://localhost:389"`  LDAP server URI.                                                       |
| `base`            `"dc=example,dc=com"`     Base DN for searches.                                                  |
| `user`            `""`                      Bind DN.                                                               |
| `password`        `""`                      Bind password.                                                         |
| `filter`          `""`                      LDAP search filter.                                                    |
| `uid_field`       `"uid"`                   Attribute used as the user identifier.                                 |
| `sync_cron`       `"*/10 * * * *"`          Cron schedule for LDAP sync. Requires `server.enable_cron_jobs: true`. |
| `client_options`  `{}`                      Raw `ldapts` client options.                                           |

---

## Cache

Defaults to in-memory caching.

```yaml
cache:
  engine: "memory"
  ttl: 3600
  redis_uri: "redis://localhost:6379"
```

| Field        Default                     Description                                                |
| -----------  --------------------------  ---------------------------------------------------------- |
| `engine`     `"memory"`                  Cache backend: `"memory"` or `"redis"`.                    |
| `ttl`        `3600`                      Cache entry lifetime in seconds.                           |
| `redis_uri`  `"redis://localhost:6379"`  Redis connection URI. **Required** when `engine` is `"redis"`. |

---

## SMS

Required only if using phone-based 3PID verification.

```yaml
sms:
  api_url: "https://api.octopush.com/v1/public"
  api_login: ""
  api_key: ""
```

| Field        Default                                 Description                |
| -----------  --------------------------------------  -------------------------- |
| `api_url`    `"https://api.octopush.com/v1/public"`  SMS provider API endpoint. |
| `api_login`  `""`                                    API login/username.        |
| `api_key`    `""`                                    API key.                   |

---

## Federation

Disabled by default. Set `is_federated_identity_service: true` to enable
federation mode.

```yaml
federation:
  is_federated_identity_service: false
  trusted_servers_addresses: []
  identity_services: []
  sync_cron: "*/10 * * * *"
```

| Field                            Default           Description                                                                  |
| -------------------------------  ----------------  ---------------------------------------------------------------------------- |
| `is_federated_identity_service`  `false`           Enable federation mode.                                                      |
| `trusted_servers_addresses`      `[]`              IP allowlist for trusted Matrix servers.                                     |
| `identity_services`              `[]`              List of peer identity services.                                              |
| `sync_cron`                      `"*/10 * * * *"`  Cron schedule for federation sync. Requires `server.enable_cron_jobs: true`. |

See also: [Federation](./Federation.md) for operational details.

---

## Jitsi

Optional video conferencing integration. Disabled by default.

```yaml
jitsi:
  base_url: ""
  use_jwt: false
  jwt_secret: ""
  jwt_issuer: ""
  jwt_algorithm: "HS256"
  preferred_domain: ""
```

| Field               Default    Description                             |
| ------------------  ---------  --------------------------------------- |
| `base_url`          `""`       Jitsi server base URL.                  |
| `use_jwt`           `false`    Enable JWT authentication.              |
| `jwt_secret`        `""`       JWT signing secret.                     |
| `jwt_issuer`        `""`       JWT issuer claim.                       |
| `jwt_algorithm`     `"HS256"`  JWT signing algorithm.                  |
| `preferred_domain`  `""`       Preferred Jitsi domain for conferences. |

---

## OIDC

Optional OpenID Connect integration.

```yaml
oidc:
  issuer: "https://sso.example.com"
```

| Field     Default                      Description      |
| --------  ---------------------------  ---------------- |
| `issuer`  `"https://sso.example.com"`  OIDC issuer URL. |

---

## Twake Chat

Client-facing environment configuration for the Twake Chat web application.
All fields have sensible defaults.

```yaml
twake_chat:
  application_name: "Twake Chat"
  application_welcome_message: ""
  privacy_url: ""
  render_html: true
  hide_redacted_events: false
  hide_unknown_events: true
  issue_id: ""
  registration_url: ""
  twake_workplace_homeserver: ""
  app_grid_dashboard_available: false
  platform: ""
  default_max_upload_avatar_size_in_bytes: ""
  dev_mode: false
  qr_code_download_url: ""
  enable_logs: false
  support_url: ""
  enable_invitations: false
```

| Field                                      Default         Description                                         |
| -----------------------------------------  --------------  --------------------------------------------------- |
| `application_name`                         `"Twake Chat"`  Display name of the application.                    |
| `application_welcome_message`              `""`            Welcome message shown to new users.                 |
| `privacy_url`                              `""`            Link to the privacy policy.                         |
| `render_html`                              `true`          Render HTML content in messages.                    |
| `hide_redacted_events`                     `false`         Hide events that have been redacted.                |
| `hide_unknown_events`                      `true`          Hide events with unknown types.                     |
| `issue_id`                                 `""`            Issue tracker identifier.                           |
| `registration_url`                         `""`            URL for the registration page.                      |
| `twake_workplace_homeserver`               `""`            Homeserver URL for Twake Workplace.                 |
| `app_grid_dashboard_available`             `false`         Show the app grid dashboard.                        |
| `platform`                                 `""`            Platform identifier.                                |
| `default_max_upload_avatar_size_in_bytes`  `""`            Max avatar upload size in bytes. No limit if empty. |
| `dev_mode`                                 `false`         Enable client development mode.                     |
| `qr_code_download_url`                     `""`            URL for QR code downloads.                          |
| `enable_logs`                              `false`         Enable client-side logging.                         |
| `support_url`                              `""`            Link to the support page.                           |
| `enable_invitations`                       `false`         Enable the invitations feature in the client.       |

---

## Features

Optional feature toggles. All disabled by default.

### Common Settings

```yaml
features:
  common_settings:
    enabled: false
    application_url: ""
```

| Field              Default    Description                       |
| -----------------  ---------  --------------------------------- |
| `enabled`          `false`    Enable the common settings panel. |
| `application_url`  `""`       URL for the settings application. |

### Matrix Profile Updates

```yaml
features:
  matrix_profile_updates_allowed: true
```

| Field                             Default    Description                   |
| --------------------------------  ---------  ----------------------------- |
| `matrix_profile_updates_allowed`  `true`     Allow Matrix profile updates. |

### User Profile

```yaml
features:
  user_profile:
    default_visibility_settings:
      visibility: "private"
      visible_fields: []
```

| Field             Default      Description                                             |
| ----------------  -----------  ------------------------------------------------------- |
| `visibility`      `"private"`  Default profile visibility (`"private"` or `"public"`). |
| `visible_fields`  `[]`         List of fields visible by default.                      |

### User Directory

```yaml
features:
  user_directory:
    enabled: false
```

| Field      Default    Description                |
| ---------  ---------  -------------------------- |
| `enabled`  `false`    Enable the user directory. |

### Create Room Proxy

```yaml
features:
  createroom_proxy:
    enabled: false
    on_failure:
      max_retries: 3
      nuke_room: true
    default_preset: "private_chat"
    encryption: "allowed"
    presets: []
```

| Field                     Default           Description                                                  |
| ------------------------  ----------------  ------------------------------------------------------------ |
| `enabled`                 `false`           Enable the room creation proxy.                              |
| `on_failure.max_retries`  `3`               Maximum retry attempts on failure.                           |
| `on_failure.nuke_room`    `true`            Delete the room on failure.                                  |
| `default_preset`          `"private_chat"`  Default room preset.                                         |
| `encryption`              `"allowed"`       Encryption mode: `"allowed"`, `"enforced"`, or `"disabled"`. |
| `presets`                 `[]`              Custom room presets.                                         |

---

## Logging

```yaml
logger:
  level: "info"
  pretty: false
```

| Field     Default    Description                                           |
| --------  ---------  ----------------------------------------------------- |
| `level`   `"info"`   Log level (`"debug"`, `"info"`, `"warn"`, `"error"`). |
| `pretty`  `false`    Pretty-print logs. Enable for local development only. |

---

## Internationalisation

```yaml
i18n:
  locale: "en"
  locales_path: "/usr/share/twake/chat/tom/i18n"
```

| Field           Default                             Description           |
| --------------  ----------------------------------  --------------------- |
| `locale`        `"en"`                              Default locale.       |
| `locales_path`  `"/usr/share/twake/chat/tom/i18n"`  Path to locale files. |

---

## Landing Page

Optional. If the file doesn't exist, the landing page route is not mounted.

```yaml
landing:
  file_path: "/usr/share/twake/chat/tom/landing.html"
```

| Field        Default                                     Description                         |
| -----------  ------------------------------------------  ----------------------------------- |
| `file_path`  `"/usr/share/twake/chat/tom/landing.html"`  Path to the landing page HTML file. |

---

## Matrix Client Discovery (Well-Known)

Disabled by default. Serves a `.well-known/matrix/client` endpoint for client
auto-discovery.

```yaml
well_known:
  client:
    enabled: true
    extra: {}
```

| Field      Default    Description                                                                                                                                                                                                                                                |
| ---------  ---------  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`  `false`    Enable the well-known client endpoint.                                                                                                                                                                                                                     |
| `extra`    `{}`       Extra entries shallow-merged into the document. Configured keys override these: `m.homeserver` (from `synapse.server_url`), `m.identity_server` (from `server.base_url`), `t.server` (from `server`), `m.federated_identity_services` (from `federation`). |

---

## Telemetry (OpenTelemetry)

Disabled by default.

```yaml
telemetry:
  enabled: false
  metrics_endpoint: "/metrics"
  otlp_endpoint: ""
  trace_sample_ratio: 1.0
  diag_log_level: "NONE"
```

| Field                 Default       Description                                          |
| --------------------  ------------  ---------------------------------------------------- |
| `enabled`             `false`       Enable OpenTelemetry instrumentation.                |
| `metrics_endpoint`    `"/metrics"`  HTTP path for Prometheus-style metrics scraping.     |
| `otlp_endpoint`       `""`          OTLP collector endpoint for push-based export.       |
| `trace_sample_ratio`  `1.0`         Fraction of traces to sample when enabled (0.0–1.0). |
| `diag_log_level`      `"NONE"`      OpenTelemetry diagnostic log level.                  |

<!-- vim: set ft=markdown fenc=utf-8 spell spl=en tw=80 cc=80 et ts=2: -->
