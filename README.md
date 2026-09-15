# ToM-Server

## A Twake Workplace Matrix Identity Server with augmented capacities

The `tom-server` (Twake-on-Matrix Server) is a Matrix Identity Server implementing
the [matrix-identity-api](https://github.com/nicegram/matrix-identity-api) specification,
with additional routes dedicated to Twake Workplace. It provides identity management
capabilities for the Twake ecosystem, handling user identity operations over the
Matrix protocol.

> [!NOTE]
> This is a reboot of the legacy repo:
> [ToM-Server-archive](https://github.com/linagora/ToM-Server-archive)

## Table of Contents

- [About the Project](#about-the-project)
- [Getting Started](#getting-started)
  - [Installation](#installation)
  - [Development](#development)
- [Configuration](#configuration)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

## About the Project

ToM Server acts as the identity layer for the Twake Workplace ecosystem. It
implements the matrix-identity-api specification and adds custom routes tailored
to Twake's needs, providing a unified identity service for Matrix-based
communication.

### Key Features

- **Matrix Identity API**: Full implementation of the matrix-identity-api
  specification for identity management operations.
- **Twake-dedicated Routes**: Additional API endpoints specifically designed
  for Twake Workplace integration.
- **Identity Management**: Handles user identity operations across the Matrix
  homeserver.

## Getting Started

This repository uses [Devenv](https://devenv.sh) to provide a unified,
standardized and full featured environments for developers.
We highly recommend you to get a look at it.
[https://devenv.sh](https://devenv.sh)

### Installation

Making sure everything is set up so a developer can contribute is handled
entirely by [Devenv](https://devenv.sh): once installed, it provisions the
toolchain (bun, PostgreSQL, RabbitMQ, Synapse, Caddy, mkcert) and wires them
together. There is no manual prerequisite to install.

```bash
# Clone the repository:
git clone https://github.com/linagora/tom-server.git

# Navigate to the project directory:
cd tom-server

# Enable the development environment (all tools are now on PATH):
devenv shell # or `devenv allow` for automatic shell setup on directory enter.

# Install dependencies:
bun install
```

### Development

Inside the development shell, spin up the local stack:

```bash
# Trust the local mkcert root CA so Chrome and Firefox accept the TLS certs:
mkcert -install

# Start everything (Caddy, Synapse, RabbitMQ, Postgres and ToM Server).
# `sudo -v` caches sudo so mkcert can store its root CA:
sudo -v && devenv up
```

`devenv up` starts all required services, including the ToM Server itself
running as an auto-reloading (`bun dev`, watch mode) process.

Once running, the local services are available at:

- **Caddy**: `https://twake.internal:8443`
- **Synapse**: `https://matrix.twake.internal:8443`
- **RabbitMQ**: `127.0.0.1:5672`
- **Postgres**: `127.0.0.1:5432`
- **ToM Server**: `bun dev` (watch mode) under `devenv up`

## Configuration

ToM Server is configured via a YAML file. Copy the annotated example and edit
it:

```bash
cp .tomconfig.example.yaml .tomconfig.yaml
```

See **[Configuration Reference](./docs/Configuration.md)** for the full list of
options (server, databases, email, LDAP, federation, telemetry, etc.).

## Documentation

Detailed information lives in the [`docs/`](./docs/README.md) folder:

- **[Docker](./docs/Docker.md)** - how to build and run the ToM Server as a Docker image.
- **[Release](./docs/Release.md)** - branch naming and the release process.
- **[Configuration](./docs/Configuration.md)** - complete reference for every
  `.tomconfig` option.

## Contributing

Contributions are what make the open source community such an amazing place to
learn, inspire, and create. Any contributions you make are **greatly
appreciated**.

Please read our [Contributing Guidelines](./CONTRIBUTING.md) to learn about our
development process, how to propose bugfixes and improvements, and how to
submit Merge Requests.

### Contributors

Huge shout-out to all our participants!

- [@Yadd](https://github.com/guimard)
- [@Khaled Ferjani](https://github.com/rezk2ll)
- [@Montassar Ghanmy](https://github.com/MontaGhanmy)
- [@Anton Shepilov](https://github.com/shepilov)

#### Maintainers

- Pierre 'McFly' Marty <pmarty@linagora.com>

## Support

If you encounter any problems or have questions, please file an issue on our
[GitHub Issue Tracker](https://github.com/linagora/tom-server/issues).

## License

This project is licensed under the GNU Affero General Public License v3.0 or
later (AGPL-3.0-or-later) - see the [LICENSE](./LICENSE) file for details.

<!-- vim: set ft=markdown fenc=utf-8 spell spl=en tw=80 cc=80 et ts=2: -->
