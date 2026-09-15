# Docker

## Quick Start

Pull and run the ToM Server with a configuration file:

```bash
docker pull linagora/tom-server:latest

docker run -d \
  --name tom-server \
  -v /path/to/config.yaml:/data/config.yaml:ro \
  -p 3000:3000 \
  linagora/tom-server:latest
```

## Configuration

Create a configuration file based on the [example configuration](../.tomconfig.example.yaml):

```bash
cp .tomconfig.example.yaml config.yaml
```

Edit `config.yaml` with your settings. The minimum required fields are:

- `server.name` — Your Matrix domain
- `synapse.server_url` — Public URL of your homeserver
- `synapse.admin.login` / `synapse.admin.password` — Synapse admin credentials
- `synapse.database.*` — Synapse database connection
- `database.*` — ToM database connection
- `email.smtp_host` — SMTP server for emails

## Environment Variables

The server reads configuration from the YAML file only. Environment variables are not used.

## Volumes

| Container Path      | Description                                |
|---------------------|--------------------------------------------|
| `/data/config.yaml` | Configuration file (read-only recommended) |

Static assets, i18n files, and templates are baked into the image at `/usr/share/twake/chat/tom/`.

## Ports

The container exposes port `3000` by default (configurable via `server.port` in the config file).

## Health Check

The server does not provide a dedicated health endpoint by default. Use the root `/` path or configure a reverse proxy health check.

## Docker Compose

```yaml
services:
  tom-server:
    image: linagora/tom-server:latest
    ports:
      - "3000:3000"
    volumes:
      - ./config.yaml:/data/config.yaml:ro
    restart: unless-stopped
```

## Building Locally

```bash
docker build -t tom-server .
docker run -v ./config.yaml:/data/config.yaml:ro --rm tom-server
```

<!-- vim: set ft=markdown fenc=utf-8 spell spl=en tw=80 cc=80 et ts=2: -->
