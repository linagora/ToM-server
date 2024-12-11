import bodyParser from 'body-parser'
import express, { type NextFunction, type Response } from 'express'
import supertest from 'supertest'
import type { AuthRequest, Config } from '../../types'
import router, { PATH } from '../routes'
import type { TwakeLogger } from '@twake/logger'
import { type MatrixDBBackend } from '@twake/matrix-identity-server'
import { type UserMessageCount, type MatrixUserInfo } from '../types'

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000
const ONE_WEEK_IN_MS = 7 * ONE_DAY_IN_MS
const ONE_MONTH_IN_MS = 30 * ONE_DAY_IN_MS

const TODAY_USER = {
  creation_ts: 1,
  last_seen_ts: new Date().getTime(),
  name: 'user1'
} satisfies MatrixUserInfo

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

const app = express()

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

const authenticatorMock = jest
  .fn()
  .mockImplementation((_req, _res, callbackMethod) => {
    callbackMethod('test', 'test')
  })

jest.mock('../middlewares/index.ts', () => {
  const passiveMiddlewareMock = (
    _req: AuthRequest,
    _res: Response,
    next: NextFunction
  ): void => {
    next()
  }

  return function () {
    return {
      checkPermissions: passiveMiddlewareMock
    }
  }
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(
  router(
    {} as unknown as Config,
    dbMock as unknown as MatrixDBBackend,
    authenticatorMock,
    loggerMock as unknown as TwakeLogger
  )
)

describe('the mectrics API controller', () => {
  describe('the getActivityStats handler', () => {
    it('should try to fetch the user activity metrics', async () => {
      dbMock.getAll.mockResolvedValue([TODAY_USER])
      dbMock.get.mockImplementation(async () => {
        return await Promise.resolve([
          {
            user_id: TODAY_USER.name,
            last_seen: TODAY_USER.last_seen_ts
          }
        ])
      })

      const response = await supertest(app).get(`${PATH}/activity`).send()

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
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

    it('should calculate daily active users correctly', async () => {
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
      const response = await supertest(app).get(`${PATH}/activity`).send()

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
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

    it('should calculate weekly active users correctly', async () => {
      dbMock.getAll.mockResolvedValue([TODAY_USER, PRE_WEEK_USER])
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

      const response = await supertest(app).get(`${PATH}/activity`).send()

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        dailyActiveUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 }
        ],
        weeklyActiveUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 }
        ],
        monthlyActiveUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 },
          { ...PRE_WEEK_USER, creation_ts: PRE_WEEK_USER.creation_ts * 1000 }
        ],
        weeklyNewUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 }
        ],
        monthlyNewUsers: [
          { ...TODAY_USER, creation_ts: TODAY_USER.creation_ts * 1000 },
          { ...PRE_WEEK_USER, creation_ts: PRE_WEEK_USER.creation_ts * 1000 }
        ]
      })
    })

    it('should calculate monthly active users correctly', async () => {
      dbMock.getAll.mockResolvedValue([PRE_WEEK_USER, PRE_MONTH_USER])
      dbMock.get.mockImplementation(
        async (
          _table: string,
          _fields: string[],
          filters: Record<string, string | number>
        ) => {
          switch (filters.user_id) {
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

      const response = await supertest(app).get(`${PATH}/activity`).send()

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        dailyActiveUsers: [],
        weeklyActiveUsers: [],
        monthlyActiveUsers: [
          { ...PRE_WEEK_USER, creation_ts: PRE_WEEK_USER.creation_ts * 1000 }
        ],
        weeklyNewUsers: [
          { ...PRE_WEEK_USER, creation_ts: PRE_WEEK_USER.creation_ts * 1000 }
        ],
        monthlyNewUsers: [
          { ...PRE_WEEK_USER, creation_ts: PRE_WEEK_USER.creation_ts * 1000 }
        ]
      })
    })

    it('should return an error if something wrong happens while fetching the activity stats', async () => {
      dbMock.getAll.mockRejectedValue(new Error('test'))

      const response = await supertest(app).get(`${PATH}/activity`).send()

      expect(response.status).toBe(500)
    })
  })

  describe('the getMessageStats handler', () => {
    it('should try to fetch the message stats', async () => {
      dbMock.getAll.mockResolvedValue([TODAY_USER])

      dbMock.get.mockImplementation(
        async (
          table: string,
          _fields: string[],
          filters: Record<string, string | number>
        ) => {
          if (table === 'events') {
            return messages
          }

          return await Promise.resolve([
            {
              user_id: TODAY_USER.name,
              last_seen: TODAY_USER.last_seen_ts
            }
          ])
        }
      )

      const response = await supertest(app).get(`${PATH}/messages`).send()

      expect(response.status).toBe(200)
      expect(response.body).toEqual([
        { message_count: 3, user_id: 'user1' }
      ] satisfies UserMessageCount[])
    })

    it('should return an error if something wrong happens while fetching the message stats', async () => {
      dbMock.get.mockRejectedValue(new Error('test'))

      const response = await supertest(app).get(`${PATH}/messages`).send()

      expect(response.status).toBe(500)
    })
  })
})
