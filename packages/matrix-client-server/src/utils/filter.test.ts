import { Filter } from './filter'

describe('Filter', () => {
  describe('Filter creation', () => {
    it('should create a filter with the correct parameters', () => {
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
        senders: [],
        not_senders: ['@alice:example.com'],
        types: ['m.presence'],
        not_types: []
      })
      console.log(filter.room)
      expect(filter.room?.ephemeral?.not_rooms).toEqual([
        '!726s6s6q:example.com'
      ])
      expect(filter.room?.state?.types).toEqual(['m.room.*'])
    })
  })
})
