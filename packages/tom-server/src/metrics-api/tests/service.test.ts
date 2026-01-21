import { type TwakeLogger } from '@twake-chat/logger'
import Service from '../services/index.ts'
import { type MatrixDBBackend } from '@twake-chat/matrix-identity-server'

const dbMock = {
  get: jest.fn(),
  getAll: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  deleteEqual: jest.fn(),
  getCount: jest.fn()
}

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000
const ONE_WEEK_IN_MS = 7 * ONE_DAY_IN_MS
const ONE_MONTH_IN_MS = 30 * ONE_DAY_IN_MS

const TODAY_USER = {
  creation_ts: new Date().getTime() / 1000,
  last_seen_ts: new Date().getTime(),
  name: 'user1'
}

const PRE_TODAY_USER = {
  creation_ts: (new Date().getTime() - ONE_DAY_IN_MS - 1) / 1000,
  last_seen_ts: new Date().getTime() - ONE_DAY_IN_MS - 1,
  name: 'user2'
}

const PRE_WEEK_USER = {
  creation_ts: (new Date().getTime() - ONE_WEEK_IN_MS - 1) / 1000,
  last_seen_ts: new Date().getTime() - ONE_WEEK_IN_MS - 1,
  name: 'user3'
}

const PRE_MONTH_USER = {
  creation_ts: (new Date().getTime() - ONE_MONTH_IN_MS - 1) / 1000,
  last_seen_ts: new Date().getTime() - ONE_MONTH_IN_MS - 1,
  name: 'user4'
}

const messages = [
  {
    sender: 'user1',
    type: 'm.room.message',
    origin_server_ts: 1,
    content: {
      body: 'message 1'
    }
  },
  {
    sender: 'user1',
    type: 'm.room.message',
    origin_server_ts: 1,
    content: {
      body: 'message 3'
    }
  },
  {
    sender: 'user1',
    type: 'm.room.message',
    origin_server_ts: 1,
    content: {
      body: 'message 4'
    }
  }
]

afterEach(() => {
  jest.restoreAllMocks()
})

describe('the Metrics API Service', () => {
  const metricsService = new Service(
    dbMock as unknown as MatrixDBBackend,
    loggerMock as unknown as TwakeLogger
  )

  describe('the getUserActivityStats function', () => {
    it('should attempts to get user activity stats', async () => {
      dbMock.getAll.mockResolvedValue([TODAY_USER])
      dbMock.get.mockImplementation(
        async (
          _table: string,
          _fields: string[],
          filters: Record<string, string | number>
        ) => {
          return await Promise.resolve([
            {
              user_id: TODAY_USER.name,
              last_seen: TODAY_USER.last_seen_ts
            }
          ])
        }
      )

      const result = await metricsService.getUserActivityStats()

      expect(result).toEqual({
        dailyActiveUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 }
        ],
        weeklyActiveUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 }
        ],
        monthlyActiveUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 }
        ],
        weeklyNewUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 }
        ],
        monthlyNewUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 }
        ]
      })
    })

    it('should return empty arrays if no users are found', async () => {
      dbMock.getAll.mockResolvedValue([])

      const result = await metricsService.getUserActivityStats()

      expect(result).toEqual({
        dailyActiveUsers: [],
        weeklyActiveUsers: [],
        monthlyActiveUsers: [],
        weeklyNewUsers: [],
        monthlyNewUsers: []
      })
    })

    it('should return only today active users', async () => {
      dbMock.getAll.mockResolvedValue([TODAY_USER, PRE_TODAY_USER])
      dbMock.get.mockImplementation(
        async (
          _table: string,
          _fields: string[],
          filters: Record<string, string | number>
        ) => {
          switch (filters.user_id) {
            case TODAY_USER.name:
              return await Promise.resolve([
                {
                  user_id: TODAY_USER.name,
                  last_seen: TODAY_USER.last_seen_ts
                }
              ])
            case PRE_TODAY_USER.name:
              return await Promise.resolve([
                {
                  user_id: PRE_TODAY_USER.name,
                  last_seen: PRE_TODAY_USER.last_seen_ts
                }
              ])
          }
        }
      )

      const result = await metricsService.getUserActivityStats()

      expect(result).toEqual({
        dailyActiveUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 }
        ],
        weeklyActiveUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 },
          { ...PRE_TODAY_USER, creation_ts: PRE_TODAY_USER.creation_ts * 1000 }
        ],
        monthlyActiveUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 },
          { ...PRE_TODAY_USER, creation_ts: PRE_TODAY_USER.creation_ts * 1000 }
        ],
        weeklyNewUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 },
          { ...PRE_TODAY_USER, creation_ts: PRE_TODAY_USER.creation_ts * 1000 }
        ],
        monthlyNewUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 },
          { ...PRE_TODAY_USER, creation_ts: PRE_TODAY_USER.creation_ts * 1000 }
        ]
      })
    })

    it('should return only weekly active users', async () => {
      dbMock.getAll.mockResolvedValue([
        TODAY_USER,
        PRE_TODAY_USER,
        PRE_WEEK_USER
      ])

      dbMock.get.mockImplementation(
        async (
          _table: string,
          _fields: string[],
          filters: Record<string, string | number>
        ) => {
          switch (filters.user_id) {
            case TODAY_USER.name:
              return await Promise.resolve([
                {
                  user_id: TODAY_USER.name,
                  last_seen: TODAY_USER.last_seen_ts
                }
              ])
            case PRE_TODAY_USER.name:
              return await Promise.resolve([
                {
                  user_id: PRE_TODAY_USER.name,
                  last_seen: PRE_TODAY_USER.last_seen_ts
                }
              ])
            case PRE_WEEK_USER.name:
              return await Promise.resolve([
                {
                  user_id: PRE_WEEK_USER.name,
                  last_seen: PRE_WEEK_USER.last_seen_ts
                }
              ])
          }
        }
      )

      const result = await metricsService.getUserActivityStats()

      expect(result).toEqual({
        dailyActiveUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 }
        ],
        weeklyActiveUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 },
          { ...PRE_TODAY_USER, creation_ts: PRE_TODAY_USER.creation_ts * 1000 }
        ],
        monthlyActiveUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 },
          { ...PRE_TODAY_USER, creation_ts: PRE_TODAY_USER.creation_ts * 1000 },
          { ...PRE_WEEK_USER, creation_ts: PRE_WEEK_USER.creation_ts * 1000 }
        ],
        weeklyNewUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 },
          { ...PRE_TODAY_USER, creation_ts: PRE_TODAY_USER.creation_ts * 1000 }
        ],
        monthlyNewUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 },
          { ...PRE_TODAY_USER, creation_ts: PRE_TODAY_USER.creation_ts * 1000 },
          { ...PRE_WEEK_USER, creation_ts: PRE_WEEK_USER.creation_ts * 1000 }
        ]
      })
    })

    it('should return only monthly active users', async () => {
      dbMock.getAll.mockResolvedValue([
        TODAY_USER,
        PRE_TODAY_USER,
        PRE_WEEK_USER,
        PRE_MONTH_USER
      ])

      dbMock.get.mockImplementation(
        async (
          _table: string,
          _fields: string[],
          filters: Record<string, string | number>
        ) => {
          switch (filters.user_id) {
            case TODAY_USER.name:
              return await Promise.resolve([
                {
                  user_id: TODAY_USER.name,
                  last_seen: TODAY_USER.last_seen_ts
                }
              ])
            case PRE_TODAY_USER.name:
              return await Promise.resolve([
                {
                  user_id: PRE_TODAY_USER.name,
                  last_seen: PRE_TODAY_USER.last_seen_ts
                }
              ])
            case PRE_WEEK_USER.name:
              return await Promise.resolve([
                {
                  user_id: PRE_WEEK_USER.name,
                  last_seen: PRE_WEEK_USER.last_seen_ts
                }
              ])
            case PRE_MONTH_USER.name:
              return await Promise.resolve([
                {
                  user_id: PRE_MONTH_USER.name,
                  last_seen: PRE_MONTH_USER.last_seen_ts
                }
              ])
          }
        }
      )

      const result = await metricsService.getUserActivityStats()

      expect(result).toEqual({
        dailyActiveUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 }
        ],
        weeklyActiveUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 },
          { ...PRE_TODAY_USER, creation_ts: PRE_TODAY_USER.creation_ts * 1000 }
        ],
        monthlyActiveUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 },
          { ...PRE_TODAY_USER, creation_ts: PRE_TODAY_USER.creation_ts * 1000 },
          { ...PRE_WEEK_USER, creation_ts: PRE_WEEK_USER.creation_ts * 1000 }
        ],
        weeklyNewUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 },
          { ...PRE_TODAY_USER, creation_ts: PRE_TODAY_USER.creation_ts * 1000 }
        ],
        monthlyNewUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 },
          { ...PRE_TODAY_USER, creation_ts: PRE_TODAY_USER.creation_ts * 1000 },
          { ...PRE_WEEK_USER, creation_ts: PRE_WEEK_USER.creation_ts * 1000 }
        ]
      })
    })

    it('should return the weekly and monthly new users list', async () => {
      dbMock.getAll.mockResolvedValue([
        TODAY_USER,
        PRE_TODAY_USER,
        PRE_WEEK_USER,
        PRE_MONTH_USER
      ])

      dbMock.get.mockImplementation(
        async (
          _table: string,
          _fields: string[],
          filters: Record<string, string | number>
        ) => {
          switch (filters.user_id) {
            case TODAY_USER.name:
              return await Promise.resolve([
                {
                  user_id: TODAY_USER.name,
                  last_seen: TODAY_USER.last_seen_ts
                }
              ])
            case PRE_TODAY_USER.name:
              return await Promise.resolve([
                {
                  user_id: PRE_TODAY_USER.name,
                  last_seen: PRE_TODAY_USER.last_seen_ts
                }
              ])
            case PRE_WEEK_USER.name:
              return await Promise.resolve([
                {
                  user_id: PRE_WEEK_USER.name,
                  last_seen: PRE_WEEK_USER.last_seen_ts
                }
              ])
            case PRE_MONTH_USER.name:
              return await Promise.resolve([
                {
                  user_id: PRE_MONTH_USER.name,
                  last_seen: PRE_MONTH_USER.last_seen_ts
                }
              ])
          }
        }
      )

      const result = await metricsService.getUserActivityStats()

      expect(result).toEqual({
        dailyActiveUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 }
        ],
        weeklyActiveUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 },
          { ...PRE_TODAY_USER, creation_ts: PRE_TODAY_USER.creation_ts * 1000 }
        ],
        monthlyActiveUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 },
          { ...PRE_TODAY_USER, creation_ts: PRE_TODAY_USER.creation_ts * 1000 },
          { ...PRE_WEEK_USER, creation_ts: PRE_WEEK_USER.creation_ts * 1000 }
        ],
        weeklyNewUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 },
          { ...PRE_TODAY_USER, creation_ts: PRE_TODAY_USER.creation_ts * 1000 }
        ],
        monthlyNewUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 },
          { ...PRE_TODAY_USER, creation_ts: PRE_TODAY_USER.creation_ts * 1000 },
          { ...PRE_WEEK_USER, creation_ts: PRE_WEEK_USER.creation_ts * 1000 }
        ]
      })
    })
  })

  describe('the getUserMessageStats function', () => {
    it('should attempts to get user message stats', async () => {
      dbMock.getAll.mockResolvedValue([TODAY_USER])
      dbMock.get.mockImplementation(async (table: string) => {
        if (table === 'events') {
          return messages
        }
        return await Promise.resolve([
          {
            user_id: TODAY_USER.name,
            last_seen: TODAY_USER.last_seen_ts
          }
        ])
      })

      dbMock.get.mockResolvedValue(messages)

      const result = await metricsService.getUserMessageStats()

      expect(result).toEqual([
        {
          user_id: 'user1',
          message_count: 3
        }
      ])
    })

    it('should return empty array if no users found', async () => {
      dbMock.getAll.mockResolvedValue([])

      const result = await metricsService.getUserMessageStats()

      expect(result).toEqual([])
    })

    it('should return zero message count for users with no messages', async () => {
      dbMock.getAll.mockResolvedValue([TODAY_USER])
      dbMock.get.mockImplementation(async (table: string) => {
        if (table === 'events') {
          return []
        }
        return await Promise.resolve([
          {
            user_id: TODAY_USER.name,
            last_seen: TODAY_USER.last_seen_ts
          }
        ])
      })

      const result = await metricsService.getUserMessageStats()

      expect(result).toEqual([
        {
          user_id: 'user1',
          message_count: 0
        }
      ])
    })

    it('should count messages correctly for multiple users', async () => {
      dbMock.getAll.mockResolvedValue([TODAY_USER, PRE_TODAY_USER])
      dbMock.get
        .mockResolvedValueOnce(messages) // For first user
        .mockResolvedValueOnce([messages[0]]) // For second user

      dbMock.get.mockImplementation(
        async (
          table: string,
          _fields: string[],
          filters: Record<string, string | number>
        ) => {
          if (table === 'events') {
            return filters.sender === 'user1' ? messages : [messages[0]]
          }

          switch (filters.user_id) {
            case TODAY_USER.name:
              return await Promise.resolve([
                {
                  user_id: TODAY_USER.name,
                  last_seen: TODAY_USER.last_seen_ts
                }
              ])
            case PRE_TODAY_USER.name:
              return await Promise.resolve([
                {
                  user_id: PRE_TODAY_USER.name,
                  last_seen: PRE_TODAY_USER.last_seen_ts
                }
              ])
          }
        }
      )

      const result = await metricsService.getUserMessageStats()

      expect(result).toEqual([
        {
          user_id: 'user1',
          message_count: 3
        },
        {
          user_id: 'user2',
          message_count: 1
        }
      ])
    })

    it('should handle errors when getting messages', async () => {
      dbMock.getAll.mockResolvedValue([TODAY_USER])
      dbMock.get.mockRejectedValue(new Error('DB Error'))

      await expect(metricsService.getUserMessageStats()).rejects.toThrow(
        'Failed to fetch user message count'
      )
    })
  })
})
