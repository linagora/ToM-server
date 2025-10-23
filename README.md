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

This repository is a multi-packages repository. See [Modules](#modules) for details.

**ToM server** enhances a [Matrix Synapse server](https://github.com/element-hq/synapse) with several features:
 * first, **Tom** is a [Matrix Identity Server](https://spec.matrix.org/latest/identity-service-api/) but with additional features:
   * inside an organization, it adds some search APIs that allows to find internal users like do the mail clients, for autocompletion for example
   * it extends also [Matrix Identity Service](https://spec.matrix.org/latest/identity-service-api/) search responses by adding inactive users
 * it provide also an "application service" that allows administrator to create channels with automatic join
 * it implements also the [federated identity mechanism](https://github.com/matrix-org/matrix-spec-proposals/pull/4004) that extend the
   [Matrix Identity Service](https://spec.matrix.org/latest/identity-service-api/) to join Matrix identity services to provide a better search

Here is the architecture principle:

![architecture principle](./docs/arch.png)

REST API Endpoints documentation is available on https://linagora.github.io/ToM-server/

## Try it yourself

- [Running our Dockers](./docker.md)
- [Deploy locally with compose](./docker.md#docker-compose)

## Modules

* [@twake/matrix-identity-server](./packages/matrix-identity-server):
  [Matrix Identity Service](https://spec.matrix.org/v1.6/identity-service-api/) implementation for Node.js
* [@twake/matrix-client-server](./packages/matrix-client-server/):
  [Matrix Client-Server](https://spec.matrix.org/v1.11/client-server-api/) implementation for Node.js
* [@twake/matrix-invite](./packages/matrix-invite): matrix invitation web application
* [@twake/server](./packages/tom-server): the main Twake Chat Server, extends [@twake/matrix-identity-server](./packages/matrix-identity-server)
* [@twake/federated-identity-service](./packages/federated-identity-service): Twake Federated Identity Service
* [@twake/config-parser](./packages/config-parser): simple file parser that uses also environment variables
* [@twake/crypto](./packages/crypto): cryptographic methods for Twake Chat
* [@twake/logger](./packages/logger): logger for Twake
* [@twake/utils](.packages/utils): utilitary methods for Twake Chat
* [@twake/matrix-application-server](./packages/matrix-application-server): implements
  [Matrix Application Service API](https://spec.matrix.org/v1.6/application-service-api/)
* [matrix-resolve](./packages/matrix-resolve): resolve a Matrix "server name" into base URL following
  [Matrix specification](https://spec.matrix.org/latest/server-server-api/#server-discovery)
* [@twake/retry-promise](packages/retry-promise): simple module extending javascript Promise with retry strategy

## Requirements

- [ ] Node >=18

## Commands

* `npm run build`: build all packages
* `npm run test`: test all packages
* `node ./server.mjs`: run the server

## Development Setup

Follow these steps to start the project in development mode:

### 1. Copy environment file

Create a local `.env` file based on the provided example:

```bash
cp .env.example .env
```

You can adjust any variables inside `.env` as needed (e.g., database credentials, API keys, etc.).

### 2. Start required services

Use the provided Docker Compose file to start the local dependencies (PostgreSQL, LDAP, etc.):

```bash
docker compose -f .compose/examples/dev.pgsql+ldap.yml up -d
```

This runs all necessary backend services in the background.
To stop them later:

```bash
docker compose -f .compose/examples/dev.pgsql+ldap.yml down
```

### 3. Run the development environment

Start the local dev environment (watchers + server auto-reload):

```bash
npm run dev
```

This will:

* Watch and rebuild all packages automatically (`lerna run watch`)
* Launch the backend server via `nodemon`
* Load environment variables from `.env` automatically

### 4. Access and debug

Once started:

* The server should be running at the URL printed in the console (e.g. `http://localhost:3000`)
* Any code changes in `packages/` will trigger automatic rebuilds and server restarts


## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](./LICENSE)
