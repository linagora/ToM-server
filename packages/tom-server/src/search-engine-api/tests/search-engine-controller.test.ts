import { AppServerAPIError } from '@twake/matrix-application-server'
import { type DbGetResult } from '@twake/matrix-identity-server'
import express, { Router, type NextFunction } from 'express'
import supertest from 'supertest'
import TwakeServer from '../..'
import { type AuthRequest, type Config } from '../../types'
import defaultConfig from '../__testData__/config.json'
import { OpenSearchClientException } from '../utils/error'

const initialUserId = '@toto:example.com'
let userId = initialUserId
const userMail = 'toto@example.com'
let testServer: TwakeServer

const mockUserDBGet = jest.fn().mockResolvedValue([{ mail: userMail }])
const msearchResponseBody = {
  responses: [
    {
      hits: {
        hits: [
          {
            _id: 'room1',
            _source: {
              name: 'Room1 is not member'
            }
          },
          {
            _id: 'room2',
            _source: {
              name: 'Room2 is member'
            }
          }
        ]
      }
    },
    {
      hits: {
        hits: [
          {
            _id: 'message1',
            _source: {
              room_id: 'room1',
              sender: '@john:example.com',
              display_name: 'John test',
              content: 'Hello world'
            }
          },
          {
            _id: 'message2',
            _source: {
              display_name: 'Rose',
              room_id: 'room2',
              sender: '@rose:example.com',
              content: 'See you tomorrow world'
            }
          },
          {
            _id: 'message3',
            _source: {
              display_name: 'Toto',
              room_id: 'room2',
              sender: initialUserId,
              content: 'Goodbye world'
            }
          }
        ]
      }
    },
    {
      hits: {
        hits: [
          {
            _id: 'mail1',
            _source: {
              bcc: [{ address: userMail }],
              cc: [{ address: userMail }],
              from: [{ address: userMail }],
              to: [{ address: userMail }]
            }
          },
          {
            _id: 'mail2',
            _source: {
              bcc: [{ address: 'other@example.com' }],
              cc: [{ address: 'other@example.com' }],
              from: [{ address: 'other@example.com' }, { address: userMail }],
              to: [{ address: 'other@example.com' }]
            }
          },
          {
            _id: 'mail3',
            _source: {
              bcc: [{ address: 'other@example.com' }],
              cc: [{ address: 'other@example.com' }],
              from: [{ address: 'other@example.com' }],
              to: [{ address: 'other@example.com' }]
            }
          }
        ]
      }
    }
  ]
}

const mockMSearchMock = jest.fn().mockResolvedValue({
  statusCode: 200,
  body: msearchResponseBody
})

jest.mock('@opensearch-project/opensearch', () => ({
  Client: jest.fn().mockImplementation(() => ({
    indices: {
      exists: jest.fn().mockResolvedValue({ statusCode: 200, body: true })
    },
    msearch: mockMSearchMock,
    close: jest.fn()
  }))
}))

jest.mock('@twake/matrix-identity-server', () => ({
  default: jest.fn().mockImplementation(() => ({
    ready: Promise.resolve(true),
    db: {},
    userDB: { get: mockUserDBGet },
    api: { get: {}, post: {} },
    cleanJobs: jest.fn().mockImplementation(() => testServer.logger.close())
  })),
  MatrixDB: jest.fn().mockImplementation(() => ({
    ready: Promise.resolve(true),
    get: jest.fn().mockResolvedValue([]),
    getAll: jest.fn().mockResolvedValue([]),
    close: jest.fn()
  })),
  Utils: {
    hostnameRe:
      /^((([a-zA-Z0-9][-a-zA-Z0-9]*)?[a-zA-Z0-9])[.])*([a-zA-Z][-a-zA-Z0-9]*[a-zA-Z0-9]|[a-zA-Z])(:(\d+))?$/
  }
}))

jest.mock('../../identity-server/index.ts', () => {
  return function () {
    return {
      ready: Promise.resolve(true),
      db: { cleanByExpires: [] },
      userDB: { get: mockUserDBGet },
      api: { get: {}, post: {} },
      cleanJobs: jest.fn().mockImplementation(() => testServer.logger.close())
    }
  }
})

jest.mock('../../application-server/index.ts', () => {
  return function () {
    return {
      router: {
        routes: Router()
      }
    }
  }
})

jest.mock('../../utils/middlewares/auth.middleware.ts', () =>
  jest
    .fn()
    .mockReturnValue((req: AuthRequest, res: Response, next: NextFunction) => {
      req.userId = userId
      next()
    })
)

describe('Search engine API - Search engine controller', () => {
  let app: express.Application
  let loggerErrorSpyOn: jest.SpyInstance
  const searchRoute = '/_twake/app/v1/search'

  beforeAll((done) => {
    testServer = new TwakeServer(defaultConfig as Config)
    loggerErrorSpyOn = jest.spyOn(testServer.logger, 'error')
    testServer.ready
      .then(() => {
        app = express()
        app.use(testServer.endpoints)
        done()
      })
      .catch((e) => {
        done(e)
      })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    if (testServer != null) testServer.cleanJobs()
  })

  it('should log an error when request body does not content searchValue property', async () => {
    const response = await supertest(app).post(searchRoute).send({})
    expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
    expect(loggerErrorSpyOn).toHaveBeenCalledWith(
      new AppServerAPIError({
        status: 400,
        message: 'Error field: Invalid value (property: searchValue)'
      }).message,
      {
        httpMethod: 'POST',
        endpointPath: searchRoute,
        matrixUserId: userId,
        status: '400'
      }
    )
    expect(response.statusCode).toBe(400)
    expect(response.body).toEqual({
      error: 'Error field: Invalid value (property: searchValue)'
    })
  })

  it('should log an error when searchValue property in request body is not a string', async () => {
    const response = await supertest(app)
      .post(searchRoute)
      .send({ searchValue: 123 })
    expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
    expect(loggerErrorSpyOn).toHaveBeenCalledWith(
      new AppServerAPIError({
        status: 400,
        message: 'Error field: Invalid value (property: searchValue)'
      }).message,
      {
        httpMethod: 'POST',
        endpointPath: searchRoute,
        matrixUserId: userId,
        status: '400'
      }
    )
    expect(response.statusCode).toBe(400)
    expect(response.body).toEqual({
      error: 'Error field: Invalid value (property: searchValue)'
    })
  })

  it('should log an error when auth middleware set a wrong userId in request', async () => {
    userId = 'falsy_userId'
    const response = await supertest(app).post(searchRoute).send({
      searchValue: 'test'
    })
    expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
    expect(loggerErrorSpyOn).toHaveBeenCalledWith(
      new Error('Cannot extract user uid from matrix user id falsy_userId')
        .message,
      {
        httpMethod: 'POST',
        endpointPath: searchRoute,
        matrixUserId: userId
      }
    )
    expect(response.statusCode).toBe(500)
    expect(response.body).toEqual({ error: 'Internal server error' })
    userId = initialUserId
  })

  it('should log an error when userDB client does not find user with uid matching req.userId', async () => {
    mockUserDBGet.mockResolvedValue([])
    const response = await supertest(app).post(searchRoute).send({
      searchValue: 'test'
    })
    expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
    expect(loggerErrorSpyOn).toHaveBeenCalledWith(
      new Error('User with user id toto not found').message,
      {
        httpMethod: 'POST',
        endpointPath: searchRoute,
        matrixUserId: userId
      }
    )
    expect(response.statusCode).toBe(500)
    expect(response.body).toEqual({ error: 'Internal server error' })
    mockUserDBGet.mockResolvedValue([{ mail: userMail }])
  })

  it('should log an error when opensearch client returns a reponse with status code not equal to 200', async () => {
    const errorMessage = 'An error occured in opensearch msearch API'
    mockMSearchMock.mockResolvedValue({
      body: {
        text: errorMessage
      },
      statusCode: 502
    })
    const response = await supertest(app).post(searchRoute).send({
      searchValue: 'test'
    })
    expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
    expect(loggerErrorSpyOn).toHaveBeenCalledWith(
      new OpenSearchClientException(
        JSON.stringify(
          {
            text: errorMessage
          },
          null,
          2
        ),
        response.statusCode
      ).message,
      {
        httpMethod: 'POST',
        endpointPath: searchRoute,
        matrixUserId: userId,
        status: '502'
      }
    )
    expect(response.statusCode).toBe(500)
    expect(response.body).toEqual({ error: 'Internal server error' })
    mockMSearchMock.mockResolvedValue({
      body: msearchResponseBody,
      statusCode: 200
    })
  })

  it('should return rooms, mails and messages matching search', async () => {
    jest
      .spyOn(testServer.matrixDb, 'get')
      .mockResolvedValueOnce([
        { room_id: 'room1', membership: 'invite' },
        { room_id: 'room1', membership: 'join' },
        { room_id: 'room1', membership: 'leave' },
        { room_id: 'room2', membership: 'invite' },
        { room_id: 'room2', membership: 'join' }
      ])
      .mockResolvedValueOnce([
        { name: 'Room1 is not member', avatar_url: null },
        { name: 'Room2 is member', avatar_url: 'avatar_room2' }
      ] as DbGetResult)
      .mockResolvedValueOnce([
        {
          room_id: 'room1',
          json: '{"type":"m.room.member","content":{"is_direct":false}}'
        },
        {
          room_id: 'room2',
          json: '{"type":"m.room.member","content":{"is_direct":true}}'
        }
      ])
      .mockResolvedValueOnce([
        { room_id: 'room2', user_id: userId, avatar_url: 'toto_avatar' },
        {
          room_id: 'room2',
          user_id: '@rose:example.com',
          avatar_url: 'rose_avatar'
        }
      ])
    const response = await supertest(app).post(searchRoute).send({
      searchValue: 'test'
    })
    expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
    expect(response.statusCode).toBe(200)
    expect(response.body.rooms).toHaveLength(1)
    expect(response.body.rooms[0]).toEqual({
      room_id: 'room2',
      name: 'Room2 is member'
    })
    expect(response.body.messages).toHaveLength(2)
    expect(response.body.messages[0]).toEqual({
      room_id: 'room2',
      event_id: 'message2',
      content: 'See you tomorrow world',
      display_name: 'Rose',
      avatar_url: 'rose_avatar'
    })
    expect(response.body.messages[1]).toEqual({
      room_id: 'room2',
      event_id: 'message3',
      content: 'Goodbye world',
      display_name: 'Toto',
      avatar_url: 'rose_avatar'
    })
    expect(response.body.mails).toHaveLength(2)
    expect(response.body.mails[0]).toEqual({
      id: 'mail1',
      bcc: [{ address: userMail }],
      cc: [{ address: userMail }],
      from: [{ address: userMail }],
      to: [{ address: userMail }]
    })
    expect(response.body.mails[1]).toEqual({
      id: 'mail2',
      bcc: [{ address: 'other@example.com' }],
      cc: [{ address: 'other@example.com' }],
      from: [{ address: 'other@example.com' }, { address: userMail }],
      to: [{ address: 'other@example.com' }]
    })
  })
})
