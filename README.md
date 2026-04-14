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
    <a href="https://hosted.weblate.org/projects/linagora/twake-matrix/#repository">Translate Twake></a>
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

### 1. Copy configuration files

```bash
cp .env.example .env
cp .tomconfig.example.yaml .tomconfig.yaml
```

Edit `.tomconfig.yaml` to set your Matrix domain, database credentials, and other required fields. The `.env` file is reserved for Node-level variables (TLS settings, etc.) and rarely needs changes.

### 2. Start the full-stack environment

```bash
docker compose up -d
```

This starts Synapse, PostgreSQL, Traefik, OpenLDAP, LemonLDAP::NG, a federation server, and the Twake Chat frontend. Matrix identity requests are routed to the local tom-server process.

### 3. Start the server

```bash
npx nx serve tom-server
```

The server will be available at the URL configured in `.tomconfig.yaml` (default: `http://localhost:3000`). Code changes trigger automatic rebuilds and restarts.

To stop services:

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
npx nx serve tom-server
```

## Configuration

Configuration is loaded from `.tomconfig.yaml` (YAML format, validated with Zod). Copy `.tomconfig.example.yaml` to get started — required fields are marked `[REQUIRED]`.

Key sections:

| Section      | Purpose                                                 |
| ------------ | ------------------------------------------------------- |
| `server`     | Matrix domain, host/port, rate limiting, proxy settings |
| `synapse`    | Homeserver URL, admin credentials, database connection  |
| `database`   | ToM's own PostgreSQL connection                         |
| `ldap`       | User directory (optional)                               |
| `email`      | SMTP settings for invitations and 3PID verification     |
| `federation` | Cross-server federated identity (optional)              |
| `features`   | Feature flags (user directory, common settings, etc.)   |
| `logger`     | Log level and formatting                                |

See `.tomconfig.example.yaml` for the full reference with all available options.

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
