<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# amqp-connector/src/

## Purpose
TypeScript source for `@twake/amqp-connector`. Four files implementing the full AMQP connector: the main class with fluent builder API, type definitions, custom error classes, and tests.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | `AMQPConnector` class, `ConnectionState` enum, `DEFAULT_RECONNECTION_CONFIG`, all builder methods and connection logic |
| `types.ts` | `AmqpConfig`, `ReconnectionConfig`, `MessageHandler`, `ConnectionState` type definitions |
| `errors.ts` | `AMQPConnectorError` (base), `ExchangeNotSpecifiedError`, `QueueNotSpecifiedError`, `MessageHandlerNotProvidedError` |
| `index.test.ts` | Jest tests — mocks amqplib, tests connection lifecycle, reconnection, and error handling |

## For AI Agents

### Working In This Directory
- All builder methods return `this` for chaining — maintain this pattern if adding new methods
- Reconnection uses exponential backoff with jitter: `delay = min(initialDelay * backoff^attempt, maxDelay) + jitter`
- `build()` sets up channel, exchange, queue binding, and consumer in sequence
- State transitions: `Disconnected → Connecting → Connected → Reconnecting → Connected`

<!-- MANUAL: -->
