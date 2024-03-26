import { type DbGetResult } from '@twake/matrix-identity-server'
import express, { Router } from 'express'
import supertest from 'supertest'
import TwakeServer from '../..'
import { type Config } from '../../types'
import defaultConfig from '../__testData__/config.json'
import { OpenSearchClientException } from '../utils/error'

let testServer: TwakeServer
const homeServerToken =
  'hsTokenTestwdakZQunWWNe3DZitAerw9aNqJ2a6HVp0sJtg7qTJWXcHnBjgN0NL'

const mockIndex = jest.fn().mockResolvedValue({ statusCode: 200 })
const mockBulk = jest.fn().mockResolvedValue({ statusCode: 200 })
const mockDelete = jest.fn().mockResolvedValue({ statusCode: 200 })
const mockDeleteByQuery = jest.fn().mockResolvedValue({ statusCode: 200 })
const mockUpdateByQuery = jest.fn().mockResolvedValue({ statusCode: 200 })
const mockExists = jest.fn().mockResolvedValue({ statusCode: 200, body: true })
const mockUpdate = jest.fn().mockResolvedValue({ statusCode: 200 })

jest.mock('@opensearch-project/opensearch', () => ({
  Client: jest.fn().mockImplementation(() => ({
    indices: {
      exists: jest.fn().mockResolvedValue({ statusCode: 200, body: true })
    },
    index: mockIndex,
    bulk: mockBulk,
    delete: mockDelete,
    delete_by_query: mockDeleteByQuery,
    update_by_query: mockUpdateByQuery,
    update: mockUpdate,
    exists: mockExists,
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
    get: jest.fn().mockResolvedValue([]),
    close: jest.fn(),
    getAll: jest.fn().mockResolvedValue([])
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

describe('Search engine API - Opensearch service', () => {
  let app: express.Application
  let loggerErrorSpyOn: jest.SpyInstance
  let transactionId = 1

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
    transactionId++
  })

  describe('Update room name', () => {
    afterEach(() => {
      mockIndex.mockResolvedValue({ statusCode: 200 })
    })

    it('should log an error when matrix db client does not find the involved room on update room name event', async () => {
      jest.spyOn(testServer.matrixDb, 'get').mockResolvedValue([])

      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room1',
              type: 'm.room.name',
              state_key: '@test:example.com'
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(
        new Error('No room stats state found with id room1').message,
        {}
      )
    })

    it('should log an error when matrix db client finds multiple rooms on update room name event', async () => {
      jest
        .spyOn(testServer.matrixDb, 'get')
        .mockResolvedValue([
          { encryption: null },
          { encryption: 'test' }
        ] as unknown as DbGetResult)

      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room1',
              type: 'm.room.name',
              state_key: '@test:example.com'
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(
        new Error('More than one room found with id room1').message,
        {}
      )
    })

    it('should work if matrix db client finds the involved rooms on update room name event', async () => {
      jest
        .spyOn(testServer.matrixDb, 'get')
        .mockResolvedValue([{ encryption: null }] as unknown as DbGetResult)

      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room1',
              type: 'm.room.name',
              state_key: '@test:example.com',
              content: {
                name: 'new_name'
              }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
    })

    it('should call logger when opensearch client throws an error', async () => {
      jest
        .spyOn(testServer.matrixDb, 'get')
        .mockResolvedValue([{ encryption: null }] as unknown as DbGetResult)

      const error = new Error('An error occured in opensearch index API')
      mockIndex.mockRejectedValue(error)
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room1',
              type: 'm.room.name',
              state_key: '@test:example.com',
              content: {
                name: 'new_name'
              }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(error.message, {})
    })

    it('should call logger when opensearch client response status code is not 20X', async () => {
      jest
        .spyOn(testServer.matrixDb, 'get')
        .mockResolvedValue([{ encryption: null }] as unknown as DbGetResult)

      const error = new Error('An error occured in opensearch index API')
      mockIndex.mockResolvedValue({ statusCode: 502, body: error })
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room1',
              type: 'm.room.name',
              state_key: '@test:example.com',
              content: {
                name: 'new_name'
              }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(
        new OpenSearchClientException(JSON.stringify(error, null, 2), 502)
          .message,
        { status: '502' }
      )
    })
  })

  describe('Index message', () => {
    afterEach(() => {
      mockBulk.mockResolvedValue({ statusCode: 200 })
    })

    it('should log an error when matrix db client does not find the involved room on received message event', async () => {
      jest.spyOn(testServer.matrixDb, 'get').mockResolvedValue([])

      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {},
              room_id: 'room2',
              type: 'm.room.message'
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(
        new Error('No room stats state found with id room2').message,
        {}
      )
    })

    it('should log an error when matrix db client finds multiple rooms on received message event', async () => {
      jest
        .spyOn(testServer.matrixDb, 'get')
        .mockResolvedValue([
          { encryption: null },
          { encryption: 'test' }
        ] as unknown as DbGetResult)

      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room2',
              type: 'm.room.message',
              content: {}
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(
        new Error('More than one room found with id room2').message,
        {}
      )
    })

    it('should log an error when matrix db client does not found membership for the sender in the room', async () => {
      jest
        .spyOn(testServer.matrixDb, 'get')
        .mockResolvedValueOnce([{ encryption: null }] as unknown as DbGetResult)
        .mockResolvedValueOnce([])

      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room2',
              type: 'm.room.message',
              sender: '@toto:example.com',
              content: {}
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(
        new Error(
          'No memberships found for user @toto:example.com in room room2'
        ).message,
        {}
      )
    })

    it('should log an error when last membership in the room for the sender is not "join"', async () => {
      jest
        .spyOn(testServer.matrixDb, 'get')
        .mockResolvedValueOnce([{ encryption: null }] as unknown as DbGetResult)
        .mockResolvedValueOnce([
          { display_name: 'Toto', membership: 'invite' },
          { display_name: 'Toto', membership: 'join' },
          { display_name: 'Toto', membership: 'leave' }
        ])

      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room2',
              type: 'm.room.message',
              sender: '@toto:example.com',
              content: {}
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(
        new Error(
          'User @toto:example.com is not allowed to participate in room room2'
        ).message,
        {}
      )
    })

    it('should not call logger error method if no problem occurs', async () => {
      jest
        .spyOn(testServer.matrixDb, 'get')
        .mockResolvedValueOnce([
          { encryption: null, name: 'Room 2' }
        ] as unknown as DbGetResult)
        .mockResolvedValueOnce([
          { display_name: 'Toto', membership: 'invite' },
          { display_name: 'Toto', membership: 'join' }
        ])

      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room2',
              type: 'm.room.message',
              sender: '@toto:example.com',
              content: {
                body: 'Hello world',
                type: 'text'
              }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
    })

    it('should call logger when opensearch client throws an error', async () => {
      jest
        .spyOn(testServer.matrixDb, 'get')
        .mockResolvedValueOnce([
          { encryption: null, name: 'Room 2' }
        ] as unknown as DbGetResult)
        .mockResolvedValueOnce([
          { display_name: 'Toto', membership: 'invite' },
          { display_name: 'Toto', membership: 'join' }
        ])

      const error = new Error('An error occured in opensearch bulk API')
      mockBulk.mockRejectedValue(error)

      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room2',
              type: 'm.room.message',
              sender: '@toto:example.com',
              content: {
                body: 'Hello world',
                type: 'text'
              }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(error.message, {})
    })

    it('should call logger when opensearch client response status code is not 20X', async () => {
      jest
        .spyOn(testServer.matrixDb, 'get')
        .mockResolvedValueOnce([
          { encryption: null, name: 'Room 2' }
        ] as unknown as DbGetResult)
        .mockResolvedValueOnce([
          { display_name: 'Toto', membership: 'invite' },
          { display_name: 'Toto', membership: 'join' }
        ])

      const error = new Error('An error occured in opensearch bulk API')
      mockBulk.mockResolvedValue({ statusCode: 503, body: error })

      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room2',
              type: 'm.room.message',
              sender: '@toto:example.com',
              content: {
                body: 'Hello world',
                type: 'text'
              }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(
        new OpenSearchClientException(JSON.stringify(error, null, 2), 503)
          .message,
        { status: '503' }
      )
    })
  })

  describe('Deindex room', () => {
    afterEach(() => {
      mockExists.mockResolvedValue({ statusCode: 200, body: true })
      mockDelete.mockResolvedValue({ statusCode: 200 })
      mockDeleteByQuery.mockResolvedValue({ statusCode: 200 })
    })

    it('should call logger when opensearch exists throws an error', async () => {
      const error = new Error('An error occured in opensearch exists API')
      mockExists.mockRejectedValue(error)
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room3',
              state_key: '@test:example.com',
              type: 'm.room.encryption',
              sender: '@toto:example.com',
              content: { algorithm: 'm.megolm.v1.aes-sha2' }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(error.message, {})
      expect(mockExists).toHaveBeenCalledTimes(1)
    })

    it('should not call logger when opensearch exists response status code is not 20X', async () => {
      const error = new Error('An error occured in opensearch exists API')
      mockExists.mockResolvedValue({ statusCode: 404, body: error })
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room3',
              state_key: '@test:example.com',
              type: 'm.room.encryption',
              sender: '@toto:example.com',
              content: { algorithm: 'm.megolm.v1.aes-sha2' }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
      expect(mockExists).toHaveBeenCalledTimes(1)
    })

    it('should call logger when opensearch delete throws an error', async () => {
      const error = new Error('An error occured in opensearch delete API')
      mockDelete.mockRejectedValue(error)
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room3',
              state_key: '@test:example.com',
              type: 'm.room.encryption',
              sender: '@toto:example.com',
              content: { algorithm: 'm.megolm.v1.aes-sha2' }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(error.message, {})
      expect(mockExists).toHaveBeenCalledTimes(1)
      expect(mockDelete).toHaveBeenCalledTimes(1)
    })

    it('should call logger when opensearch delete response status code is not 20X', async () => {
      const error = new Error('An error occured in opensearch delete API')
      mockDelete.mockResolvedValue({ statusCode: 505, body: error })
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room3',
              state_key: '@test:example.com',
              type: 'm.room.encryption',
              sender: '@toto:example.com',
              content: { algorithm: 'm.megolm.v1.aes-sha2' }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(
        new OpenSearchClientException(JSON.stringify(error, null, 2), 505)
          .message,
        { status: '505' }
      )
      expect(mockExists).toHaveBeenCalledTimes(1)
      expect(mockDelete).toHaveBeenCalledTimes(1)
    })

    it('should call logger when opensearch delete_by_query throws an error', async () => {
      const error = new Error(
        'An error occured in opensearch delete_by_query API'
      )
      mockDeleteByQuery.mockRejectedValue(error)
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room3',
              state_key: '@test:example.com',
              type: 'm.room.encryption',
              sender: '@toto:example.com',
              content: { algorithm: 'm.megolm.v1.aes-sha2' }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(error.message, {})
      expect(mockExists).toHaveBeenCalledTimes(1)
      expect(mockDelete).toHaveBeenCalledTimes(1)
      expect(mockDeleteByQuery).toHaveBeenCalledTimes(1)
    })

    it('should call logger when opensearch delete_by_query response status code is not 20X', async () => {
      const error = new Error('An error occured in opensearch delete API')
      mockDeleteByQuery.mockResolvedValue({ statusCode: 505, body: error })
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room3',
              state_key: '@test:example.com',
              type: 'm.room.encryption',
              sender: '@toto:example.com',
              content: { algorithm: 'm.megolm.v1.aes-sha2' }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(
        new OpenSearchClientException(JSON.stringify(error, null, 2), 505)
          .message,
        { status: '505' }
      )
      expect(mockExists).toHaveBeenCalledTimes(1)
      expect(mockDelete).toHaveBeenCalledTimes(1)
      expect(mockDeleteByQuery).toHaveBeenCalledTimes(1)
    })

    it('should not call opensearch exists method if event.content.algorithm is undefined', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room3',
              state_key: '@test:example.com',
              type: 'm.room.encryption',
              sender: '@toto:example.com',
              content: {}
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
      expect(mockExists).toHaveBeenCalledTimes(0)
      expect(mockDelete).toHaveBeenCalledTimes(0)
      expect(mockDeleteByQuery).toHaveBeenCalledTimes(0)
    })

    it('should not call opensearch delete methods if document does not exist', async () => {
      mockExists.mockResolvedValue({ statusCode: 404, body: false })
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room3',
              state_key: '@test:example.com',
              type: 'm.room.encryption',
              sender: '@toto:example.com',
              content: { algorithm: 'm.megolm.v1.aes-sha2' }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
      expect(mockExists).toHaveBeenCalledTimes(1)
      expect(mockDelete).toHaveBeenCalledTimes(0)
      expect(mockDeleteByQuery).toHaveBeenCalledTimes(1)
    })

    it('should not call logger error method if no problem occurs', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              room_id: 'room3',
              state_key: '@test:example.com',
              type: 'm.room.encryption',
              sender: '@toto:example.com',
              content: { algorithm: 'm.megolm.v1.aes-sha2' }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
      expect(mockExists).toHaveBeenCalledTimes(1)
      expect(mockDelete).toHaveBeenCalledTimes(1)
      expect(mockDeleteByQuery).toHaveBeenCalledTimes(1)
    })
  })

  describe('Deindex message', () => {
    afterEach(() => {
      mockExists.mockResolvedValue({ statusCode: 200, body: true })
      mockDelete.mockResolvedValue({ statusCode: 200 })
    })

    it('should call logger when opensearch exists throws an error', async () => {
      const error = new Error('An error occured in opensearch exists API')
      mockExists.mockRejectedValue(error)
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                reason: 'Message content is invalid'
              },
              event_id: '$NTT-aFQYu0MblYL81AOsvC5RB6i9uHk8TuAdH1tOg6w',
              redacts: '$N1iUgYSegBr2JWThSAuEEsGznZtnbhRPmCNXKIwe6sE',
              room_id: 'room4',
              sender: '@lskywalker:example.com',
              type: 'm.room.redaction',
              user_id: '@lskywalker:example.com'
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(error.message, {})
      expect(mockExists).toHaveBeenCalledTimes(1)
    })

    it('should not call logger when opensearch exists response status code is not 20X', async () => {
      const error = new Error('An error occured in opensearch exists API')
      mockExists.mockResolvedValue({ statusCode: 404, body: error })
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                reason: 'Message content is invalid'
              },
              event_id: '$NTT-aFQYu0MblYL81AOsvC5RB6i9uHk8TuAdH1tOg6w',
              redacts: '$N1iUgYSegBr2JWThSAuEEsGznZtnbhRPmCNXKIwe6sE',
              room_id: 'room4',
              sender: '@lskywalker:example.com',
              type: 'm.room.redaction',
              user_id: '@lskywalker:example.com'
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
      expect(mockExists).toHaveBeenCalledTimes(1)
    })

    it('should call logger when opensearch delete throws an error', async () => {
      const error = new Error('An error occured in opensearch delete API')
      mockDelete.mockRejectedValue(error)
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                reason: 'Message content is invalid'
              },
              event_id: '$NTT-aFQYu0MblYL81AOsvC5RB6i9uHk8TuAdH1tOg6w',
              redacts: '$N1iUgYSegBr2JWThSAuEEsGznZtnbhRPmCNXKIwe6sE',
              room_id: 'room4',
              sender: '@lskywalker:example.com',
              type: 'm.room.redaction',
              user_id: '@lskywalker:example.com'
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(error.message, {})
      expect(mockExists).toHaveBeenCalledTimes(1)
      expect(mockDelete).toHaveBeenCalledTimes(1)
    })

    it('should call logger when opensearch delete response status code is not 20X', async () => {
      const error = new Error('An error occured in opensearch delete API')
      mockDelete.mockResolvedValue({ statusCode: 505, body: error })
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                reason: 'Message content is invalid'
              },
              event_id: '$NTT-aFQYu0MblYL81AOsvC5RB6i9uHk8TuAdH1tOg6w',
              redacts: '$N1iUgYSegBr2JWThSAuEEsGznZtnbhRPmCNXKIwe6sE',
              room_id: 'room4',
              sender: '@lskywalker:example.com',
              type: 'm.room.redaction',
              user_id: '@lskywalker:example.com'
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(
        new OpenSearchClientException(JSON.stringify(error, null, 2), 505)
          .message,
        { status: '505' }
      )
      expect(mockExists).toHaveBeenCalledTimes(1)
      expect(mockDelete).toHaveBeenCalledTimes(1)
    })

    it('should not call opensearch delete methods if event.redacts is undefined', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                reason: 'Message content is invalid'
              },
              event_id: '$NTT-aFQYu0MblYL81AOsvC5RB6i9uHk8TuAdH1tOg6w',
              room_id: 'room4',
              sender: '@lskywalker:example.com',
              type: 'm.room.redaction',
              user_id: '@lskywalker:example.com'
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
      expect(mockExists).toHaveBeenCalledTimes(0)
      expect(mockDelete).toHaveBeenCalledTimes(0)
    })

    it('should not call opensearch delete methods if event.redacts is null', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                reason: 'Message content is invalid'
              },
              event_id: '$NTT-aFQYu0MblYL81AOsvC5RB6i9uHk8TuAdH1tOg6w',
              room_id: 'room4',
              redacts: null,
              sender: '@lskywalker:example.com',
              type: 'm.room.redaction',
              user_id: '@lskywalker:example.com'
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
      expect(mockExists).toHaveBeenCalledTimes(0)
      expect(mockDelete).toHaveBeenCalledTimes(0)
    })

    it('should not call opensearch delete methods if event.redacts does not match event id regex', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                reason: 'Message content is invalid'
              },
              event_id: '$NTT-aFQYu0MblYL81AOsvC5RB6i9uHk8TuAdH1tOg6w',
              room_id: 'room4',
              redacts: 'falsy_event_id',
              sender: '@lskywalker:example.com',
              type: 'm.room.redaction',
              user_id: '@lskywalker:example.com'
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
      expect(mockExists).toHaveBeenCalledTimes(0)
      expect(mockDelete).toHaveBeenCalledTimes(0)
    })

    it('should not call opensearch delete methods if document does not exist', async () => {
      mockExists.mockResolvedValue({ statusCode: 404, body: false })
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                reason: 'Message content is invalid'
              },
              event_id: '$NTT-aFQYu0MblYL81AOsvC5RB6i9uHk8TuAdH1tOg6w',
              room_id: 'room4',
              redacts: '$POT-aFQYu0MblYL81AOsvC5RB6i9uHk8TuAdH1tOg6w',
              sender: '@lskywalker:example.com',
              type: 'm.room.redaction',
              user_id: '@lskywalker:example.com'
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
      expect(mockExists).toHaveBeenCalledTimes(1)
      expect(mockDelete).toHaveBeenCalledTimes(0)
    })

    it('should not call logger error method if no problem occurs', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                reason: 'Message content is invalid'
              },
              event_id: '$NTT-aFQYu0MblYL81AOsvC5RB6i9uHk8TuAdH1tOg6w',
              room_id: 'room4',
              redacts: '$N1iUgYSegBr2JWThSAuEEsGznZtnbhRPmCNXKIwe6sE',
              sender: '@lskywalker:example.com',
              type: 'm.room.redaction',
              user_id: '@lskywalker:example.com'
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
      expect(mockExists).toHaveBeenCalledTimes(1)
      expect(mockDelete).toHaveBeenCalledTimes(1)
    })
  })

  describe('Update display name', () => {
    afterEach(() => {
      mockUpdateByQuery.mockResolvedValue({ statusCode: 200 })
    })

    it('should call logger when opensearch client throws an error', async () => {
      const error = new Error(
        'An error occured in opensearch update_by_query API'
      )
      mockUpdateByQuery.mockRejectedValue(error)
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                avatar_url: 'mxc://matrix.org/wefh34uihSDRGhw34',
                displayname: 'new display name',
                membership: 'join'
              },
              room_id: 'room5',
              sender: '@askywalker:example.com',
              state_key: '@askywalker:example.com',
              type: 'm.room.member',
              unsigned: {
                prev_content: {
                  avatar_url: 'mxc://matrix.org/wefh34uihSDRGhw34',
                  displayname: 'old display name',
                  membership: 'join'
                }
              }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(error.message, {})
      expect(mockUpdateByQuery).toHaveBeenCalledTimes(1)
    })

    it('should call logger when opensearch client response status code is not 20X', async () => {
      const error = new Error(
        'An error occured in opensearch update_by_query API'
      )
      mockUpdateByQuery.mockResolvedValue({ statusCode: 506, body: error })
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                avatar_url: 'mxc://matrix.org/wefh34uihSDRGhw34',
                displayname: 'new display name',
                membership: 'join'
              },
              room_id: 'room5',
              sender: '@askywalker:example.com',
              state_key: '@askywalker:example.com',
              type: 'm.room.member',
              unsigned: {
                prev_content: {
                  avatar_url: 'mxc://matrix.org/wefh34uihSDRGhw34',
                  displayname: 'old display name',
                  membership: 'join'
                }
              }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(
        new OpenSearchClientException(JSON.stringify(error, null, 2), 506)
          .message,
        { status: '506' }
      )
      expect(mockUpdateByQuery).toHaveBeenCalledTimes(1)
    })

    it('should not call opensearch update_by_query method if event.content.display_name is undefined', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {},
              room_id: 'room5',
              sender: '@askywalker:example.com',
              state_key: '@askywalker:example.com',
              type: 'm.room.member',
              unsigned: {
                prev_content: {
                  avatar_url: 'mxc://matrix.org/wefh34uihSDRGhw34',
                  displayname: 'old display name',
                  membership: 'join'
                }
              }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
      expect(mockUpdateByQuery).toHaveBeenCalledTimes(0)
    })

    it('should not call opensearch update_by_query method if event.unsigned.prev_content.display_name is undefined', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                avatar_url: 'mxc://matrix.org/wefh34uihSDRGhw34',
                displayname: 'new display name',
                membership: 'join'
              },
              room_id: 'room5',
              sender: '@askywalker:example.com',
              state_key: '@askywalker:example.com',
              type: 'm.room.member',
              unsigned: {
                prev_content: {}
              }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
      expect(mockUpdateByQuery).toHaveBeenCalledTimes(0)
    })

    it('should not call opensearch update_by_query method if event.unsigned.prev_content is undefined', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                avatar_url: 'mxc://matrix.org/wefh34uihSDRGhw34',
                displayname: 'new display name',
                membership: 'join'
              },
              room_id: 'room5',
              sender: '@askywalker:example.com',
              state_key: '@askywalker:example.com',
              type: 'm.room.member',
              unsigned: {}
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
      expect(mockUpdateByQuery).toHaveBeenCalledTimes(0)
    })

    it('should not call opensearch update_by_query method if event.unsigned is undefined', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                avatar_url: 'mxc://matrix.org/wefh34uihSDRGhw34',
                displayname: 'new display name',
                membership: 'join'
              },
              room_id: 'room5',
              sender: '@askywalker:example.com',
              state_key: '@askywalker:example.com',
              type: 'm.room.member'
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
      expect(mockUpdateByQuery).toHaveBeenCalledTimes(0)
    })

    it('should not call opensearch update_by_query method if display name has not changed', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                avatar_url: 'mxc://matrix.org/wefh34uihSDRGhw34',
                displayname: 'old display name',
                membership: 'join'
              },
              room_id: 'room5',
              sender: '@askywalker:example.com',
              state_key: '@askywalker:example.com',
              type: 'm.room.member',
              unsigned: {
                prev_content: {
                  avatar_url: 'mxc://matrix.org/wefh34uihSDRGhw34',
                  displayname: 'old display name',
                  membership: 'join'
                }
              }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
      expect(mockUpdateByQuery).toHaveBeenCalledTimes(0)
    })

    it('should not call logger error method if no problem occurs', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                avatar_url: 'mxc://matrix.org/wefh34uihSDRGhw34',
                displayname: 'new display name',
                membership: 'join'
              },
              room_id: 'room5',
              sender: '@askywalker:example.com',
              state_key: '@askywalker:example.com',
              type: 'm.room.member',
              unsigned: {
                prev_content: {
                  avatar_url: 'mxc://matrix.org/wefh34uihSDRGhw34',
                  displayname: 'old display name',
                  membership: 'join'
                }
              }
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
      expect(mockUpdateByQuery).toHaveBeenCalledTimes(1)
    })
  })

  describe('Update message content', () => {
    beforeEach(() => {
      jest
        .spyOn(testServer.matrixDb, 'get')
        .mockResolvedValue([{ encryption: null }] as unknown as DbGetResult)
    })

    afterEach(() => {
      mockUpdate.mockResolvedValue({ statusCode: 200 })
    })

    it('should call logger when opensearch client throws an error', async () => {
      const error = new Error('An error occured in opensearch update API')
      mockUpdate.mockRejectedValue(error)
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                body: ' * But this room does not have avatar unless you add one',
                'm.mentions': {},
                'm.new_content': {
                  body: 'But this room does not have avatar unless you add one',
                  'm.mentions': {},
                  msgtype: 'm.text'
                },
                'm.relates_to': {
                  event_id: '$GGTg4DaUAHGVL_pHMAJtMz6F2cAK4cUXug-vkRG-yZQ',
                  rel_type: 'm.replace'
                },
                msgtype: 'm.text'
              },
              event_id: '$lDH6ZUNilncsYuFpkV-6xmQH9QZM3_KZVVBI95dY6XA',
              room_id: 'room6',
              sender: '@toto:example.com',
              type: 'm.room.message',
              user_id: '@toto:example.com'
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(error.message, {})
      expect(mockUpdate).toHaveBeenCalledTimes(1)
    })

    it('should call logger when opensearch client response status code is not 20X', async () => {
      const error = new Error('An error occured in opensearch update API')
      mockUpdate.mockResolvedValue({ statusCode: 506, body: error })
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                body: ' * But this room does not have avatar unless you add one',
                'm.mentions': {},
                'm.new_content': {
                  body: 'But this room does not have avatar unless you add one',
                  'm.mentions': {},
                  msgtype: 'm.text'
                },
                'm.relates_to': {
                  event_id: '$GGTg4DaUAHGVL_pHMAJtMz6F2cAK4cUXug-vkRG-yZQ',
                  rel_type: 'm.replace'
                },
                msgtype: 'm.text'
              },
              event_id: '$lDH6ZUNilncsYuFpkV-6xmQH9QZM3_KZVVBI95dY6XA',
              room_id: 'room6',
              sender: '@toto:example.com',
              type: 'm.room.message',
              user_id: '@toto:example.com'
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
      expect(loggerErrorSpyOn).toHaveBeenCalledWith(
        new OpenSearchClientException(JSON.stringify(error, null, 2), 506)
          .message,
        { status: '506' }
      )
      expect(mockUpdate).toHaveBeenCalledTimes(1)
    })

    it('should not call opensearch update method if event.content["m.new_content"] is undefined', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                body: ' * But this room does not have avatar unless you add one',
                'm.mentions': {},
                'm.relates_to': {
                  event_id: '$GGTg4DaUAHGVL_pHMAJtMz6F2cAK4cUXug-vkRG-yZQ',
                  rel_type: 'm.replace'
                },
                msgtype: 'm.text'
              },
              event_id: '$lDH6ZUNilncsYuFpkV-6xmQH9QZM3_KZVVBI95dY6XA',
              room_id: 'room6',
              sender: '@toto:example.com',
              type: 'm.room.message',
              user_id: '@toto:example.com'
            }
          ]
        })
      expect(mockUpdate).toHaveBeenCalledTimes(0)
    })

    it('should not call opensearch update method if event.content["m.new_content"] is null', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                body: ' * But this room does not have avatar unless you add one',
                'm.mentions': {},
                'm.new_content': null,
                'm.relates_to': {
                  event_id: '$GGTg4DaUAHGVL_pHMAJtMz6F2cAK4cUXug-vkRG-yZQ',
                  rel_type: 'm.replace'
                },
                msgtype: 'm.text'
              },
              event_id: '$lDH6ZUNilncsYuFpkV-6xmQH9QZM3_KZVVBI95dY6XA',
              room_id: 'room6',
              sender: '@toto:example.com',
              type: 'm.room.message',
              user_id: '@toto:example.com'
            }
          ]
        })
      expect(mockUpdate).toHaveBeenCalledTimes(0)
    })

    it('should not call opensearch update method if event.content["m.relates_to"] is undefined', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                body: ' * But this room does not have avatar unless you add one',
                'm.mentions': {},
                'm.new_content': {
                  body: 'But this room does not have avatar unless you add one',
                  'm.mentions': {},
                  msgtype: 'm.text'
                },
                msgtype: 'm.text'
              },
              event_id: '$lDH6ZUNilncsYuFpkV-6xmQH9QZM3_KZVVBI95dY6XA',
              room_id: 'room6',
              sender: '@toto:example.com',
              type: 'm.room.message',
              user_id: '@toto:example.com'
            }
          ]
        })
      expect(mockUpdate).toHaveBeenCalledTimes(0)
    })

    it('should not call opensearch update method if event.content["m.relates_to"] is null', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                body: ' * But this room does not have avatar unless you add one',
                'm.mentions': {},
                'm.new_content': {
                  body: 'But this room does not have avatar unless you add one',
                  'm.mentions': {},
                  msgtype: 'm.text'
                },
                'm.relates_to': null,
                msgtype: 'm.text'
              },
              event_id: '$lDH6ZUNilncsYuFpkV-6xmQH9QZM3_KZVVBI95dY6XA',
              room_id: 'room6',
              sender: '@toto:example.com',
              type: 'm.room.message',
              user_id: '@toto:example.com'
            }
          ]
        })
      expect(mockUpdate).toHaveBeenCalledTimes(0)
    })

    it('should not call opensearch update method if event.content["m.relates_to"].event_id is undefined', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                body: ' * But this room does not have avatar unless you add one',
                'm.mentions': {},
                'm.new_content': {
                  body: 'But this room does not have avatar unless you add one',
                  'm.mentions': {},
                  msgtype: 'm.text'
                },
                'm.relates_to': {
                  rel_type: 'm.replace'
                },
                msgtype: 'm.text'
              },
              event_id: '$lDH6ZUNilncsYuFpkV-6xmQH9QZM3_KZVVBI95dY6XA',
              room_id: 'room6',
              sender: '@toto:example.com',
              type: 'm.room.message',
              user_id: '@toto:example.com'
            }
          ]
        })
      expect(mockUpdate).toHaveBeenCalledTimes(0)
    })

    it('should not call opensearch update method if event.content["m.relates_to"].event_id is null', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                body: ' * But this room does not have avatar unless you add one',
                'm.mentions': {},
                'm.new_content': {
                  body: 'But this room does not have avatar unless you add one',
                  'm.mentions': {},
                  msgtype: 'm.text'
                },
                'm.relates_to': {
                  event_id: null,
                  rel_type: 'm.replace'
                },
                msgtype: 'm.text'
              },
              event_id: '$lDH6ZUNilncsYuFpkV-6xmQH9QZM3_KZVVBI95dY6XA',
              room_id: 'room6',
              sender: '@toto:example.com',
              type: 'm.room.message',
              user_id: '@toto:example.com'
            }
          ]
        })
      expect(mockUpdate).toHaveBeenCalledTimes(0)
    })

    it('should not call opensearch update method if event.content["m.relates_to"].rel_type is undefined', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                body: ' * But this room does not have avatar unless you add one',
                'm.mentions': {},
                'm.new_content': {
                  body: 'But this room does not have avatar unless you add one',
                  'm.mentions': {},
                  msgtype: 'm.text'
                },
                'm.relates_to': {
                  event_id: '$GGTg4DaUAHGVL_pHMAJtMz6F2cAK4cUXug-vkRG-yZQ'
                },
                msgtype: 'm.text'
              },
              event_id: '$lDH6ZUNilncsYuFpkV-6xmQH9QZM3_KZVVBI95dY6XA',
              room_id: 'room6',
              sender: '@toto:example.com',
              type: 'm.room.message',
              user_id: '@toto:example.com'
            }
          ]
        })
      expect(mockUpdate).toHaveBeenCalledTimes(0)
    })

    it('should not call opensearch update method if event.content["m.relates_to"].rel_type is null', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                body: ' * But this room does not have avatar unless you add one',
                'm.mentions': {},
                'm.new_content': {
                  body: 'But this room does not have avatar unless you add one',
                  'm.mentions': {},
                  msgtype: 'm.text'
                },
                'm.relates_to': {
                  event_id: '$GGTg4DaUAHGVL_pHMAJtMz6F2cAK4cUXug-vkRG-yZQ',
                  rel_type: null
                },
                msgtype: 'm.text'
              },
              event_id: '$lDH6ZUNilncsYuFpkV-6xmQH9QZM3_KZVVBI95dY6XA',
              room_id: 'room6',
              sender: '@toto:example.com',
              type: 'm.room.message',
              user_id: '@toto:example.com'
            }
          ]
        })
      expect(mockUpdate).toHaveBeenCalledTimes(0)
    })

    it('should not call opensearch update method if event.content["m.relates_to"].rel_type is not equal to "m.replace"', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                body: ' * But this room does not have avatar unless you add one',
                'm.mentions': {},
                'm.new_content': {
                  body: 'But this room does not have avatar unless you add one',
                  'm.mentions': {},
                  msgtype: 'm.text'
                },
                'm.relates_to': {
                  event_id: '$GGTg4DaUAHGVL_pHMAJtMz6F2cAK4cUXug-vkRG-yZQ',
                  rel_type: 'falsy'
                },
                msgtype: 'm.text'
              },
              event_id: '$lDH6ZUNilncsYuFpkV-6xmQH9QZM3_KZVVBI95dY6XA',
              room_id: 'room6',
              sender: '@toto:example.com',
              type: 'm.room.message',
              user_id: '@toto:example.com'
            }
          ]
        })
      expect(mockUpdate).toHaveBeenCalledTimes(0)
    })

    it('should not call opensearch update method if it is an encrypted room', async () => {
      jest
        .spyOn(testServer.matrixDb, 'get')
        .mockResolvedValue([{ encryption: 'test' }] as unknown as DbGetResult)
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                body: ' * But this room does not have avatar unless you add one',
                'm.mentions': {},
                'm.new_content': {
                  body: 'But this room does not have avatar unless you add one',
                  'm.mentions': {},
                  msgtype: 'm.text'
                },
                'm.relates_to': {
                  event_id: '$GGTg4DaUAHGVL_pHMAJtMz6F2cAK4cUXug-vkRG-yZQ',
                  rel_type: 'm.replace'
                },
                msgtype: 'm.text'
              },
              event_id: '$lDH6ZUNilncsYuFpkV-6xmQH9QZM3_KZVVBI95dY6XA',
              room_id: 'room6',
              sender: '@toto:example.com',
              type: 'm.room.message',
              user_id: '@toto:example.com'
            }
          ]
        })
      expect(mockUpdate).toHaveBeenCalledTimes(0)
    })

    it('should not call logger error method if no problem occurs', async () => {
      await supertest(app)
        .put(`/_matrix/app/v1/transactions/${transactionId}`)
        .auth(homeServerToken, {
          type: 'bearer'
        })
        .send({
          events: [
            {
              content: {
                body: ' * But this room does not have avatar unless you add one',
                'm.mentions': {},
                'm.new_content': {
                  body: 'But this room does not have avatar unless you add one',
                  'm.mentions': {},
                  msgtype: 'm.text'
                },
                'm.relates_to': {
                  event_id: '$GGTg4DaUAHGVL_pHMAJtMz6F2cAK4cUXug-vkRG-yZQ',
                  rel_type: 'm.replace'
                },
                msgtype: 'm.text'
              },
              event_id: '$lDH6ZUNilncsYuFpkV-6xmQH9QZM3_KZVVBI95dY6XA',
              room_id: 'room6',
              sender: '@toto:example.com',
              type: 'm.room.message',
              user_id: '@toto:example.com'
            }
          ]
        })
      expect(loggerErrorSpyOn).toHaveBeenCalledTimes(0)
      expect(mockUpdate).toHaveBeenCalledTimes(1)
    })
  })
})
