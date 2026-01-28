/**
 * Tests for custom error classes
 */

import {
  CommonSettingsBridgeError,
  ConfigurationError,
  RabbitMQConfigError,
  SynapseConfigError,
  DatabaseConfigError,
  MessageParseError,
  MessageValidationError,
  BridgeOperationError,
  DatabaseOperationError,
  AvatarUploadError
} from '../src/errors'

describe('errors', () => {
  describe('CommonSettingsBridgeError', () => {
    it('should create error with correct name and message', () => {
      const error = new CommonSettingsBridgeError('test message')
      expect(error.name).toBe('CommonSettingsBridgeError')
      expect(error.message).toBe('test message')
      expect(error instanceof Error).toBe(true)
    })
  })

  describe('ConfigurationError', () => {
    it('should create error with prefixed message', () => {
      const error = new ConfigurationError('missing field')
      expect(error.name).toBe('ConfigurationError')
      expect(error.message).toBe('Configuration error: missing field')
      expect(error instanceof CommonSettingsBridgeError).toBe(true)
    })
  })

  describe('RabbitMQConfigError', () => {
    it('should create error with field name', () => {
      const error = new RabbitMQConfigError('host')
      expect(error.name).toBe('RabbitMQConfigError')
      expect(error.message).toBe(
        'Configuration error: RabbitMQ host must be provided'
      )
    })
  })

  describe('SynapseConfigError', () => {
    it('should create error with field name', () => {
      const error = new SynapseConfigError('domain')
      expect(error.name).toBe('SynapseConfigError')
      expect(error.message).toBe(
        'Configuration error: Synapse domain must be provided'
      )
    })
  })

  describe('DatabaseConfigError', () => {
    it('should create error with field name', () => {
      const error = new DatabaseConfigError('password')
      expect(error.name).toBe('DatabaseConfigError')
      expect(error.message).toBe(
        'Configuration error: Database password must be provided'
      )
    })
  })

  describe('MessageParseError', () => {
    it('should create error without reason', () => {
      const error = new MessageParseError()
      expect(error.name).toBe('MessageParseError')
      expect(error.message).toBe('Failed to parse message')
    })

    it('should create error with reason', () => {
      const error = new MessageParseError('invalid JSON')
      expect(error.name).toBe('MessageParseError')
      expect(error.message).toBe('Failed to parse message: invalid JSON')
    })
  })

  describe('MessageValidationError', () => {
    it('should create error with field name', () => {
      const error = new MessageValidationError('matrix_id')
      expect(error.name).toBe('MessageValidationError')
      expect(error.message).toBe(
        'Message validation failed: matrix_id is required'
      )
    })
  })

  describe('BridgeOperationError', () => {
    it('should create error with operation and reason', () => {
      const error = new BridgeOperationError(
        'updateProfile',
        'connection refused'
      )
      expect(error.name).toBe('BridgeOperationError')
      expect(error.message).toBe(
        "Bridge operation 'updateProfile' failed: connection refused"
      )
    })
  })

  describe('DatabaseOperationError', () => {
    it('should create error with operation and reason', () => {
      const error = new DatabaseOperationError(
        'insert',
        'unique constraint violation'
      )
      expect(error.name).toBe('DatabaseOperationError')
      expect(error.message).toBe(
        "Database operation 'insert' failed: unique constraint violation"
      )
    })
  })

  describe('AvatarUploadError', () => {
    it('should create error with userId and reason', () => {
      const error = new AvatarUploadError('@user:example.com', 'file too large')
      expect(error.name).toBe('AvatarUploadError')
      expect(error.message).toBe(
        'Failed to upload avatar for @user:example.com: file too large'
      )
    })
  })
})
