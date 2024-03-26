import express, { Router } from 'express'
import supertest from 'supertest'
import TwakeServer from '../..'
import { type Config } from '../../types'
import defaultConfig from '../__testData__/config.json'
import { OpenSearchClientException } from '../utils/error'

let testServer: TwakeServer
const mockOpenSearchExists = jest
  .fn()
  .mockResolvedValue({ statusCode: 200, body: true })

const mockOpenSearchCreate = jest.fn().mockResolvedValue({ statusCode: 200 })

const mockOpenSearchBulk = jest.fn().mockResolvedValue({ statusCode: 200 })

jest.mock('@opensearch-project/opensearch', () => ({
  Client: jest.fn().mockImplementation(() => ({
    indices: {
      exists: mockOpenSearchExists,
      create: mockOpenSearchCreate
    },
    bulk: mockOpenSearchBulk,
    close: jest.fn()
  }))
}))

jest.mock('@twake/matrix-identity-server', () => ({
  default: jest.fn().mockImplementation(() => ({
    ready: Promise.resolve(true),
    db: {},
    userDB: {},
    api: { get: {}, post: {} },
    cleanJobs: jest.fn().mockImplementation(() => testServer.logger.close())
  })),
  MatrixDB: jest.fn().mockImplementation(() => ({
    ready: Promise.resolve(true),
    get: jest
      .fn()
      .mockResolvedValueOnce([
        { user_id: '@toto:example.com', display_name: 'Toto' }
      ])
      .mockResolvedValueOnce([
        {
          event_id: 'event1',
          room_id: 'room1',
          json: '{"type":"m.room.message","content":{"body":"Hello world","type":"text"}}'
        }
      ])
      .mockResolvedValueOnce([
        { user_id: '@toto:example.com', display_name: 'Toto' }
      ])
      .mockResolvedValueOnce([
        {
          event_id: 'event1',
          room_id: 'room1',
          json: '{"type":"m.room.message","content":{"body":"Hello world","type":"text"}}'
        }
      ]),
    getAll: jest.fn().mockResolvedValue([
      {
        room_id: 'room1',
        encryption: null,
        name: 'Room1'
      }
    ]),
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
      db: {},
      userDB: {},
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

jest.mock('../../db/index.ts', () => jest.fn())

describe('Search engine API - Opensearch controller', () => {
  let app: express.Application
  let loggerErrorSpyOn: jest.SpyInstance
  const restoreRoute = '/_twake/app/v1/opensearch/restore'

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

  afterAll(() => {
    if (testServer != null) testServer.cleanJobs()
  })

  afterEach(() => {
    jest.clearAllMocks()
    mockOpenSearchExists.mockResolvedValue({ statusCode: 200, body: true })
    mockOpenSearchCreate.mockResolvedValue({ statusCode: 200 })
    mockOpenSearchBulk.mockResolvedValue({ statusCode: 200 })
  })

  it('should log an error when an error occured with opensearch exists API', async () => {
    const error = new Error('An error occured in opensearch exists API')
    mockOpenSearchExists.mockRejectedValue(error)
    const response = await supertest(app).post(restoreRoute).send({})
    expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
    expect(loggerErrorSpyOn).toHaveBeenCalledWith(error.message, {
      httpMethod: 'POST',
      endpointPath: restoreRoute
    })
    expect(response.statusCode).toBe(500)
    expect(response.body).toEqual({
      error: 'Internal server error'
    })
  })

  it('should call logger when opensearch client response status code is not 20X', async () => {
    const error = new Error('An error occured in opensearch exists API')
    mockOpenSearchExists.mockResolvedValue({ statusCode: 501, body: error })
    const response = await supertest(app).post(restoreRoute).send({})
    expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
    expect(loggerErrorSpyOn).toHaveBeenCalledWith(
      new OpenSearchClientException(JSON.stringify(error, null, 2), 501)
        .message,
      {
        httpMethod: 'POST',
        endpointPath: restoreRoute,
        status: '501'
      }
    )
    expect(response.statusCode).toBe(500)
    expect(response.body).toEqual({
      error: 'Internal server error'
    })
  })

  it('should log an error when an error occured with opensearch create index API', async () => {
    const error = new Error('An error occured in opensearch create index API')
    mockOpenSearchExists.mockResolvedValue({ statusCode: 404, body: false })
    mockOpenSearchCreate.mockRejectedValue(error)
    const response = await supertest(app).post(restoreRoute).send({})
    expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
    expect(loggerErrorSpyOn).toHaveBeenCalledWith(error.message, {
      httpMethod: 'POST',
      endpointPath: restoreRoute
    })
    expect(response.statusCode).toBe(500)
    expect(response.body).toEqual({
      error: 'Internal server error'
    })
  })

  it('should call logger when opensearch client response status code is not 20X', async () => {
    const error = new Error('An error occured in opensearch create index API')
    mockOpenSearchExists.mockResolvedValue({ statusCode: 404, body: false })
    mockOpenSearchCreate.mockResolvedValue({ statusCode: 502, body: error })
    const response = await supertest(app).post(restoreRoute).send({})
    expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
    expect(loggerErrorSpyOn).toHaveBeenCalledWith(
      new OpenSearchClientException(JSON.stringify(error, null, 2), 502)
        .message,
      {
        httpMethod: 'POST',
        endpointPath: restoreRoute,
        status: '502'
      }
    )
    expect(response.statusCode).toBe(500)
    expect(response.body).toEqual({
      error: 'Internal server error'
    })
  })

  it('should log an error when an error occured with opensearch bulk API', async () => {
    const error = new Error('An error occured in opensearch bulk API')
    mockOpenSearchExists.mockResolvedValue({ statusCode: 404, body: false })
    mockOpenSearchBulk.mockRejectedValue(error)
    const response = await supertest(app).post(restoreRoute).send({})
    expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
    expect(loggerErrorSpyOn).toHaveBeenCalledWith(error.message, {
      httpMethod: 'POST',
      endpointPath: restoreRoute
    })
    expect(response.statusCode).toBe(500)
    expect(response.body).toEqual({
      error: 'Internal server error'
    })
  })

  it('should call logger when opensearch client response status code is not 20X', async () => {
    const error = new Error('An error occured in opensearch bulk API')
    mockOpenSearchBulk.mockResolvedValue({ statusCode: 504, body: error })
    const response = await supertest(app).post(restoreRoute).send({})
    expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
    expect(loggerErrorSpyOn).toHaveBeenCalledWith(
      new OpenSearchClientException(JSON.stringify(error, null, 2), 504)
        .message,
      {
        httpMethod: 'POST',
        endpointPath: restoreRoute,
        status: '504'
      }
    )
    expect(response.statusCode).toBe(500)
    expect(response.body).toEqual({
      error: 'Internal server error'
    })
  })

  it('should send a response with status 204 if no error occurs', async () => {
    const response = await supertest(app).post(restoreRoute).send({})
    expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
    expect(response.statusCode).toBe(204)
    expect(response.body).toEqual({})
  })
})
