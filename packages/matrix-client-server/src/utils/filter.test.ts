import {
  EventFilter,
  Filter,
  _matchesWildcard,
  MAX_LIMIT,
  RoomEventFilter,
  RoomFilter
} from './filter'
import { type TwakeLogger } from '@twake/logger'

describe('Test suites for filter.ts', () => {
  let mockLogger: TwakeLogger
  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn()
    } as unknown as TwakeLogger
  })

  describe('Filter', () => {
    it('should create a filter with the correct parameters', () => {
      // Using example for the spec
      const filter = new Filter({
        event_fields: ['type', 'content', 'sender'],
        event_format: 'client',
        presence: {
          not_senders: ['@alice:example.com'],
          types: ['m.presence']
        },
        room: {
          ephemeral: {
            not_rooms: ['!726s6s6q:example.com'],
            not_senders: ['@spam:example.com'],
            types: ['m.receipt', 'm.typing']
          },
          state: {
            not_rooms: ['!726s6s6q:example.com'],
            types: ['m.room.*']
          },
          timeline: {
            limit: 10,
            not_rooms: ['!726s6s6q:example.com'],
            not_senders: ['@spam:example.com'],
            types: ['m.room.message']
          }
        }
      })
      expect(filter.event_fields).toEqual(['type', 'content', 'sender'])
      expect(filter.event_format).toEqual('client')
      expect(filter.presence).toEqual({
        limit: 10,
        senders: null,
        not_senders: ['@alice:example.com'],
        types: ['m.presence'],
        not_types: []
      })
      expect(filter.room?.ephemeral?.not_rooms).toEqual([
        '!726s6s6q:example.com'
      ])
      expect(filter.room?.state?.types).toEqual(['m.room.*'])
    })

    it('should not create empty filters when not needed', () => {
      const filter = new Filter({
        event_fields: ['type', 'content', 'sender'],
        event_format: 'client'
      })
      expect(filter.account_data).toBeUndefined()
      expect(filter.presence).toBeUndefined()
      expect(filter.room).toBeUndefined()
    })

    it('it should log a warning when creating a filter with an invalid event format', () => {
      const filter = new Filter(
        {
          event_format: 'invalid'
        },
        mockLogger
      )
      expect(mockLogger.warn).toHaveBeenCalled()
      expect(filter.event_format).toBe('client')
    })

    it('it should log a warning when creating a filter with an invalid event field', () => {
      const filter = new Filter(
        {
          event_fields: ['invalid', 'm.room.wrongField']
        },
        mockLogger
      )
      expect(mockLogger.warn).toHaveBeenCalled()
      expect(filter.event_fields).toEqual([])
    })

    describe('check', () => {
      describe('inner account_data filter', () => {
        it('should return true when the account_data filter matches the event', () => {
          const filter = new Filter({
            account_data: {
              types: ['m.push_rules']
            }
          })
          expect(
            filter.check({
              room_id: '!726s6s6q:example.com',
              event_id: '1234',
              content: {
                // insert tag content here
              },
              origin_server_ts: 0,
              type: 'm.push_rules',
              sender: '@alice:example.com'
            })
          ).toBe(true)
        })
        it('should return false when the account_data filter does not match the event', () => {
          const filter = new Filter({
            account_data: {
              not_types: ['m.push_rules']
            }
          })
          expect(
            filter.check({
              room_id: '!726s6s6q:example.com',
              event_id: '1234',
              content: {
                // insert tag content here
              },
              origin_server_ts: 0,
              type: 'm.push_rules',
              sender: '@alice:example.com'
            })
          ).toBe(false)
        })
      })
      describe('inner presence filter', () => {
        it('should return true when the presence filter matches the event', () => {
          const filter = new Filter({
            presence: {
              types: ['m.presence'],
              not_senders: ['@alice:example.com']
            }
          })
          expect(
            filter.check({
              room_id: '!726s6s6q:example.com',
              event_id: '1234',
              content: {
                // insert presence content here
              },
              origin_server_ts: 0,
              type: 'm.presence',
              sender: '@bob:example.com'
            })
          ).toBe(true)
        })
        it('should return false when the presence filter does not match the event', () => {
          const filter = new Filter({
            presence: {
              types: ['m.presence'],
              not_senders: ['@alice:example.com']
            }
          })
          expect(
            filter.check({
              room_id: '!726s6s6q:example.com',
              event_id: '1234',
              content: {
                // insert presence content here
              },
              origin_server_ts: 0,
              type: 'm.presence',
              sender: '@alice:example.com'
            })
          ).toBe(false)
        })
      })
      describe('inner room filter', () => {
        it('should return true when the room filter matches the event', () => {
          const filter = new Filter({
            room: {
              rooms: ['!726s6s6q:example.com'],
              timeline: {
                types: ['m.room.message'],
                not_senders: ['@alice:example.com']
              }
            }
          })
          expect(
            filter.check({
              room_id: '!726s6s6q:example.com',
              event_id: '1234',
              content: {
                // insert message content here
              },
              origin_server_ts: 0,
              type: 'm.room.message',
              sender: '@bob:example.com'
            })
          ).toBe(true)
        })
        it('should return false when the room filter does not match the event', () => {
          const filter = new Filter({
            room: {
              rooms: ['!726s6s6q:example.com'],
              timeline: {
                types: ['m.room.message'],
                not_senders: ['@alice:example.com']
              }
            }
          })
          expect(
            filter.check({
              room_id: '!726s6s6q:example.com',
              event_id: '1234',
              content: {
                // insert message content here
              },
              origin_server_ts: 0,
              type: 'm.room.message',
              sender: '@alice:example.com'
            })
          ).toBe(false)
          expect(
            filter.check({
              room_id: '!726s6s6q:example.com',
              event_id: '1234',
              content: {
                // insert message content here
              },
              origin_server_ts: 0,
              type: 'm.room.redaction',
              sender: '@bob:example.com'
            })
          ).toBe(false)
        })
      })
    })
  })

  describe('EventFilter', () => {
    it('should create a filter with the correct parameters', () => {
      const filter = new EventFilter({
        limit: 10,
        types: ['m.room.message'],
        not_types: ['m.room.member'],
        senders: ['@alice:example.com'],
        not_senders: ['@bob:example.com']
      })
      expect(filter.limit).toBe(10)
      expect(filter.types).toEqual(['m.room.message'])
      expect(filter.not_types).toEqual(['m.room.member'])
      expect(filter.senders).toEqual(['@alice:example.com'])
      expect(filter.not_senders).toEqual(['@bob:example.com'])
    })

    it('should set the default limit at 10', () => {
      const filter = new EventFilter({})
      expect(filter.limit).toBe(10)
    })

    it('should log a warning when creating a filter with a limit above the maximum limit', () => {
      const filter = new EventFilter({ limit: 100 }, mockLogger)
      expect(mockLogger.warn).toHaveBeenCalled()
      expect(filter.limit).toBe(MAX_LIMIT)
    })

    it('should log a warning when creating a filter with a limit below 1', () => {
      const filter = new EventFilter({ limit: 0 }, mockLogger)
      expect(mockLogger.warn).toHaveBeenCalled()
      expect(filter.limit).toBe(1)
    })

    it('should log a warning when creating a filter with an invalid type or not_type', () => {
      const filter = new EventFilter(
        {
          types: ['m.room.message', 'invalid']
        },
        mockLogger
      )
      expect(mockLogger.warn).toHaveBeenCalled()
      expect(filter.types).toEqual(['m.room.message'])

      const filter2 = new EventFilter(
        {
          not_types: ['m.room.message', 'invalid']
        },
        mockLogger
      )
      expect(mockLogger.warn).toHaveBeenCalled()
      expect(filter2.not_types).toEqual(['m.room.message'])
    })

    it('should log a warning when creating a filter with an invalid sender or not_sender', () => {
      const filter = new EventFilter(
        {
          senders: ['@alice:example.com', 'invalid']
        },
        mockLogger
      )
      expect(mockLogger.warn).toHaveBeenCalled()
      expect(filter.senders).toEqual(['@alice:example.com'])

      const filter2 = new EventFilter(
        {
          not_senders: ['@alice:example.com', 'invalid']
        },
        mockLogger
      )
      expect(mockLogger.warn).toHaveBeenCalled()
      expect(filter2.not_senders).toEqual(['@alice:example.com'])
    })

    describe('filtersAllTypes', () => {
      it('should return true when the filter filters all types', () => {
        const filter = new EventFilter({
          types: []
        })
        expect(filter.filtersAllTypes()).toBe(true)
        const filter2 = new EventFilter({
          not_types: ['*', 'm.room.member']
        })
        expect(filter2.filtersAllTypes()).toBe(true)
      })

      it('should return false when the filter does not filter all types', () => {
        const filter = new EventFilter({
          types: ['m.room.message']
        })
        expect(filter.filtersAllTypes()).toBe(false)
        const filter2 = new EventFilter({
          types: ['m.room.*']
        })
        expect(filter2.filtersAllTypes()).toBe(false)
      })
    })

    describe('filtersAllSenders', () => {
      it('should return true when the filter filters all senders', () => {
        const filter = new EventFilter({
          senders: []
        })
        expect(filter.filtersAllSenders()).toBe(true)
      })

      it('should return false when the filter does not filter all senders', () => {
        const filter = new EventFilter({
          senders: ['@alice:example.com', '@bob:example.com']
        })
        expect(filter.filtersAllSenders()).toBe(false)
      })
    })

    describe('get', () => {
      const filter = new EventFilter({
        senders: ['@alice:example.com', '@bob:example.com'],
        types: ['m.room.message', 'm.room.member']
      })
      it('should return the senders array', () => {
        // @ts-expect-error - Testing private method
        expect(filter.get('senders')).toEqual([
          '@alice:example.com',
          '@bob:example.com'
        ])
      })
      it('should return the types array', () => {
        // @ts-expect-error - Testing private method
        expect(filter.get('types')).toEqual(['m.room.message', 'm.room.member'])
      })
      it('should throw an error when the key is not found', () => {
        // @ts-expect-error - Testing private method
        expect(() => filter.get('not_senders')).toThrow(
          'Wrong element in get function of EventFilter'
        )
      })
      it('should return null when the field is not set', () => {
        const filter = new EventFilter({})
        // @ts-expect-error - Testing private method
        expect(filter.get('senders')).toBeNull()
        // @ts-expect-error - Testing private method
        expect(filter.get('types')).toBeNull()
      })
    })

    describe('getNot', () => {
      const filter = new EventFilter({
        not_senders: ['@alice:example.com', '@bob:example.com'],
        not_types: ['m.room.message', 'm.room.member']
      })
      it('should return the not_senders array', () => {
        // @ts-expect-error - Testing private method
        expect(filter.getNot('senders')).toEqual([
          '@alice:example.com',
          '@bob:example.com'
        ])
      })
      it('should return the not_types array', () => {
        // @ts-expect-error - Testing private method
        expect(filter.getNot('types')).toEqual([
          'm.room.message',
          'm.room.member'
        ])
      })
      it('should throw an error when the key is not found', () => {
        // @ts-expect-error - Testing private method
        expect(() => filter.getNot('not_senders')).toThrow(
          'Wrong element in getNot function of EventFilter'
        )
      })
      it('should return an empty array when the field is not set', () => {
        const filter = new EventFilter({})
        // @ts-expect-error - Testing private method
        expect(filter.getNot('senders')).toEqual([])
        // @ts-expect-error - Testing private method
        expect(filter.getNot('types')).toEqual([])
      })
    })

    describe('check', () => {
      const filter = new EventFilter({
        types: ['m.room.message', 'm.call.*'],
        senders: ['@alice:example.com']
      })
      it('should return true when the filter matches the event', () => {
        expect(
          filter.check({
            room_id: '!726s6s6q:example.com',
            event_id: '1234',
            content: {
              body: 'Hello, world!'
            },
            origin_server_ts: 0,
            type: 'm.room.message',
            sender: '@alice:example.com'
          })
        ).toBe(true)
      })
      it('should return true when the filter matches the event with a wildcard', () => {
        expect(
          filter.check({
            room_id: '!726s6s6q:example.com',
            event_id: '1234',
            content: {
              call_id: '1234'
            },
            origin_server_ts: 0,
            type: 'm.call.invite',
            sender: '@alice:example.com'
          })
        ).toBe(true)
      })
      it('should return false when the filter does not match the event', () => {
        expect(
          filter.check({
            room_id: '!726s6s6q:example.com',
            event_id: '1234',
            content: {
              membership: 'join'
            },
            origin_server_ts: 0,
            type: 'm.room.member',
            sender: '@alice:example.com'
          })
        ).toBe(false)
        expect(
          filter.check({
            room_id: '!726s6s6q:example.com',
            event_id: '1234',
            content: {
              body: 'Hello, world!'
            },
            origin_server_ts: 0,
            type: 'm.room.message',
            sender: '@bob:example.com'
          })
        ).toBe(false)
      })
    })
  })

  describe('RoomEventFilter', () => {
    it('should create a filter with the correct parameters', () => {
      const filter = new RoomEventFilter({
        limit: 10,
        types: ['m.room.message'],
        not_types: ['m.room.member'],
        senders: ['@alice:example.com'],
        not_senders: ['@bob:example.com'],
        not_rooms: ['!726s6s6q:example.com'],
        include_redundant_members: true,
        lazy_load_members: true
      })
      expect(filter.limit).toBe(10)
      expect(filter.types).toEqual(['m.room.message'])
      expect(filter.not_types).toEqual(['m.room.member'])
      expect(filter.senders).toEqual(['@alice:example.com'])
      expect(filter.not_senders).toEqual(['@bob:example.com'])
      expect(filter.not_rooms).toEqual(['!726s6s6q:example.com'])
      expect(filter.include_redundant_members).toBe(true)
      expect(filter.lazy_load_members).toBe(true)
    })

    it('should set include_redundant_members, lazy_load_members and unread_thread_notifications to false by default', () => {
      const filter = new RoomEventFilter({})
      expect(filter.include_redundant_members).toBe(false)
      expect(filter.lazy_load_members).toBe(false)
      expect(filter.unread_thread_notifications).toBe(false)
    })

    it('should set contains_url to undefined by default', () => {
      const filter = new RoomEventFilter({})
      expect(filter.contains_url).toBeUndefined()
    })

    it('should log a warning when creating a filter with an invalid room or not_room', () => {
      const filter = new RoomEventFilter(
        {
          rooms: ['726s6s6q:example.com']
        },
        mockLogger
      )
      expect(mockLogger.warn).toHaveBeenCalled()
      expect(filter.rooms).toEqual([])
      const filter2 = new RoomEventFilter(
        {
          not_rooms: ['726s6s6q:example.com']
        },
        mockLogger
      )
      expect(mockLogger.warn).toHaveBeenCalled()
      expect(filter2.not_rooms).toEqual([])
    })

    describe('get', () => {
      const filter = new RoomEventFilter({
        senders: ['@alice:example.com', '@bob:example.com'],
        types: ['m.room.message', 'm.room.member'],
        rooms: ['!726s6s6q:example.com']
      })
      it('should return the senders array', () => {
        // @ts-expect-error - Testing private method
        expect(filter.get('senders')).toEqual([
          '@alice:example.com',
          '@bob:example.com'
        ])
      })
      it('should return the types array', () => {
        // @ts-expect-error - Testing private method
        expect(filter.get('types')).toEqual(['m.room.message', 'm.room.member'])
      })
      it('should return the rooms array', () => {
        // @ts-expect-error - Testing private method
        expect(filter.get('rooms')).toEqual(['!726s6s6q:example.com'])
      })
      it('should throw an error when the key is not found', () => {
        // @ts-expect-error - Testing private method
        expect(() => filter.get('not_senders')).toThrow(
          'Wrong element in get function of RoomEventFilter'
        )
      })
      it('should return null when the field is not set', () => {
        const filter = new RoomEventFilter({})
        // @ts-expect-error - Testing private method
        expect(filter.get('senders')).toBeNull()
        // @ts-expect-error - Testing private method
        expect(filter.get('types')).toBeNull()
        // @ts-expect-error - Testing private method
        expect(filter.get('rooms')).toBeNull()
      })
    })

    describe('getNot', () => {
      const filter = new RoomEventFilter({
        not_senders: ['@alice:example.com', '@bob:example.com'],
        not_types: ['m.room.message', 'm.room.member'],
        not_rooms: ['!726s6s6q:example.com']
      })
      it('should return the not_senders array', () => {
        // @ts-expect-error - Testing private method
        expect(filter.getNot('senders')).toEqual([
          '@alice:example.com',
          '@bob:example.com'
        ])
      })
      it('should return the not_types array', () => {
        // @ts-expect-error - Testing private method
        expect(filter.getNot('types')).toEqual([
          'm.room.message',
          'm.room.member'
        ])
      })
      it('should return the not_rooms array', () => {
        // @ts-expect-error - Testing private method
        expect(filter.getNot('rooms')).toEqual(['!726s6s6q:example.com'])
      })
      it('should throw an error when the key is not found', () => {
        // @ts-expect-error - Testing private method
        expect(() => filter.getNot('not_senders')).toThrow(
          'Wrong element in getNot function of RoomEventFilter'
        )
      })
      it('should return an empty array when the field is not set', () => {
        const filter = new RoomEventFilter({})
        // @ts-expect-error - Testing private method
        expect(filter.getNot('senders')).toEqual([])
        // @ts-expect-error - Testing private method
        expect(filter.getNot('types')).toEqual([])
        // @ts-expect-error - Testing private method
        expect(filter.getNot('rooms')).toEqual([])
      })
    })

    describe('check', () => {
      it('should return true when the filter matches the event', () => {
        const filter = new RoomEventFilter({
          types: ['m.room.message', 'm.call.*'],
          senders: ['@alice:example.com'],
          rooms: ['!726s6s6q:example.com']
        })
        expect(
          filter.check({
            room_id: '!726s6s6q:example.com',
            event_id: '1234',
            content: {
              body: 'Hello, world!'
            },
            origin_server_ts: 0,
            type: 'm.room.message',
            sender: '@alice:example.com'
          })
        ).toBe(true)
      })
      it('should return true when the filter matches the event with a wildcard', () => {
        const filter = new RoomEventFilter({
          types: ['m.room.message', 'm.call.*'],
          senders: ['@alice:example.com'],
          rooms: ['!726s6s6q:example.com']
        })
        expect(
          filter.check({
            room_id: '!726s6s6q:example.com',
            event_id: '1234',
            content: {
              call_id: '1234'
            },
            origin_server_ts: 0,
            type: 'm.call.invite',
            sender: '@alice:example.com'
          })
        ).toBe(true)
      })
      it('should return false when the filter does not match the event', () => {
        const filter = new RoomEventFilter({
          types: ['m.room.message', 'm.call.*'],
          senders: ['@alice:example.com'],
          rooms: ['!726s6s6q:example.com']
        })
        expect(
          filter.check({
            room_id: '!726s6s6q:example.com',
            event_id: '1234',
            content: {
              membership: 'join'
            },
            origin_server_ts: 0,
            type: 'm.room.member',
            sender: '@alice:example.com'
          })
        ).toBe(false)
        expect(
          filter.check({
            room_id: '!726s6s6q:example.com',
            event_id: '1234',
            content: {
              body: 'Hello, world!'
            },
            origin_server_ts: 0,
            type: 'm.room.message',
            sender: '@bob:example.com'
          })
        ).toBe(false)
        expect(
          filter.check({
            room_id: '!wrongroom:example.com',
            event_id: '1234',
            content: {
              body: 'Hello, world!'
            },
            origin_server_ts: 0,
            type: 'm.room.message',
            sender: '@alice:example.com'
          })
        ).toBe(false)
      })
      it('should return true when the contains_url condition match the event', () => {
        const filter = new RoomEventFilter({
          contains_url: true
        })
        expect(
          filter.check({
            room_id: '!726s6s6q:example.com',
            event_id: '1234',
            content: {
              body: 'Hello, world!',
              url: 'https://example.com'
            },
            origin_server_ts: 0,
            type: 'm.room.message',
            sender: '@alice:example.com'
          })
        ).toBe(true)
        const filter2 = new RoomEventFilter({
          contains_url: false
        })
        expect(
          filter2.check({
            room_id: '!726s6s6q:example.com',
            event_id: '1234',
            content: {
              body: 'Hello, world!'
            },
            origin_server_ts: 0,
            type: 'm.room.message',
            sender: '@alice:example.com'
          })
        ).toBe(true)
      })
      it('should return false when the contains_url condition does not match the event', () => {
        const filter = new RoomEventFilter({
          contains_url: true
        })
        expect(
          filter.check({
            room_id: '!726s6s6q:example.com',
            event_id: '1234',
            content: {
              body: 'Hello, world!'
            },
            origin_server_ts: 0,
            type: 'm.room.message',
            sender: '@alice:example.com'
          })
        ).toBe(false)
        const filter2 = new RoomEventFilter({
          contains_url: false
        })
        expect(
          filter2.check({
            room_id: '!726s6s6q:example.com',
            event_id: '1234',
            content: {
              body: 'Hello, world!',
              url: 'https://example.com'
            },
            origin_server_ts: 0,
            type: 'm.room.message',
            sender: '@alice:example.com'
          })
        ).toBe(false)
      })
      it('should return true when the filter includes_redundant_members, accepts lazy_loading_members and the event is a membership event', () => {
        const filter = new RoomEventFilter({
          lazy_load_members: true,
          include_redundant_members: true
        })
        expect(
          filter.check({
            room_id: '!726s6s6q:example.com',
            event_id: '1234',
            content: {
              membership: 'join'
            },
            origin_server_ts: 0,
            type: 'm.room.member',
            sender: '@alice:example.com'
          })
        ).toBe(true)
      })
    })
  })

  describe('RoomFilter', () => {
    it('should create a filter with the correct parameters', () => {
      const filter = new RoomFilter({
        ephemeral: {
          limit: 10,
          types: ['m.receipt', 'm.typing'],
          not_rooms: ['!726s6s6q:example.com'],
          not_senders: ['@spam:example.com']
        },
        state: {
          types: ['m.room.*'],
          not_rooms: ['!726s6s6q:example.com']
        },
        rooms: ['!726s6s6q:example.com'],
        include_leave: true
      })
      expect(filter.ephemeral?.limit).toBe(10)
      expect(filter.ephemeral?.types).toEqual(['m.receipt', 'm.typing'])
      expect(filter.ephemeral?.not_rooms).toEqual(['!726s6s6q:example.com'])
      expect(filter.ephemeral?.not_senders).toEqual(['@spam:example.com'])
      expect(filter.state?.types).toEqual(['m.room.*'])
      expect(filter.state?.not_rooms).toEqual(['!726s6s6q:example.com'])
      expect(filter.rooms).toEqual(['!726s6s6q:example.com'])
      expect(filter.include_leave).toBe(true)
    })

    it('should set include_leave to false by default', () => {
      const filter = new RoomFilter({})
      expect(filter.include_leave).toBe(false)
    })

    it('should not create empty filters when not needed', () => {
      const filter = new RoomFilter({})
      expect(filter.ephemeral).toBeUndefined()
      expect(filter.state).toBeUndefined()
      expect(filter.account_data).toBeUndefined()
      expect(filter.timeline).toBeUndefined()
    })

    it('should log a warning when creating a filter with an invalid room or not_room', () => {
      const filter = new RoomFilter(
        {
          rooms: ['726s6s6q:example.com']
        },
        mockLogger
      )
      expect(mockLogger.warn).toHaveBeenCalled()
      expect(filter.rooms).toEqual([])
      const filter2 = new RoomFilter(
        {
          not_rooms: ['726s6s6q:example.com']
        },
        mockLogger
      )
      expect(mockLogger.warn).toHaveBeenCalled()
      expect(filter2.not_rooms).toEqual([])
    })

    describe('get', () => {
      it('should return the rooms array', () => {
        const filter = new RoomFilter({
          rooms: ['!726s6s6q:example.com']
        })
        // @ts-expect-error - Testing private method
        expect(filter.get('rooms')).toEqual(['!726s6s6q:example.com'])
      })
      it('should throw an error when the key is not found', () => {
        const filter = new RoomFilter({})
        // @ts-expect-error - Testing private method
        expect(() => filter.get('not_rooms')).toThrow(
          'Wrong element in get function of RoomFilter'
        )
      })
      it('should return null when the field is not set', () => {
        const filter = new RoomFilter({})
        // @ts-expect-error - Testing private method
        expect(filter.get('rooms')).toBeNull()
      })
    })
    describe('getNot', () => {
      it('should return the not_rooms array', () => {
        const filter = new RoomFilter({
          not_rooms: ['!726s6s6q:example.com']
        })
        // @ts-expect-error - Testing private method
        expect(filter.getNot('rooms')).toEqual(['!726s6s6q:example.com'])
      })
      it('should throw an error when the key is not found', () => {
        const filter = new RoomFilter({})
        // @ts-expect-error - Testing private method
        expect(() => filter.getNot('not_rooms')).toThrow(
          'Wrong element in getNot function of RoomFilter'
        )
      })
      it('should return an empty array when the field is not set', () => {
        const filter = new RoomFilter({})
        // @ts-expect-error - Testing private method
        expect(filter.getNot('rooms')).toEqual([])
      })
    })
    describe('check', () => {
      it('should return true when the filter matches the event', () => {
        const filter = new RoomFilter({
          rooms: ['!726s6s6q:example.com']
        })
        expect(
          filter.check({
            room_id: '!726s6s6q:example.com',
            event_id: '1234',
            content: {
              body: 'Hello, world!'
            },
            origin_server_ts: 0,
            type: 'm.room.message',
            sender: '@alice:example.com'
          })
        ).toBe(true)
      })
      it('should return false when the filter does not match the event', () => {
        const filter = new RoomFilter({
          rooms: ['!726s6s6q:example.com']
        })
        expect(
          filter.check({
            room_id: '!wrongroom:example.com',
            event_id: '1234',
            content: {
              body: 'Hello, world!'
            },
            origin_server_ts: 0,
            type: 'm.room.message',
            sender: '@alice:example.com'
          })
        ).toBe(false)
      })
      describe('inner account_data filter', () => {
        it('should return true when the account_data filter matches the event', () => {
          const filter = new RoomFilter({
            account_data: {
              limit: 10,
              types: ['m.tag']
            }
          })
          expect(
            filter.check({
              room_id: '!726s6s6q:example.com',
              event_id: '1234',
              content: {
                // insert tag content here
              },
              origin_server_ts: 0,
              type: 'm.tag',
              sender: '@alice:example.com'
            })
          ).toBe(true)
        })
        it('should return false when the account_data filter does not match the event', () => {
          const filter = new RoomFilter({
            account_data: {
              limit: 10,
              not_types: ['m.tag']
            }
          })
          expect(
            filter.check({
              room_id: '!726s6s6q:example.com',
              event_id: '1234',
              content: {
                // insert tag content here
              },
              origin_server_ts: 0,
              type: 'm.tag',
              sender: '@alice:example.com'
            })
          ).toBe(false)
        })
      })
      describe('inner presence filter', () => {
        it('should return true when the ephemeral filter matches the event', () => {
          const filter = new RoomFilter({
            ephemeral: {
              limit: 10,
              types: ['m.receipt', 'm.typing'],
              rooms: ['!726s6s6q:example.com'],
              not_senders: ['@spam:example.com']
            }
          })
          expect(
            filter.check({
              room_id: '!726s6s6q:example.com',
              event_id: '1234',
              content: {
                // insert receipt content here
              },
              origin_server_ts: 0,
              type: 'm.receipt',
              sender: '@alice:example.com'
            })
          ).toBe(true)
        })
        it('should return false when the ephemeral filter does not match the event', () => {
          const filter = new RoomFilter({
            ephemeral: {
              limit: 10,
              types: ['m.receipt', 'm.typing'],
              not_rooms: ['!726s6s6q:example.com'],
              not_senders: ['@spam:example.com']
            }
          })
          expect(
            filter.check({
              room_id: '!726s6s6q:example.com',
              event_id: '1234',
              content: {
                // insert receipt content here
              },
              origin_server_ts: 0,
              type: 'm.receipt',
              sender: '@spam:example.com'
            })
          ).toBe(false)
          expect(
            filter.check({
              room_id: '!726s6s6q:example.com',
              event_id: '1234',
              content: {
                // insert receipt content here
              },
              origin_server_ts: 0,
              type: 'm.presence',
              sender: '@spam:example2.com'
            })
          ).toBe(false)
        })
      })
      describe('inner state filter', () => {
        it('should return true when the state filter matches the event', () => {
          const filter = new RoomFilter({
            state: {
              types: ['m.room.*'],
              rooms: ['!726s6s6q:example.com']
            }
          })
          expect(
            filter.check({
              room_id: '!726s6s6q:example.com',
              event_id: '1234',
              content: {
                // insert state content here
              },
              origin_server_ts: 0,
              type: 'm.room.name',
              sender: '@alice:example.com'
            })
          ).toBe(true)
        })
        it('should return false when the state filter does not match the event', () => {
          const filter = new RoomFilter({
            state: {
              types: ['m.room.n*'],
              rooms: ['!726s6s6q:example.com'],
              not_senders: ['@spam:example.com']
            }
          })
          expect(
            filter.check({
              room_id: '!726s6s6q:example.com',
              event_id: '1234',
              content: {
                // insert state content here
              },
              origin_server_ts: 0,
              type: 'm.room.name',
              sender: '@spam:example.com'
            })
          ).toBe(false)
          expect(
            filter.check({
              room_id: '!726s6s6q:example.com',
              event_id: '1234',
              content: {
                // insert state content here
              },
              origin_server_ts: 0,
              type: 'm.room.member',
              sender: '@alice:example.com'
            })
          ).toBe(false)
        })
      })
      describe('inner timeline filter', () => {
        it('should return true when the timeline filter matches the event', () => {
          const filter = new RoomFilter({
            timeline: {
              limit: 10,
              types: ['m.room.message'],
              rooms: ['!726s6s6q:example.com'],
              not_senders: ['@spam:example.com']
            }
          })
          expect(
            filter.check({
              room_id: '!726s6s6q:example.com',
              event_id: '1234',
              content: {
                body: 'Hello, world!'
              },
              origin_server_ts: 0,
              type: 'm.room.message',
              sender: '@alice:example.com'
            })
          ).toBe(true)
        })
        it('should return false when the timeline filter does not match the event', () => {
          const filter = new RoomFilter({
            timeline: {
              limit: 10,
              types: ['m.room.message'],
              not_rooms: ['!726s6s6q:example.com'],
              not_senders: ['@spam:example.com']
            }
          })
          expect(
            filter.check({
              room_id: '!726s6s6q:example.com',
              event_id: '1234',
              content: {
                body: 'Hello, world!'
              },
              origin_server_ts: 0,
              type: 'm.room.message',
              sender: '@spam:example.com'
            })
          ).toBe(false)
          expect(
            filter.check({
              room_id: '!726s6s6q:example.com',
              event_id: '1234',
              content: {
                body: 'Hello, world!'
              },
              origin_server_ts: 0,
              type: 'm.room.message',
              sender: '@alice:example.com'
            })
          ).toBe(false)
        })
      })

      it('should throw an error if the event type is not a room event', () => {
        const filter = new RoomFilter({})
        expect(() =>
          filter.check({
            room_id: '!726s6s6q:example.com',
            event_id: '1234',
            content: {
              body: 'Hello, world!'
            },
            origin_server_ts: 0,
            type: 'm.unknownType',
            sender: '@alice:example.com'
          })
        ).toThrow('Wrong event type in getType')
      })
    })
  })

  describe('_matchesWildcard', () => {
    it('should return true for a wildcard', () => {
      expect(_matchesWildcard('m.room', 'm.room')).toBe(true)
    })

    it('should return true for a wildcard with a suffix', () => {
      expect(_matchesWildcard('m.room.message', 'm.room.*')).toBe(true)
      expect(_matchesWildcard('m.room.message', 'm.room*')).toBe(true)
    })

    it('should return false for a mismatch', () => {
      expect(_matchesWildcard('m.room.message', 'm.room.member')).toBe(false)
      expect(_matchesWildcard('m.room.message', 'm.room')).toBe(false)
    })
  })
})
