import {
  parseMessage,
  parsePayload,
  validateMessage,
  type ParsedMessage
} from './message-handler'
import { UserIdNotProvidedError, MessageParseError } from './errors'
import { type CommonSettingsMessage, type SettingsPayload } from './types'

describe('parseMessage', () => {
  it('should parse valid JSON correctly', () => {
    const validJson = JSON.stringify({
      source: 'test-app',
      nickname: 'test-user',
      request_id: 'req-123',
      timestamp: 1234567890,
      version: 1,
      payload: {
        language: 'en',
        timezone: 'UTC',
        avatar: 'https://example.com/avatar.png',
        last_name: 'Doe',
        first_name: 'John',
        email: 'john@example.com',
        phone: '+1234567890',
        matrix_id: '@john:example.com',
        display_name: 'John Doe'
      }
    })

    const result = parseMessage(validJson)

    expect(result).not.toBeNull()
    expect(result).toMatchObject({
      source: 'test-app',
      request_id: 'req-123',
      timestamp: 1234567890,
      version: 1
    })
  })

  it('should return null for invalid JSON', () => {
    const invalidJson = '{ this is not valid json }'

    const result = parseMessage(invalidJson)

    expect(result).toBeNull()
  })

  it('should return null for malformed JSON string', () => {
    const malformedJson = '{"source":"test","request_id":"123"'

    const result = parseMessage(malformedJson)

    expect(result).toBeNull()
  })

  it('should return null for empty string', () => {
    const result = parseMessage('')

    expect(result).toBeNull()
  })
})

describe('parsePayload', () => {
  it('should parse valid JSON correctly', () => {
    const validJson = JSON.stringify({
      language: 'en',
      timezone: 'UTC',
      avatar: 'https://example.com/avatar.png',
      last_name: 'Doe',
      first_name: 'John',
      email: 'john@example.com',
      phone: '+1234567890',
      matrix_id: '@john:example.com',
      display_name: 'John Doe'
    })

    const result = parsePayload(validJson)

    expect(result).not.toBeNull()
    expect(result).toMatchObject({
      language: 'en',
      timezone: 'UTC',
      matrix_id: '@john:example.com',
      display_name: 'John Doe'
    })
  })

  it('should return null for invalid JSON', () => {
    const invalidJson = '{ not valid json at all }'

    const result = parsePayload(invalidJson)

    expect(result).toBeNull()
  })

  it('should return null for malformed JSON string', () => {
    const malformedJson = '{"matrix_id":"@user:domain","language":"en"'

    const result = parsePayload(malformedJson)

    expect(result).toBeNull()
  })

  it('should return null for empty string', () => {
    const result = parsePayload('')

    expect(result).toBeNull()
  })
})

describe('validateMessage', () => {
  const createValidMessage = (): CommonSettingsMessage => ({
    source: 'test-app',
    nickname: 'test-user',
    request_id: 'req-123',
    timestamp: 1234567890,
    version: 1,
    payload: {
      language: 'en',
      timezone: 'UTC',
      avatar: 'https://example.com/avatar.png',
      last_name: 'Doe',
      first_name: 'John',
      email: 'john@example.com',
      phone: '+1234567890',
      matrix_id: '@john:example.com',
      display_name: 'John Doe'
    }
  })

  it('should throw MessageParseError when request_id is missing', () => {
    const message = createValidMessage()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (message as any).request_id

    expect(() => validateMessage(message)).toThrow(MessageParseError)
    expect(() => validateMessage(message)).toThrow(
      'Message missing required request_id field'
    )
  })

  it('should throw MessageParseError when request_id is empty string', () => {
    const message = {
      ...createValidMessage(),
      request_id: ''
    }

    expect(() => validateMessage(message)).toThrow(MessageParseError)
    expect(() => validateMessage(message)).toThrow(
      'Message missing required request_id field'
    )
  })

  it('should throw MessageParseError when timestamp is missing', () => {
    const message = createValidMessage()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (message as any).timestamp

    expect(() => validateMessage(message)).toThrow(MessageParseError)
    expect(() => validateMessage(message)).toThrow(
      'Message missing required timestamp field'
    )
  })

  it('should throw MessageParseError when timestamp is null', () => {
    const message = {
      ...createValidMessage(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      timestamp: null as any
    }

    expect(() => validateMessage(message)).toThrow(MessageParseError)
    expect(() => validateMessage(message)).toThrow(
      'Message missing required timestamp field'
    )
  })

  it('should throw UserIdNotProvidedError when matrix_id is missing', () => {
    const message = createValidMessage()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (message.payload as any).matrix_id

    expect(() => validateMessage(message)).toThrow(UserIdNotProvidedError)
    expect(() => validateMessage(message)).toThrow(
      'User ID (matrix_id) not provided in message payload'
    )
  })

  it('should throw UserIdNotProvidedError when matrix_id is empty string', () => {
    const message = {
      ...createValidMessage(),
      payload: {
        ...createValidMessage().payload,
        matrix_id: ''
      }
    }

    expect(() => validateMessage(message)).toThrow(UserIdNotProvidedError)
  })

  it('should throw UserIdNotProvidedError when payload is missing', () => {
    const message = createValidMessage()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (message as any).payload

    expect(() => validateMessage(message)).toThrow(UserIdNotProvidedError)
  })

  it('should default version to 1 when missing', () => {
    const message = createValidMessage()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (message as any).version

    const result = validateMessage(message)

    expect(result.version).toBe(1)
  })

  it('should default version to 1 when null', () => {
    const message = {
      ...createValidMessage(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      version: null as any
    }

    const result = validateMessage(message)

    expect(result.version).toBe(1)
  })

  it('should default version to 1 when undefined', () => {
    const message = {
      ...createValidMessage(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      version: undefined as any
    }

    const result = validateMessage(message)

    expect(result.version).toBe(1)
  })

  it('should return ParsedMessage with all fields for valid message', () => {
    const message = createValidMessage()

    const result: ParsedMessage = validateMessage(message)

    expect(result).toEqual({
      userId: '@john:example.com',
      version: 1,
      timestamp: 1234567890,
      requestId: 'req-123',
      source: 'test-app',
      payload: {
        language: 'en',
        timezone: 'UTC',
        avatar: 'https://example.com/avatar.png',
        last_name: 'Doe',
        first_name: 'John',
        email: 'john@example.com',
        phone: '+1234567890',
        matrix_id: '@john:example.com',
        display_name: 'John Doe'
      }
    })
  })

  it('should preserve custom version when provided', () => {
    const message = {
      ...createValidMessage(),
      version: 2
    }

    const result = validateMessage(message)

    expect(result.version).toBe(2)
  })

  it('should accept timestamp with value 0', () => {
    const message = {
      ...createValidMessage(),
      timestamp: 0
    }

    const result = validateMessage(message)

    expect(result.timestamp).toBe(0)
  })

  it('should validate all required fields are present in ParsedMessage', () => {
    const message = createValidMessage()

    const result = validateMessage(message)

    expect(result).toHaveProperty('userId')
    expect(result).toHaveProperty('version')
    expect(result).toHaveProperty('timestamp')
    expect(result).toHaveProperty('requestId')
    expect(result).toHaveProperty('source')
    expect(result).toHaveProperty('payload')
  })
})
