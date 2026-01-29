# @twake/common-settings-bridge

Standalone service that bridges user profile updates from RabbitMQ to Synapse homeserver using the Matrix Application Service Protocol.

## Overview

The common-settings-bridge is a dedicated microservice that synchronizes user profile settings from a RabbitMQ message queue to a Matrix/Synapse homeserver. It consumes profile update messages, validates them, stores them in a persistent database, and applies the updates to user profiles in Synapse.

### Purpose

This bridge decouples profile management from the main application by:
- Consuming profile update events asynchronously from RabbitMQ
- Persisting user settings in a dedicated database
- Updating Matrix user profiles (display name, avatar) in real-time
- Providing flexible admin API modes for different deployment scenarios

### Architecture

```
┌─────────────┐
│  RabbitMQ   │
│   Exchange  │
│   (topic)   │
└──────┬──────┘
       │
       │ settings.updated
       │ messages
       │
       v
┌──────────────────────────────────────┐
│  Common Settings Bridge              │
│  ┌────────────────────────────────┐  │
│  │ Message Consumer (RabbitMQ)    │  │
│  │ - Parse and validate messages  │  │
│  │ - Extract user profile data    │  │
│  └────────┬───────────────────────┘  │
│           │                          │
│  ┌────────v───────────────────────┐  │
│  │ Profile Manager                │  │
│  │ - Delta detection              │  │
│  │ - Apply updates to Matrix      │  │
│  │ - Persist to database          │  │
│  └────────┬───────────────────────┘  │
│           │                          │
│  ┌────────v───────────────────────┐  │
│  │ Database Layer (PG/SQLite)     │  │
│  │ - usersettings table           │  │
│  │ - Version tracking             │  │
│  └────────────────────────────────┘  │
└──────────────────┬───────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        v                     v
   ┌─────────────┐    ┌──────────────┐
   │   Matrix    │    │    Synapse   │
   │  (AS Proto) │    │  (Admin API) │
   └─────────────┘    └──────────────┘
```

### Key Features

- **Asynchronous Processing**: Consumes RabbitMQ messages with dead-letter queue support
- **Delta Detection**: Prevents redundant updates by checking current profile state
- **Flexible Admin Modes**: Supports exclusive, fallback, and disabled modes for Synapse admin API
- **Database Persistence**: SQLite or PostgreSQL backend for settings storage
- **Application Service Protocol**: Uses Matrix AS protocol for seamless integration
- **Startup Verification**: Ensures bot user is registered and admin status is verified

## Prerequisites

- **Node.js**: v18.20.8 (as specified in package.json)
- **npm**: v10.8.2 or compatible
- **Synapse**: Running Matrix/Synapse instance with application service support
- **RabbitMQ**: Instance with topic exchange configured
- **Database**: PostgreSQL or SQLite with `usersettings` table
- **Network**: Bridge must have network access to Synapse and RabbitMQ

## Installation

### 1. Clone/Navigate to Package

```bash
cd packages/common-settings-bridge
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Project

```bash
npm run build
```

The build creates a `dist/index.js` file ready for execution.

### Optional: Watch Mode for Development

```bash
npm run watch
```

## Configuration

The bridge requires two configuration files: `config.yaml` and `registration.yaml`.

### Configuration File: config.yaml

Create `config.yaml` by copying from the example:

```bash
cp config.yaml.example config.yaml
```

Then edit with your environment-specific values.

#### Configuration Sections

**Matrix / Synapse Settings**
```yaml
homeserverUrl: "http://synapse:8008"  # HTTP URL to Synapse
domain: "docker.internal"              # Matrix domain/homeserver name
registrationPath: "/data/registration.yaml"  # Path to registration file
```

**Synapse Admin Retry Mode** (required)
```yaml
synapse:
  adminRetryMode: "exclusive"  # Options: "disabled", "fallback", "exclusive"
```

- `disabled`: Never uses Synapse admin API (only application service intent)
- `fallback`: Tries application service first, falls back to admin API on M_FORBIDDEN errors
- `exclusive`: Only uses Synapse admin API

**Logging Configuration**
```yaml
logging:
  level: "debug"  # Options: debug, info, warn, error
```

**Database Configuration**

PostgreSQL (recommended for production):
```yaml
database:
  engine: "pg"
  host: "postgres"
  port: 5432
  name: "tom_db"
  user: "twake"
  password: "twake_password"
```

SQLite (for development):
```yaml
database:
  engine: "sqlite"
  path: "/data/bridge.db"
```

**RabbitMQ Configuration**
```yaml
rabbitmq:
  host: "rabbitmq"
  port: 5672
  username: "guest"
  password: "guest"
  vhost: "/"
  tls: false                          # Enable TLS with `true`
  queueName: "chat.settings.updated.queue"
  exchangeName: "settings exchange"
  routingKey: "user.settings.updated"
  deadLetterExchangeName: "settings.dlx"  # Dead letter exchange for failed messages
```

### Configuration File: registration.yaml

Create `registration.yaml` by copying from the example:

```bash
cp registration.yaml.example registration.yaml
```

#### Generate Secure Tokens

Generate cryptographically secure tokens for `as_token` and `hs_token`:

```bash
openssl rand -hex 32
```

#### Edit registration.yaml

```yaml
id: common-settings-bridge
url: null  # No HTTP callback needed - RabbitMQ consumer only
as_token: <GENERATED_SECURE_TOKEN_1>
hs_token: <GENERATED_SECURE_TOKEN_2>
sender_localpart: _common_settings_bridge
namespaces:
  users:
    - exclusive: false
      regex: '@.*'  # Can act on behalf of any user
  rooms: []
  aliases: []
rate_limited: false
```

**Important**: The `as_token` and `hs_token` must match exactly in both:
1. `registration.yaml` (this file)
2. Synapse's `app_service_config_files` entry

#### Register with Synapse

Add the registration file path to your Synapse `homeserver.yaml`:

```yaml
app_service_config_files:
  - /path/to/registration.yaml
```

Then restart Synapse:

```bash
synctl restart
```

## Database Setup

The bridge requires a pre-existing `usersettings` table in your database. The table stores user profile settings and version information.

### Database Schema

Create the table before starting the bridge:

**PostgreSQL:**
```sql
CREATE TABLE usersettings (
  matrix_id VARCHAR(255) PRIMARY KEY,
  settings TEXT,
  version INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usersettings_updated_at ON usersettings(updated_at);
```

**SQLite:**
```sql
CREATE TABLE usersettings (
  matrix_id VARCHAR(255) PRIMARY KEY,
  settings TEXT,
  version INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usersettings_updated_at ON usersettings(updated_at);
```

**Column Descriptions:**
- `matrix_id`: User's full Matrix ID (e.g., `@user:example.com`)
- `settings`: JSON string containing user profile settings
- `version`: Integer tracking update version for delta detection
- `created_at`: Timestamp when the record was created
- `updated_at`: Timestamp when the record was last updated

## RabbitMQ Setup

### Exchange Configuration

Create a topic exchange for settings updates:

**Type**: topic
**Durable**: true
**Name**: `settings exchange` (or as configured in config.yaml)

### Queue Configuration

Create a durable queue for the bridge to consume:

**Queue Name**: `chat.settings.updated.queue`
**Durable**: true
**Arguments**:
```json
{
  "x-dead-letter-exchange": "settings.dlx",
  "x-dead-letter-routing-key": "dlx.user.settings.updated"
}
```

### Queue Binding

Bind the queue to the exchange with routing key:

**Exchange**: `settings exchange`
**Queue**: `chat.settings.updated.queue`
**Routing Key**: `user.settings.updated`

### Dead Letter Exchange (DLX)

For handling failed message delivery:

**DLX Exchange Name**: `settings.dlx`
**Type**: topic
**Durable**: true

**DLX Queue**: `settings.dlx.queue`
**Binding**: Route `dlx.user.settings.updated` → `settings.dlx.queue`

Failed messages are automatically routed to the DLX when:
- Message processing fails
- Message is nacked by the bridge
- Message times out

### Message Format

Messages published to RabbitMQ must follow this JSON structure:

```json
{
  "source": "string",              // Source application identifier
  "nickname": "string",            // User nickname (extracted from matrix_id)
  "request_id": "string",          // UUID for request tracking
  "timestamp": "number",           // Unix timestamp in milliseconds
  "version": "number",             // Message format version (currently 1)
  "payload": {
    "matrix_id": "@user:example.com",  // Required: Full Matrix ID
    "display_name": "New Name",        // Optional: Display name
    "avatar": "mxc://...avatar_url"    // Optional: Avatar mxc:// URL
  }
}
```

**Example Message**:
```json
{
  "source": "webapp",
  "nickname": "john",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": 1704067200000,
  "version": 1,
  "payload": {
    "matrix_id": "@john:example.com",
    "display_name": "John Doe",
    "avatar": "mxc://example.com/avatar123"
  }
}
```

## Running the Bridge

### Standard Startup

Start the bridge with config and registration files:

```bash
npm start -- -c config.yaml -r registration.yaml
```

**Parameters**:
- `-c, --config <path>`: Path to config.yaml
- `-r, --registration <path>`: Path to registration.yaml

### Auto-Generate Registration (If Not Exists)

If registration file doesn't exist, generate it automatically:

```bash
npm start -- -c config.yaml -f registration.yaml
```

**Parameters**:
- `-f`: Generate registration file if missing

### Docker Deployment

Build the Docker image:

```bash
docker build -t twake/common-settings-bridge:latest .
```

Run the container:

```bash
docker run -d \
  --name common-settings-bridge \
  -v /path/to/config.yaml:/usr/src/app/packages/common-settings-bridge/config.yaml \
  -v /path/to/registration.yaml:/data/registration.yaml \
  -p 9000:9000 \
  twake/common-settings-bridge:latest
```

### Environment Variables

Override file paths with environment variables:

```bash
REGISTRATION_FILE=/etc/bridge/registration.yaml npm start -- -c config.yaml
```

**Available Variables**:
- `REGISTRATION_FILE`: Path to registration.yaml (default: ./registration.yaml)

### Startup Verification

On startup, the bridge performs these checks:

1. **Loads Configuration**: Reads config.yaml and registration.yaml
2. **Connects to Services**: Establishes connections to Synapse, RabbitMQ, and database
3. **Registers Bot User**: Creates/verifies `@profile-bot:domain` in Synapse
4. **Checks Admin Status**: Verifies if bot user has admin privileges
5. **Starts Message Consumer**: Begins consuming messages from RabbitMQ
6. **Logs Status**: Outputs all configuration and status information

Watch for these log messages:
- `Bridge started successfully` - Bridge is running
- `Bridge bot user is registered and ready` - Bot user verified
- `Bridge bot user has admin privileges` - Admin status confirmed (if applicable)

## Message Flow and Processing

### Step-by-Step Processing

```python
def process_message(msg, cache):
    user = msg["nickname"]
    new_version = msg["version"]
    new_ts = parse_rfc3339(msg["timestamp"])
    req_id = msg["request_id"]

    last = cache.get(user)

    # Idempotency check
    if last and req_id == last.request_id:
        discard(msg) # duplicate delivery
        return

    if last is None or new_version > last.version:
        apply_update(msg)
        cache[user] = {
            "version": new_version,
            "timestamp": new_ts,
            "request_id": req_id
        }
    elif new_version == last.version and new_ts > last.timestamp:
        apply_update(msg)
        cache[user]["timestamp"] = new_ts
    else:
        discard(msg) # stale update
```

1. **Message Arrival**
   - RabbitMQ delivers message to `chat.settings.updated.queue`
   - Bridge consumer receives and deserializes JSON message

2. **Message Validation**
   - Validates message schema (required fields: `matrix_id`, `request_id`)
   - Extracts payload and user information
   - Logs message for debugging

3. **Database Lookup**
   - Queries `usersettings` table for existing record
   - Retrieves current version and settings

4. **Delta Detection**
   - Compares new settings with current values
   - Only proceeds if changes detected
   - Prevents redundant Matrix API calls

5. **Profile Update**
   - If `display_name` present: Updates Matrix display name
   - If `avatar` present: Updates Matrix avatar URL
   - Uses configured admin retry mode (disabled/fallback/exclusive)

6. **Database Persistence**
   - Inserts or updates `usersettings` record
   - Increments version counter
   - Updates `updated_at` timestamp

7. **Message Acknowledgment**
   - On success: ACKs message (removed from queue)
   - On failure: NAKs message (sent to Dead Letter Exchange)

### Error Handling

**M_FORBIDDEN Error**
- Indicates user doesn't have permission for profile update
- In `fallback` mode: Automatically retries with admin API
- In `disabled` mode: Fails and sends to DLX
- In `exclusive` mode: Attempts admin API directly

**Connection Errors**
- Synapse unreachable: Message sent to DLX
- Database error: Message NAKed and requeued
- RabbitMQ error: Logged and connection retried

**Invalid Messages**
- Missing required fields: Logged and sent to DLX
- Invalid JSON: Deserialization error logged
- Malformed matrix_id: Validation error, sent to DLX

## Admin Retry Modes

The bridge supports three modes for using Synapse's admin API to update user profiles:

### Mode: disabled

Only uses the Application Service intent API. No admin API calls.

**Use Case**: Bot user has sufficient permissions in rooms

**Behavior**:
- Attempts profile update via intent API
- On M_FORBIDDEN: Fails and sends message to DLX
- Never falls back to admin API

**Config**:
```yaml
synapse:
  adminRetryMode: "disabled"
```

### Mode: fallback

Tries application service intent first, falls back to admin API on permission errors.

**Use Case**: Mixed permission scenarios, graceful degradation

**Behavior**:
- Attempts profile update via intent API
- On success: Completes
- On M_FORBIDDEN: Automatically retries with admin API
- Requires bot to be admin in Synapse

**Config**:
```yaml
synapse:
  adminRetryMode: "fallback"
```

### Mode: exclusive

Only uses Synapse admin API for all profile updates.

**Use Case**: Guaranteed admin access, central control

**Behavior**:
- Skips intent API entirely
- Only uses admin API for profile updates
- Requires bot to be registered as admin in Synapse
- Faster in large-scale deployments

**Config**:
```yaml
synapse:
  adminRetryMode: "exclusive"
```

### Making Bot User an Admin

For `fallback` or `exclusive` modes, the bridge bot must be registered as an admin.

**In PostgreSQL Synapse database**:
```sql
INSERT INTO public.users (name, admin)
VALUES ('@profile-bot:your.domain', 1)
ON CONFLICT DO NOTHING;
```

**In SQLite Synapse database**:
```sql
INSERT OR IGNORE INTO users (name, admin)
VALUES ('@profile-bot:your.domain', 1);
```

**Verification**: Check startup logs for message:
```
Bridge bot user @profile-bot:your.domain has admin privileges.
```

## Troubleshooting

### Bot User Not Admin

**Symptom**: Error message `Bot user does not have admin privileges to use Synapse admin API.`

**Solution**:
1. Verify bot user exists in Synapse database
2. Update user to have admin privileges:
   ```sql
   UPDATE public.users SET admin = 1 WHERE name = '@profile-bot:your.domain';
   ```
3. Restart bridge and check logs

### Connection Errors to Synapse

**Symptom**: `Failed to connect to homeserver`

**Solution**:
1. Verify `homeserverUrl` in config.yaml is correct
2. Test connectivity: `curl http://synapse:8008/_matrix/client/versions`
3. Check Synapse is running and listening on configured port
4. Verify network connectivity between bridge and Synapse

### Connection Errors to RabbitMQ

**Symptom**: `Failed to connect to RabbitMQ`

**Solution**:
1. Verify RabbitMQ host, port, credentials in config.yaml
2. Test connectivity: `telnet rabbitmq 5672`
3. Check queue and exchange exist:
   ```bash
   rabbitmqctl list_exchanges
   rabbitmqctl list_queues
   ```
4. Verify bridge has permissions to consume from queue

### M_FORBIDDEN on Profile Update

**Symptom**: Profile not updating, M_FORBIDDEN errors in logs

**Solution**:
1. If using `disabled` mode: Switch to `fallback` or `exclusive`
2. If using `fallback`: Verify bot is admin in Synapse
3. If using `exclusive`: Check bot admin status with startup logs
4. For intent-based updates: Ensure bot is joined to appropriate rooms

### Database Connection Failed

**Symptom**: `Failed to connect to database`

**Solution**:
1. Verify database engine, host, port in config.yaml
2. Test connectivity:
   ```bash
   # PostgreSQL
   psql -h postgres -U twake -d tom_db

   # SQLite
   sqlite3 /path/to/bridge.db
   ```
3. Verify `usersettings` table exists
4. Check database user has appropriate permissions

### Messages Not Being Consumed

**Symptom**: Messages sit in RabbitMQ queue, not consumed

**Solution**:
1. Verify queue name matches config.yaml
2. Check bridge is running: `npm start`
3. Check logs for connection errors
4. Verify routing key in message publisher matches configured key
5. Inspect queue bindings:
   ```bash
   rabbitmqctl list_bindings
   ```

### Dead Letter Exchange Receiving Messages

**Symptom**: Messages accumulated in `settings.dlx.queue`

**Meaning**: Messages are failing to process. Common causes:
- Invalid message format
- User matrix_id doesn't exist in Synapse
- Bot doesn't have admin privileges (if using admin mode)
- Database errors

**Solution**:
1. Check bridge logs for error messages
2. Manually inspect DLX messages for payload details
3. Fix root cause based on error logs
4. Purge DLX queue after fix, then restart bridge:
   ```bash
   rabbitmqctl purge_queue settings.dlx.queue
   ```

### Excessive Logging Output

**Symptom**: Too much debug output in logs

**Solution**: Adjust logging level in config.yaml:
```yaml
logging:
  level: "info"  # Change from "debug" to "info"
```

## Message Testing and Debugging

### Using the Message Sender Tool

A helper tool is provided for testing message publishing:

**Location**: `tools/send-message.mjs`

**Usage**:
```bash
cd tools
node send-message.mjs
```

**Interactive Prompts**:
1. Enter matrix_id (e.g., `@user:example.com`)
2. Enter new display_name
3. Enter new avatar URL (optional)
4. Message is published to configured exchange

**Configuration** (via environment variables):
```bash
RABBITMQ_HOST=localhost \
RABBITMQ_PORT=5672 \
RABBITMQ_USERNAME=guest \
RABBITMQ_PASSWORD=guest \
EXCHANGE_NAME="settings exchange" \
ROUTING_KEY="user.settings.updated" \
node send-message.mjs
```

### Manual Message Publishing

Publish a message directly with `rabbitmqctl`:

```bash
rabbitmqctl publish_to_exchange \
  "settings exchange" \
  "user.settings.updated" \
  "{\"source\":\"test\",\"nickname\":\"john\",\"request_id\":\"123\",\"timestamp\":$(date +%s)000,\"version\":1,\"payload\":{\"matrix_id\":\"@john:example.com\",\"display_name\":\"John Doe\"}}"
```

### Inspecting Queue Messages

View messages in queue without consuming:

```bash
# List queues
rabbitmqctl list_queues

# Get queue depth
rabbitmqctl list_queues messages consumers

# Inspect message content (requires rabbitmq-management plugin)
# Access at http://rabbitmq:15672 (default credentials: guest/guest)
```

## Docker Compose Example

A complete example for testing with Docker Compose:

```yaml
version: '3.8'

services:
  rabbitmq:
    image: rabbitmq:3.13-management
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    ports:
      - "5672:5672"
      - "15672:15672"
    healthcheck:
      test: rabbitmq-diagnostics -q ping
      interval: 5s
      timeout: 3s
      retries: 5

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: twake
      POSTGRES_PASSWORD: twake_password
      POSTGRES_DB: tom_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: pg_isready -U twake
      interval: 5s
      timeout: 3s
      retries: 5

  synapse:
    image: matrixdotorg/synapse:latest
    environment:
      SYNAPSE_SERVER_NAME: docker.internal
      SYNAPSE_REPORT_STATS: "no"
    volumes:
      - ./homeserver.yaml:/data/homeserver.yaml
      - ./registration.yaml:/data/registration.yaml
      - synapse_data:/data
    ports:
      - "8008:8008"
    depends_on:
      postgres:
        condition: service_healthy

  bridge:
    build: .
    environment:
      REGISTRATION_FILE: /data/registration.yaml
    volumes:
      - ./config.yaml:/usr/src/app/packages/common-settings-bridge/config.yaml
      - ./registration.yaml:/data/registration.yaml
    ports:
      - "9000:9000"
    depends_on:
      rabbitmq:
        condition: service_healthy
      postgres:
        condition: service_healthy
      synapse:
        condition: service_started

volumes:
  postgres_data:
  synapse_data:
```

## Development

### Running Tests

```bash
npm test
```

### Building in Watch Mode

```bash
npm run watch
```

### Code Structure

- `src/index.ts`: Main bridge application, entry point
- `dist/index.js`: Compiled JavaScript (output of build)

### Key Dependencies

- `matrix-appservice-bridge`: Matrix Application Service protocol implementation
- `@twake/amqp-connector`: RabbitMQ connection management
- `@twake/db`: Database abstraction layer
- `@twake/logger`: Structured logging

## License

AGPL-3.0-or-later
