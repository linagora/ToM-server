/**
 * Configuration loader for common-settings-bridge
 */

import {
  type BridgeConfig,
  type RabbitMQConfig,
  type QueueConfig,
  type SynapseConfig,
  type DatabaseConfig
} from './types'
import {
  RabbitMQConfigError,
  SynapseConfigError,
  DatabaseConfigError
} from './errors'

/**
 * Load RabbitMQ configuration from environment
 */
function loadRabbitMQConfig(): RabbitMQConfig {
  const host = process.env.RABBITMQ_HOST ?? ''
  if (host.length === 0) {
    throw new RabbitMQConfigError('host')
  }

  return {
    host,
    port: parseInt(process.env.RABBITMQ_PORT ?? '5672', 10),
    username: process.env.RABBITMQ_USERNAME ?? 'guest',
    password: process.env.RABBITMQ_PASSWORD ?? 'guest',
    vhost: process.env.RABBITMQ_VHOST ?? '/',
    tls: process.env.RABBITMQ_TLS === 'true'
  }
}

/**
 * Load queue configuration from environment
 */
function loadQueueConfig(): QueueConfig {
  const name = process.env.QUEUE_NAME ?? ''
  const exchange = process.env.EXCHANGE_NAME ?? ''

  if (name.length === 0) {
    throw new RabbitMQConfigError('queue name')
  }
  if (exchange.length === 0) {
    throw new RabbitMQConfigError('exchange name')
  }

  return {
    name,
    exchange,
    routingKey: process.env.ROUTING_KEY,
    deadLetterExchange: process.env.DEAD_LETTER_EXCHANGE,
    deadLetterRoutingKey: process.env.DEAD_LETTER_ROUTING_KEY
  }
}

/**
 * Load Synapse configuration from environment
 */
function loadSynapseConfig(): SynapseConfig {
  const homeserverUrl = process.env.SYNAPSE_URL ?? ''
  const domain = process.env.SYNAPSE_DOMAIN ?? ''
  const registrationPath =
    process.env.REGISTRATION_PATH ?? './registration.yaml'

  // Load Admin API mode
  const rawAdminMode = (
    process.env.SYNAPSE_ADMIN_API_MODE ?? 'disabled'
  ).toLowerCase()
  let adminApiMode: 'disabled' | 'fallback' | 'exclusive' = 'disabled'
  if (rawAdminMode === 'fallback' || rawAdminMode === 'exclusive') {
    adminApiMode = rawAdminMode
  }

  if (homeserverUrl.length === 0) {
    throw new SynapseConfigError('homeserver URL')
  }
  if (domain.length === 0) {
    throw new SynapseConfigError('domain')
  }

  return {
    homeserverUrl,
    domain,
    registrationPath,
    adminApiMode
  }
}

/**
 * Load database configuration from environment
 */
function loadDatabaseConfig(): DatabaseConfig {
  const engine = (process.env.DATABASE_ENGINE ?? 'sqlite') as 'sqlite' | 'pg'
  const host = process.env.DATABASE_HOST ?? './data/settings.db'

  if (host.length === 0) {
    throw new DatabaseConfigError('host')
  }

  const config: DatabaseConfig = {
    engine,
    host
  }

  // PostgreSQL requires additional config
  if (engine === 'pg') {
    const name = process.env.DATABASE_NAME
    const user = process.env.DATABASE_USER
    const password = process.env.DATABASE_PASSWORD

    if (!name) throw new DatabaseConfigError('name (required for PostgreSQL)')
    if (!user) throw new DatabaseConfigError('user (required for PostgreSQL)')
    if (!password)
      throw new DatabaseConfigError('password (required for PostgreSQL)')

    config.name = name
    config.user = user
    config.password = password
    config.ssl = process.env.DATABASE_SSL === 'true'
  }

  return config
}

/**
 * Load complete configuration from environment variables
 * @returns Complete bridge configuration
 * @throws ConfigurationError if required config is missing
 */
export function loadConfig(): BridgeConfig {
  return {
    rabbitmq: loadRabbitMQConfig(),
    queue: loadQueueConfig(),
    synapse: loadSynapseConfig(),
    database: loadDatabaseConfig(),
    logLevel: process.env.LOG_LEVEL ?? 'info'
  }
}

/**
 * Validate configuration object
 * @param config Configuration to validate
 * @throws ConfigurationError if config is invalid
 */
export function validateConfig(config: BridgeConfig): void {
  // RabbitMQ validation
  if (!config.rabbitmq.host) throw new RabbitMQConfigError('host')
  if (!config.queue.name) throw new RabbitMQConfigError('queue name')
  if (!config.queue.exchange) throw new RabbitMQConfigError('exchange name')

  // Synapse validation
  if (!config.synapse.homeserverUrl)
    throw new SynapseConfigError('homeserver URL')
  if (!config.synapse.domain) throw new SynapseConfigError('domain')

  // Database validation
  if (!config.database.host) throw new DatabaseConfigError('host')
  if (config.database.engine === 'pg') {
    if (!config.database.name) throw new DatabaseConfigError('name')
    if (!config.database.user) throw new DatabaseConfigError('user')
    if (!config.database.password) throw new DatabaseConfigError('password')
  }
}
