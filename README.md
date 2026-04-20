# Twake-Chat Matrix extension server

<br />
<div align="center">
  <a href="https://github.com/linagora/twake-on-matrix">
    <img src="https://github.com/artembru/ToM-server/assets/146178981/4a5da817-466f-4d4a-8804-3881b672bc42">
  </a>

  <p align="center">
    <a href="https://twake-chat.com">Website</a>
    •
    <a href="https://beta.twake.app/web/#/rooms">View Demo</a>
    •
    <a href="https://github.com/linagora/twake-on-matrix/issues">Report Bug</a>
    •
    <a href="https://hosted.weblate.org/projects/linagora/twake-matrix/#repository">Translate Twake</a>
  </p>
</div>

---

**ToM server** is a [Matrix Identity Server](https://spec.matrix.org/latest/identity-service-api/) that strictly implements and extends the Matrix Identity Service spec:

- inside an organization, it adds search APIs for autocompletion of internal users
- it extends identity lookup responses to include inactive users
- it implements the [federated identity mechanism](https://github.com/matrix-org/matrix-spec-proposals/pull/4004) to join multiple identity services for broader search

Other cross-concern integrations between Twake Workplace and a Matrix deployment (Synapse + ToM) are developed as standalone **application services** in `packages/`. For example, [`@twake/common-settings-bridge`](./packages/common-settings-bridge) synchronises user profile updates from Twake Workplace to Synapse via RabbitMQ and the Matrix Application Service protocol.

## Structure

This is an **Nx monorepo**:

- `apps/` — launchable server applications
  - `apps/tom-server` — the unified ToM server entrypoint (active development)
- `packages/` — application services and shared libraries
  - `packages/common-settings-bridge` — bridges Twake Workplace profile updates to Synapse

> **Note:** The legacy packages (`packages/tom-server`, `packages/matrix-identity-server`, `packages/federated-identity-service`, `packages/logger`, `packages/config-parser`, `packages/utils`) are deprecated. Their functionality is being reimplemented incrementally in `apps/tom-server`.

## Requirements

- Node >= 24
- Docker (for the full-stack compose environment)

## Quick Start

### 1. Start the full-stack environment

```bash
cp .env.example .env
docker compose up -d
```

This starts Synapse, PostgreSQL, Traefik, OpenLDAP, LemonLDAP::NG, and the Twake Chat frontend. Matrix identity requests are routed to the local tom-server process.

### 2. Start the server(s)

The repository ships two ready-to-use configs under `examples/config/` with working values for the Docker Compose environment:

```bash
# Standard ToM server only
npx nx serve tom-server --args="--config" --args="examples/config/tom.yaml"

# With a federated identity service (two terminals)
npx nx serve tom-server --args="--config" --args="examples/config/tom.yaml"     # Terminal 1
npx nx serve tom-server --args="--config" --args="examples/config/fed.yaml"     # Terminal 2
```

With the Docker Compose setup, Traefik routes requests accordingly:

- `tom.docker.internal` → standard tom-server on port 3000
- `fed.docker.internal` → federated identity service on port 3001

Code changes trigger automatic rebuilds and restarts.

To stop all services:

```bash
docker compose down --volumes
```

## Commands

```bash
# Install dependencies
npm install

# Build
npx nx build tom-server

# Run tests
npx nx test tom-server

# Serve with auto-reload
npx nx serve tom-server # loads system config + local .tomconfig.yaml
npx nx serve tom-server --args="--config" --args="path/to/config.yaml" # loads as above + path/to/config.yaml file as final precedence
```

## Configuration

Configuration is loaded from YAML files (format validated with Zod). The config loader searches for `twake/chat/tom/config.yaml` in the following base directories, in order, with each file's values overriding the previous:

| Priority    | Linux                                          | Windows                                     |
| ----------- | ---------------------------------------------- | ------------------------------------------- |
| 1 (lowest)  | `/etc`                                         | `%PROGRAMDATA%` (default: `C:\ProgramData`) |
| 2           | `/usr/local/etc`                               | `%APPDATA%` (default: `AppData\Roaming`)    |
| 3           | `$XDG_CONFIG_HOME` (default: `~/.config`)      | `%LOCALAPPDATA%` (default: `AppData\Local`) |
| 4           | `.tomconfig.yaml` in current working directory | ← same                                      |
| 5 (highest) | `--config /path/to/config.yaml` flag           | ← same                                      |

Each file found is merged on top of the previous, so only the fields present in a file are overridden. For example, if `/etc/twake/chat/tom/config.yaml` sets `server_name: "foo"` and a later file sets `server_name: "bar"`, the result is `"bar"`.

### Example configs

`examples/config/tom.yaml` and `examples/config/fed.yaml` are pre-filled with working values for the Docker Compose environment and are the recommended starting point for local development. For production deployments, use them as a reference alongside `.tomconfig.example.yaml`, which documents every available option.

### Key configuration sections

| Section      | Purpose                                                 |
| ------------ | ------------------------------------------------------- |
| `server`     | Matrix domain, host/port, rate limiting, proxy settings |
| `synapse`    | Homeserver URL, admin credentials, database connection  |
| `database`   | ToM's own PostgreSQL connection                         |
| `ldap`       | User directory (optional)                               |
| `email`      | SMTP settings for invitations and 3PID verification     |
| `features`   | Feature flags (user directory, common settings, etc.)   |
| `federation` | Federation mode settings (see below)                    |

### Running ToM as a federated identity service

To run a ToM instance as a federated identity service, the only required difference from a standard configuration is the `federation` block:

```yaml
federation:
  is_federated_identity_service: true
  trusted_servers_addresses:
    - "172.16.0.0/12" # Docker internal networks
    - "10.0.0.0/8" # Private networks
    - "127.0.0.1/8" # Loopback
```

All other sections (`server`, `synapse`, `database`, etc.) work identically in both modes. Make sure the federated instance uses a different port than the standard server (`server.port` in the config).

## Assets

- `assets/templates/` — mail and SMS templates
- `i18n/` — internationalisation translations
- `static/` — server landing page

## Docker Image

The published Docker image remains `linagora/tom-server`.

> **Deprecated:** `linagora/tom-federated-identity-service` will no longer be updated. Federation is now handled directly by `linagora/tom-server`.

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](./LICENSE)
