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

- first, **Tom** is a [Matrix Identity Server](https://spec.matrix.org/latest/identity-service-api/) but with additional features:
  - inside an organization, it adds some search APIs that allows to find internal users like do the mail clients, for autocompletion for example
  - it extends also [Matrix Identity Service](https://spec.matrix.org/latest/identity-service-api/) search responses by adding inactive users
- it provide also an "application service" that allows administrator to create channels with automatic join
- it implements also the [federated identity mechanism](https://github.com/matrix-org/matrix-spec-proposals/pull/4004) that extend the [Matrix Identity Service](https://spec.matrix.org/latest/identity-service-api/) to join Matrix identity services to provide a better search

Here is the architecture principle:

![architecture principle](./docs/arch.png)

REST API Endpoints documentation is available on https://linagora.github.io/ToM-server/

## Try it yourself

- [Running our Dockers](./docker.md)
- [Deploy locally with compose](./docker.md#docker-compose)

## Modules

* [@twake/matrix-identity-server](./packages/matrix-identity-server):
  [Matrix Identity Service](https://spec.matrix.org/v1.6/identity-service-api/) implementation for Node.js
* [@twake/server](./packages/tom-server): the main Twake Chat Server, extends [@twake/matrix-identity-server](./packages/matrix-identity-server)
* [@twake/federated-identity-service](./packages/federated-identity-service): Twake Federated Identity Service
* [@twake/config-parser](./packages/config-parser): simple file parser that uses also environment variables
* [@twake/crypto](./packages/crypto): cryptographic methods for Twake Chat
* [@twake/logger](./packages/logger): logger for Twake
* [@twake/utils](.packages/utils): utilitary methods for Twake Chat
* [matrix-resolve](./packages/matrix-resolve): resolve a Matrix "server name" into base URL following
  [Matrix specification](https://spec.matrix.org/latest/server-server-api/#server-discovery)

## Requirements

- [ ] Node >=18

## Commands

- `npm run build`: build all packages
- `npm run test`: test all packages
- `node ./server.mjs`: run the server

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

This runs all necessary backend services in the background. To stop them later:

```bash
docker compose -f .compose/examples/dev.pgsql+ldap.yml down
```

### 3. Run the development environment

Start the local dev environment (watchers + server auto-reload):

```bash
npm run dev
```

This will:

- Watch and rebuild all packages automatically (`lerna run watch`)
- Launch the backend server via `nodemon`
- Load environment variables from `.env` automatically

### 4. Access and debug

Once started:

- The server should be running at the URL printed in the console (e.g. `http://localhost:3000`)
- Any code changes in `packages/` will trigger automatic rebuilds and server restarts

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](./LICENSE)

## Run tasks

To run the dev server for your app, use:

```sh
npx nx serve ToM-Server
```

To create a production bundle:

```sh
npx nx build ToM-Server
```

To see all available targets to run for a project, run:

```sh
npx nx show project ToM-Server
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

Use the plugin's generator to create new projects.

To generate a new application, use:

```sh
npx nx g @nx/node:app demo
```

To generate a new library, use:

```sh
npx nx g @nx/node:lib mylib
```

You can use `npx nx list` to get a list of installed plugins. Then, run `npx nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

[Learn more about Nx plugins &raquo;](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) | [Browse the plugin registry &raquo;](https://nx.dev/plugin-registry?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/nx-api/node?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:

- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
