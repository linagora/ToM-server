/**
 * Tests for configuration loading
 */

import { loadConfig, validateConfig } from '../src/config'
import {
  RabbitMQConfigError,
  SynapseConfigError,
  DatabaseConfigError
} from '../src/errors'

describe('config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('loadConfig', () => {
    it('should throw RabbitMQConfigError when RABBITMQ_HOST is missing', () => {
      delete process.env.RABBITMQ_HOST
      process.env.QUEUE_NAME = 'test-queue'
      process.env.EXCHANGE_NAME = 'test-exchange'
      process.env.SYNAPSE_URL = 'http://localhost:8008'
      process.env.SYNAPSE_DOMAIN = 'localhost'

      expect(() => loadConfig()).toThrow(RabbitMQConfigError)
    })

    it('should throw RabbitMQConfigError when QUEUE_NAME is missing', () => {
      process.env.RABBITMQ_HOST = 'localhost'
      delete process.env.QUEUE_NAME
      process.env.EXCHANGE_NAME = 'test-exchange'
      process.env.SYNAPSE_URL = 'http://localhost:8008'
      process.env.SYNAPSE_DOMAIN = 'localhost'

      expect(() => loadConfig()).toThrow(RabbitMQConfigError)
    })

    it('should throw RabbitMQConfigError when EXCHANGE_NAME is missing', () => {
      process.env.RABBITMQ_HOST = 'localhost'
      process.env.QUEUE_NAME = 'test-queue'
      delete process.env.EXCHANGE_NAME
      process.env.SYNAPSE_URL = 'http://localhost:8008'
      process.env.SYNAPSE_DOMAIN = 'localhost'

      expect(() => loadConfig()).toThrow(RabbitMQConfigError)
    })

    it('should throw SynapseConfigError when SYNAPSE_URL is missing', () => {
      process.env.RABBITMQ_HOST = 'localhost'
      process.env.QUEUE_NAME = 'test-queue'
      process.env.EXCHANGE_NAME = 'test-exchange'
      delete process.env.SYNAPSE_URL
      process.env.SYNAPSE_DOMAIN = 'localhost'

      expect(() => loadConfig()).toThrow(SynapseConfigError)
    })

    it('should throw SynapseConfigError when SYNAPSE_DOMAIN is missing', () => {
      process.env.RABBITMQ_HOST = 'localhost'
      process.env.QUEUE_NAME = 'test-queue'
      process.env.EXCHANGE_NAME = 'test-exchange'
      process.env.SYNAPSE_URL = 'http://localhost:8008'
      delete process.env.SYNAPSE_DOMAIN

      expect(() => loadConfig()).toThrow(SynapseConfigError)
    })

    it('should load config successfully with all required env vars', () => {
      process.env.RABBITMQ_HOST = 'rabbitmq.local'
      process.env.RABBITMQ_PORT = '5673'
      process.env.RABBITMQ_USERNAME = 'user'
      process.env.RABBITMQ_PASSWORD = 'pass'
      process.env.RABBITMQ_VHOST = '/myhost'
      process.env.QUEUE_NAME = 'my-queue'
      process.env.EXCHANGE_NAME = 'my-exchange'
      process.env.ROUTING_KEY = 'profile.#'
      process.env.SYNAPSE_URL = 'http://synapse:8008'
      process.env.SYNAPSE_DOMAIN = 'example.com'
      process.env.REGISTRATION_PATH = '/config/registration.yaml'
      process.env.DATABASE_ENGINE = 'sqlite'
      process.env.DATABASE_HOST = '/data/test.db'

      const config = loadConfig()

      expect(config.rabbitmq.host).toBe('rabbitmq.local')
      expect(config.rabbitmq.port).toBe(5673)
      expect(config.rabbitmq.username).toBe('user')
      expect(config.rabbitmq.password).toBe('pass')
      expect(config.rabbitmq.vhost).toBe('/myhost')
      expect(config.queue.name).toBe('my-queue')
      expect(config.queue.exchange).toBe('my-exchange')
      expect(config.queue.routingKey).toBe('profile.#')
      expect(config.synapse.homeserverUrl).toBe('http://synapse:8008')
      expect(config.synapse.domain).toBe('example.com')
      expect(config.synapse.registrationPath).toBe('/config/registration.yaml')
      expect(config.database.engine).toBe('sqlite')
      expect(config.database.host).toBe('/data/test.db')
    })

    it('should use default values for optional env vars', () => {
      process.env.RABBITMQ_HOST = 'localhost'
      process.env.QUEUE_NAME = 'test-queue'
      process.env.EXCHANGE_NAME = 'test-exchange'
      process.env.SYNAPSE_URL = 'http://localhost:8008'
      process.env.SYNAPSE_DOMAIN = 'localhost'

      const config = loadConfig()

      expect(config.rabbitmq.port).toBe(5672)
      expect(config.rabbitmq.username).toBe('guest')
      expect(config.rabbitmq.password).toBe('guest')
      expect(config.rabbitmq.vhost).toBe('/')
      expect(config.rabbitmq.tls).toBe(false)
      expect(config.database.engine).toBe('sqlite')
      expect(config.synapse.registrationPath).toBe('./registration.yaml')
    })

    it('should throw DatabaseConfigError for pg without required fields', () => {
      process.env.RABBITMQ_HOST = 'localhost'
      process.env.QUEUE_NAME = 'test-queue'
      process.env.EXCHANGE_NAME = 'test-exchange'
      process.env.SYNAPSE_URL = 'http://localhost:8008'
      process.env.SYNAPSE_DOMAIN = 'localhost'
      process.env.DATABASE_ENGINE = 'pg'
      process.env.DATABASE_HOST = 'postgres'
      // Missing DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD

      expect(() => loadConfig()).toThrow(DatabaseConfigError)
    })

    it('should load pg config with all required fields', () => {
      process.env.RABBITMQ_HOST = 'localhost'
      process.env.QUEUE_NAME = 'test-queue'
      process.env.EXCHANGE_NAME = 'test-exchange'
      process.env.SYNAPSE_URL = 'http://localhost:8008'
      process.env.SYNAPSE_DOMAIN = 'localhost'
      process.env.DATABASE_ENGINE = 'pg'
      process.env.DATABASE_HOST = 'postgres'
      process.env.DATABASE_NAME = 'bridge_db'
      process.env.DATABASE_USER = 'bridge_user'
      process.env.DATABASE_PASSWORD = 'secret'
      process.env.DATABASE_SSL = 'true'

      const config = loadConfig()

      expect(config.database.engine).toBe('pg')
      expect(config.database.host).toBe('postgres')
      expect(config.database.name).toBe('bridge_db')
      expect(config.database.user).toBe('bridge_user')
      expect(config.database.password).toBe('secret')
      expect(config.database.ssl).toBe(true)
    })
  })

  describe('validateConfig', () => {
    it('should not throw for valid config', () => {
      const validConfig = {
        rabbitmq: {
          host: 'localhost',
          port: 5672,
          username: 'guest',
          password: 'guest',
          vhost: '/',
          tls: false
        },
        queue: {
          name: 'test-queue',
          exchange: 'test-exchange'
        },
        synapse: {
          homeserverUrl: 'http://localhost:8008',
          domain: 'localhost',
          registrationPath: './registration.yaml'
        },
        database: {
          engine: 'sqlite' as const,
          host: './data/settings.db'
        }
      }

      expect(() => validateConfig(validConfig)).not.toThrow()
    })

    it('should throw for invalid rabbitmq config', () => {
      const invalidConfig = {
        rabbitmq: {
          host: '',
          port: 5672,
          username: 'guest',
          password: 'guest',
          vhost: '/',
          tls: false
        },
        queue: {
          name: 'test-queue',
          exchange: 'test-exchange'
        },
        synapse: {
          homeserverUrl: 'http://localhost:8008',
          domain: 'localhost',
          registrationPath: './registration.yaml'
        },
        database: {
          engine: 'sqlite' as const,
          host: './data/settings.db'
        }
      }

      expect(() => validateConfig(invalidConfig)).toThrow(RabbitMQConfigError)
    })
  })
})
