# @twake/common-settings-bridge

Standalone service that bridges user profile updates from RabbitMQ to Synapse homeserver using the Matrix Application Service Protocol.

## Architecture

```
RabbitMQ → CommonSettingsBridge → Homeserver (via AS Protocol)
                                → Synapse (via Admin API - only synapse is supported)
```

## Features

- Consumes user profile update messages from RabbitMQ
- Updates Synapse user profiles directly via Application Service intent API
- Delta detection to prevent redundant updates
- Utilizes the CLI class from matrix-appservice-bridge for command-line interface
- SQLite or PostgreSQL persistence

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| REGISTRATION_FILE | Path to registration.yaml | ./registration.yaml |

### Configuration Files

#### config.yaml

The service requires a `config.yaml` file for RabbitMQ and database configuration. An example file is provided as `config.yaml.example`.

##### Admin API

The service has 3 modes for using the Synapse Admin API:

- `exclusive`: Only uses the Admin API for profile updates.
- `fallback`: First tries to use the Application Service API, and falls back to the Admin API if an issue occured.
- `disabled`: Never uses the Admin API.

To ensure the service can correctly use the Admin API, its underlying user must be registered as an admin in Synapse.

```sql
insert into public.users (name, admin)
values ('@cs-bot:docker.internal', 1);
```

#### registration.yaml

The service requires a `registration.yaml` file for the Application Service registration. An example file is provided as `registration.yaml.example`.

### Synapse Setup

1. Copy `registration.yaml.example` to `registration.yaml`
2. Generate secure tokens for `as_token` and `hs_token`
3. Add registration file to Synapse's `app_service_config_files` in homeserver.yaml
4. Restart Synapse
