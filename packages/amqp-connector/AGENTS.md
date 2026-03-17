<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# @twake/amqp-connector

## Purpose
AMQP message broker client package providing a robust, auto-reconnecting connection to RabbitMQ (or any AMQP 0-9-1 broker). Uses a fluent builder API to configure exchanges, queues, routing keys, and message handlers. Implements exponential backoff with jitter for reconnection and handles channel recreation on failure.

## Key Files

| File | Description |
|------|-------------|
| `src/index.ts` | Main export — `AMQPConnector` class, `ConnectionState` enum, types |
| `src/types.ts` | Type definitions: `AmqpConfig`, `ReconnectionConfig`, `MessageHandler`, `ConnectionState` |
| `src/errors.ts` | Error classes: `AMQPConnectorError`, `ExchangeNotSpecifiedError`, `QueueNotSpecifiedError`, `MessageHandlerNotProvidedError` |
| `src/index.test.ts` | Jest tests for connector behavior |
| `package.json` | Package manifest (`@twake/amqp-connector`) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | All TypeScript source files (see `src/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- Fluent builder pattern: chain `withConfig()`, `withExchange()`, `withQueue()`, `onMessage()`, then call `build()`
- `build()` is async — always await it before expecting messages
- `close()` is safe to call at any connection state, including during reconnection
- Error types are exported for instanceof checks in consumers

### Testing Requirements
```bash
npx nx run  @twake/amqp-connector:test
```
Tests mock amqplib — no live broker required.

### Common Patterns
```typescript
const connector = new AMQPConnector(logger)
  .withUrl('amqp://localhost')
  .withExchange('my-exchange')
  .withQueue('my-queue', {}, 'routing.key')
  .onMessage(async (msg) => { /* handle */ })
  .withReconnection({ maxRetries: 5 });
await connector.build();
```

## Dependencies

### Internal
- `@twake/logger` — TwakeLogger type and logging

### External
- `amqplib ^0.10.9` — AMQP 0-9-1 client library

<!-- MANUAL: -->
