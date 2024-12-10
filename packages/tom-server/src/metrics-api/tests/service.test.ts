import { type TwakeLogger } from '@twake/logger'
import Service from '../services'
import { type MatrixDBBackend } from '@twake/matrix-identity-server'

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
  avatar_url: '',
  creation_ts: 1,
  displayname: 'user 1',
  last_seen_ts: new Date().getTime(),
  name: 'user1'
}

const PRE_TODAY_USER = {
  avatar_url: '',
  creation_ts: 1,
  displayname: 'user 1',
  last_seen_ts: new Date().getTime() - ONE_DAY_IN_MS - 1,
  name: 'user2'
}

const PRE_WEEK_USER = {
  avatar_url: '',
  creation_ts: 1,
  displayname: 'user 2',
  last_seen_ts: new Date().getTime() - ONE_WEEK_IN_MS - 1,
  name: 'user3'
}

const PRE_MONTH_USER = {
  avatar_url: '',
  creation_ts: 1,
  displayname: 'user 3',
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

      const result = await metricsService.getUserActivityStats()

      expect(result).toEqual({
        dailyActiveUsers: [TODAY_USER],
        weeklyActiveUsers: [TODAY_USER],
        monthlyActiveUsers: [TODAY_USER],
        weeklyNewUsers: [],
        monthlyNewUsers: []
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

      const result = await metricsService.getUserActivityStats()

      expect(result).toEqual({
        dailyActiveUsers: [TODAY_USER],
        weeklyActiveUsers: [TODAY_USER, PRE_TODAY_USER],
        monthlyActiveUsers: [TODAY_USER, PRE_TODAY_USER],
        weeklyNewUsers: [],
        monthlyNewUsers: []
      })
    })

    it('should return only weekly active users', async () => {
      dbMock.getAll.mockResolvedValue([
        TODAY_USER,
        PRE_TODAY_USER,
        PRE_WEEK_USER
      ])

      const result = await metricsService.getUserActivityStats()

      expect(result).toEqual({
        dailyActiveUsers: [TODAY_USER],
        weeklyActiveUsers: [TODAY_USER, PRE_TODAY_USER],
        monthlyActiveUsers: [TODAY_USER, PRE_TODAY_USER, PRE_WEEK_USER],
        weeklyNewUsers: [],
        monthlyNewUsers: []
      })
    })

    it('should return only monthly active users', async () => {
      dbMock.getAll.mockResolvedValue([
        TODAY_USER,
        PRE_TODAY_USER,
        PRE_WEEK_USER,
        PRE_MONTH_USER
      ])

      const result = await metricsService.getUserActivityStats()

      expect(result).toEqual({
        dailyActiveUsers: [TODAY_USER],
        weeklyActiveUsers: [TODAY_USER, PRE_TODAY_USER],
        monthlyActiveUsers: [TODAY_USER, PRE_TODAY_USER, PRE_WEEK_USER],
        weeklyNewUsers: [],
        monthlyNewUsers: []
      })
    })
  })

  describe('the getUserMessageStats function', () => {
    it('should attempts to get user message stats', async () => {
      dbMock.getAll.mockResolvedValue([TODAY_USER])
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
      dbMock.get.mockResolvedValue([])

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
