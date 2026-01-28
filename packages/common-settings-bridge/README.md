# @twake/common-settings-bridge

Standalone service that bridges user profile updates from RabbitMQ to Synapse homeserver using the Matrix Application Service Protocol.

## Architecture

```
RabbitMQ → CommonSettingsBridge → Synapse (via AS Protocol)
```

## Features

- Consumes user profile update messages from RabbitMQ
- Updates Synapse user profiles directly via Application Service intent API
- Delta detection to prevent redundant updates
- SQLite or PostgreSQL persistence

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| RABBITMQ_HOST | RabbitMQ hostname | localhost |
| RABBITMQ_PORT | RabbitMQ port | 5672 |
| RABBITMQ_USERNAME | RabbitMQ username | guest |
| RABBITMQ_PASSWORD | RabbitMQ password | guest |
| RABBITMQ_VHOST | RabbitMQ virtual host | / |
| SYNAPSE_URL | Synapse homeserver URL | http://localhost:8008 |
| SYNAPSE_DOMAIN | Synapse server name | localhost |
| REGISTRATION_PATH | Path to registration.yaml | ./registration.yaml |
| DATABASE_ENGINE | sqlite or pg | sqlite |
| DATABASE_HOST | DB path (sqlite) or host (pg) | ./data/settings.db |
| QUEUE_NAME | RabbitMQ queue name | common-settings |
| EXCHANGE_NAME | RabbitMQ exchange name | common-settings-exchange |
| ROUTING_KEY | RabbitMQ routing key | profile.update |
| SYNAPSE_ADMIN_API_MODE | Synapse Admin connection mode: 'disabled', 'fallback' or 'exclusive' | disabled |

### Synapse Setup

1. Copy `registration.yaml.example` to `registration.yaml`
2. Generate secure tokens for `as_token` and `hs_token`
3. Add registration file to Synapse's `app_service_config_files` in homeserver.yaml
4. Restart Synapse

## Running

```bash
# Development
npm run build
npm start

# Docker
docker build -t common-settings-bridge .
docker run -v ./registration.yaml:/app/registration.yaml common-settings-bridge
```

## License

AGPL-3.0-or-later
