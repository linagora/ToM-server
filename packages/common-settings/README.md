# @twake-chat/common-settings

The **Common Settings** module provides an integration layer between Twake Common Settings and ToM.  
It listens for user profile updates (e.g., display name, avatar) published to an AMQP queue and propagates these changes to Synapse using the **Admin Settings API**.

This ensures that updates to user information are automatically synchronized with the chat service.

## Configuration

The connector requires a JSON configuration file. Default values can be found in [`src/config.json`](./src/config.json).

### Required fields

```json
{
  "rabbitmq": {
    "host": "localhost",
    "port": 5672,
    "vhost": "/",
    "username": "guest",
    "password": "guest",
    "tls": false
  },
  "features": {
    "common_settings": {
      "enabled": true,
      "queue": "settings.queue",
      "exchange": "exchange.exchange",
      "deadLetterExchange": "settings.dead.letter.exchange",
      "deadLetterRoutingKey": "settings.dead.letter.routing.key",
      "api_url": "http://host.docker.internal:4000",
      "api_secret": "secret"
    },
    "matrix_profile_updates_allowed": false
  }
}
```

### Field descriptions

#### `rabbitmq`

- **host**: The RabbitMQ server hostname or IP address.
- **port**: The port on which RabbitMQ is listening (default: `5672`).
- **vhost**: The virtual host used for isolating environments in RabbitMQ (default: `/`).
- **username**: Username for authenticating with RabbitMQ.
- **password**: Password for authenticating with RabbitMQ.
- **tls**: Whether to use TLS/SSL for the connection (`true` or `false`).

#### `features.common_settings`

- **enabled**: Enables or disables the common settings feature.
- **queue**: Name of the queue where incoming settings messages will be consumed.
- **exchange**: Name of the exchange to which settings messages are published.
- **deadLetterExchange**: Exchange where messages are routed if they cannot be processed.
- **deadLetterRoutingKey**: Routing key for directing failed messages to the dead-letter exchange.
- **api_url**: URL of the API used for handling user settings (the backend service for common settings).
- **api_secret**: Secret key or token used to authenticate API requests.

#### `features.matrix_profile_updates_allowed`

- **matrix_profile_updates_allowed**: Boolean flag indicating whether updates to Matrix user profiles (display name, avatar, etc.) are permitted on ToM.

---

The service can be instantiated and started programmatically:

```ts
import { CommonSettingsService } from '@twake-chat/common-settings';
import { logger } from '@twake-chat/logger';
import config from './config.json';

const service = new CommonSettingsService(config, logger, db); // db is tomserver db instance

await service.start();
```

To stop the service gracefully:

```ts
await service.stop();
```

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build @twake-chat/common-settings` to build the library.

## Running unit tests

Run `nx test @twake-chat/common-settings` to execute the unit tests via [Jest](https://jestjs.io).
