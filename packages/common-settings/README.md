# @twake/common-settings

The **Common Settings** module provides an integration layer between Twake Common Settings and ToM.  
It listens for user profile updates (e.g., display name, avatar) published to an AMQP queue and propagates these changes to Synapse using the **Admin Settings API**.  

This ensures that updates to user information are automatically synchronized with the chat service.  

## Configuration

The connector requires a JSON configuration file. Default values can be found in [`src/config.json`](./src/config.json).

### Required fields

```json
{
  "synapse_admin_server": "http://127.0.0.1:3000",
  "synapse_admin_secret": "changeme",
  "common_settings_connector": {
    "amqp_url": "amqp://localhost:5672",
    "queue": "common_settings"
  }
}
```

### Field descriptions

* **`synapse_admin_server`**
  URL of the Synapse Admin API server. Used to apply user profile changes. (For now this is the ToM server)

* **`synapse_admin_secret`**
  Secret token for authenticating with the Synapse Admin API.

* **`common_settings_connector.amqp_url`**
  AMQP broker connection string (e.g., RabbitMQ). The connector subscribes to this broker for incoming profile update events.

* **`common_settings_connector.queue`**
  Name of the queue from which user profile update messages will be consumed.

---

The service can be instantiated and started programmatically:

```ts
import { CommonSettingsService } from '@twake/common-settings';
import { logger } from '@twake/logger';
import config from './config.json';

const service = new CommonSettingsService(config, logger);

await service.start();
```

To stop the service gracefully:

```ts
await service.stop();
```

---