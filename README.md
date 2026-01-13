# TwakeChat

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
- it implements also the [federated identity mechanism](https://github.com/matrix-org/matrix-spec-proposals/pull/4004) that extend the
  [Matrix Identity Service](https://spec.matrix.org/latest/identity-service-api/) to join Matrix identity services to provide a better search

Here is the architecture principle:

![architecture principle](./docs/arch.png)

REST API Endpoints documentation is available on https://linagora.github.io/ToM-server/

## Try it yourself

- [Running our Dockers](./docker.md)
- [Deploy locally with compose](./docker.md#docker-compose)

## Modules

- [@twake-chat/matrix-identity-server](./packages/matrix-identity-server):
  [Matrix Identity Service](https://spec.matrix.org/v1.6/identity-service-api/) implementation for Node.js
- [@twake-chat/server](./packages/tom-server): the main Twake Chat Server, extends [@twake-chat/matrix-identity-server](./packages/matrix-identity-server)
- [@twake-chat/federated-identity-service](./packages/federated-identity-service): Twake Federated Identity Service
- [@twake-chat/config-parser](./packages/config-parser): simple file parser that uses also environment variables
- [@twake-chat/crypto](./packages/crypto): cryptographic methods for Twake Chat
- [@twake-chat/logger](./packages/logger): logger for Twake
- [@twake-chat/utils](.packages/utils): utilitary methods for Twake Chat
- [matrix-resolve](./packages/matrix-resolve): resolve a Matrix "server name" into base URL following
  [Matrix specification](https://spec.matrix.org/latest/server-server-api/#server-discovery)

## Requirements

- [ ] Node >=18

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](./LICENSE)

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

✨ Your new, shiny [Nx workspace](https://nx.dev) is almost ready ✨.

[Learn more about this workspace setup and its capabilities](https://nx.dev/nx-api/node?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or run `npx nx graph` to visually explore what was created. Now, let's get you up to speed!

## Run tasks

To run the dev server for your app, use:

```sh
npx nx serve tom-server
```

To create a production bundle:

```sh
npx nx build tom-server
```

To see all available targets to run for a project, run:

```sh
npx nx show project tom-server
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
