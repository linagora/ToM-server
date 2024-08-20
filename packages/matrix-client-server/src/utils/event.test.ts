import { type ClientEvent } from '../types'
import { SafeClientEvent } from './event'
import { type TwakeLogger } from '@twake/logger'

describe('Test suites for event.ts', () => {
  let mockLogger: TwakeLogger
  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      info: jest.fn()
    } as unknown as TwakeLogger
  })
  describe('constructor', () => {
    it('should create a redactedEvent if the event is correct', () => {
      const clientEvent: ClientEvent = {
        content: {
          alias: 'alias',
          alt_aliases: ['alt_aliases']
        },
        event_id: 'event_id',
        origin_server_ts: 123456,
        room_id: '!726s6s6q:example.com',
        sender: '@alice:example.com',
        state_key: '',
        type: 'm.room.canonical_alias'
      }
      const redactedEvent = new SafeClientEvent(clientEvent)
      expect(redactedEvent).toBeDefined()
    })
    it('should throw an error if the eventID is incorrect', () => {
      const clientEvent: ClientEvent = {
        content: {
          alias: 'alias',
          alt_aliases: ['alt_aliases']
        },
        // @ts-expect-error : invalid event_id for test
        event_id: 123456,
        origin_server_ts: 123456,
        room_id: '!726s6s6q:example.com',
        sender: '@alice:example.com',
        state_key: '',
        type: 'm.room.canonical_alias'
      }
      expect(() => new SafeClientEvent(clientEvent)).toThrow('Invalid event_id')
    })
    it('should throw an error if the type is incorrect', () => {
      const clientEvent: ClientEvent = {
        content: {
          alias: 'alias',
          alt_aliases: ['alt_aliases']
        },
        event_id: 'event_id',
        origin_server_ts: 123456,
        room_id: '!726s6s6q:example.com',
        sender: '@alice:example.com',
        state_key: '',
        type: 'invalid_type'
      }
      expect(() => new SafeClientEvent(clientEvent)).toThrow('Invalid type')
    })
    it('should throw an error if the roomID is incorrect', () => {
      const clientEvent: ClientEvent = {
        content: {
          alias: 'alias',
          alt_aliases: ['alt_aliases']
        },
        event_id: 'event_id',
        origin_server_ts: 123456,
        room_id: 'invalid_room_id',
        sender: '@alice:example.com',
        state_key: '',
        type: 'm.room.canonical_alias'
      }
      expect(() => new SafeClientEvent(clientEvent)).toThrow('Invalid room_id')
    })
    it('should throw an error if the sender is incorrect', () => {
      const clientEvent: ClientEvent = {
        content: {
          alias: 'alias',
          alt_aliases: ['alt_aliases']
        },
        event_id: 'event_id',
        origin_server_ts: 123456,
        room_id: '!726s6s6q:example.com',
        // @ts-expect-error : invalid sender for test
        sender: 123456,
        state_key: '',
        type: 'm.room.canonical_alias'
      }
      expect(() => new SafeClientEvent(clientEvent)).toThrow('Invalid sender')
    })
    it('should throw an error if the content is incorrect', () => {
      const clientEvent: ClientEvent = {
        content: ['content'],
        event_id: 'event_id',
        origin_server_ts: 123456,
        room_id: '!726s6s6q:example.com',
        sender: '@alice:example.com',
        state_key: '',
        type: 'm.room.canonical_alias'
      }
      expect(() => new SafeClientEvent(clientEvent)).toThrow('Invalid content')
    })
    it('should throw an error if the originServerTs is incorrect', () => {
      const clientEvent: ClientEvent = {
        content: {
          alias: 'alias',
          alt_aliases: ['alt_aliases']
        },
        event_id: 'event_id',
        // @ts-expect-error : invalid origin_server_ts for test
        origin_server_ts: '123456',
        room_id: '!726s6s6q:example.com',
        sender: '@alice:example.com',
        state_key: '',
        type: 'm.room.canonical_alias'
      }
      expect(() => new SafeClientEvent(clientEvent)).toThrow(
        'Invalid origin_server_ts'
      )
    })
  })
  describe('redact', () => {
    const clientEvent: ClientEvent = {
      content: {
        alias: 'alias',
        alt_aliases: ['alt_aliases']
      },
      event_id: 'event_id',
      origin_server_ts: 123456,
      room_id: '!726s6s6q:example.com',
      sender: '@alice:example.com',
      state_key: '',
      type: 'm.room.canonical_alias',
      // @ts-expect-error : invalid keys for test
      invalid_key: 'invalid_key',
      another_invalid_key: 'another_invalid_key'
    }
    it('should log an info message if the event has already been redacted', () => {
      const redactedEvent = new SafeClientEvent(clientEvent)
      redactedEvent.redact()
      redactedEvent.redact(mockLogger)
      expect(mockLogger.info).toHaveBeenCalledWith('Event is already redacted')
    })
    it('should return a redacted event', () => {
      const redactedEvent = new SafeClientEvent(clientEvent)
      redactedEvent.redact()
      expect(redactedEvent).toBeDefined()
      expect(redactedEvent.hasBeenRedacted()).toEqual(true)
    })
    it('should remove all the keys that are not allowed', () => {
      const redactedEvent = new SafeClientEvent(clientEvent)
      redactedEvent.redact()
      const redactedEventKeys = Object.keys(redactedEvent.getEvent())
      const expectedKeys = [
        'content',
        'event_id',
        'origin_server_ts',
        'room_id',
        'sender',
        'state_key',
        'type'
      ]
      expectedKeys.forEach((key) => {
        expect(redactedEventKeys).toContain(key)
      })
      expect(redactedEventKeys.length).toBe(expectedKeys.length)
    })
    it('should remove all the content keys that are not allowed', () => {
      const redactedEvent = new SafeClientEvent(clientEvent)
      redactedEvent.redact()
      const redactedEventContentKeys = Object.keys(
        redactedEvent.getEvent().content
      )
      expect(redactedEventContentKeys).toHaveLength(0)
    })
    it('should not remove the allowed content keys', () => {
      const clientEvent: ClientEvent = {
        content: {
          ban: 50,
          events: 50,
          events_default: 50,
          invite: 50
        },
        event_id: 'event_id',
        origin_server_ts: 123456,
        room_id: '!726s6s6q:example.com',
        sender: '@alice:example.com',
        state_key: '',
        type: 'm.room.power_levels',
        // @ts-expect-error : invalid keys for test
        invalid_key: 'invalid_key',
        another_invalid_key: 'another_invalid_key'
      }
      const redactedEvent = new SafeClientEvent(clientEvent)
      redactedEvent.redact()
      const redactedEventContentKeys = Object.keys(
        redactedEvent.getEvent().content
      )
      const expectedKeys = ['ban', 'events', 'events_default', 'invite']
      expectedKeys.forEach((key) => {
        expect(redactedEventContentKeys).toContain(key)
      })
      expect(redactedEventContentKeys.length).toBe(expectedKeys.length)
    })
    it('should not remove any content key for a m.room.create event', () => {
      const clientEvent: ClientEvent = {
        content: {
          creator: '@alice:example.com',
          random_key: 'random'
        },
        event_id: 'event_id',
        origin_server_ts: 123456,
        room_id: '!726s6s6q:example.com',
        sender: '@alice:example.com',
        state_key: '',
        type: 'm.room.create',
        // @ts-expect-error : invalid keys for test
        invalid_key: 'invalid_key',
        another_invalid_key: 'another_invalid_key'
      }
      const redactedEvent = new SafeClientEvent(clientEvent)
      redactedEvent.redact()
      const redactedEventContentKeys = Object.keys(
        redactedEvent.getEvent().content
      )
      const expectedKeys = ['creator', 'random_key']
      expectedKeys.forEach((key) => {
        expect(redactedEventContentKeys).toContain(key)
      })
      expect(redactedEventContentKeys.length).toBe(expectedKeys.length)
    })
  })
})
