import fs from 'fs'
import request from 'supertest'
import express from 'express'
import ClientServer from '../index'
import { buildMatrixDb, buildUserDB } from '../__testData__/buildUserDB'
import { type Config, type Filter } from '../types'
import defaultConfig from '../__testData__/registerConf.json'
import { getLogger, type TwakeLogger } from '@twake/logger'
import { setupTokens, validToken } from '../utils/setupTokens'

jest.mock('node-fetch', () => jest.fn())
const sendMailMock = jest.fn()
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: sendMailMock
  }))
}))

let conf: Config
let clientServer: ClientServer
let app: express.Application

const logger: TwakeLogger = getLogger()

beforeAll((done) => {
  // @ts-expect-error TS doesn't understand that the config is valid
  conf = {
    ...defaultConfig,
    base_url: 'http://example.com/',
    matrix_database_host: 'src/__testData__/userTestMatrix.db',
    userdb_host: 'src/__testData__/userTest.db',
    database_host: 'src/__testData__/userTest.db'
  }
  if (process.env.TEST_PG === 'yes') {
    conf.database_engine = 'pg'
    conf.userdb_engine = 'pg'
    conf.database_host = process.env.PG_HOST ?? 'localhost'
    conf.database_user = process.env.PG_USER ?? 'twake'
    conf.database_password = process.env.PG_PASSWORD ?? 'twake'
    conf.database_name = process.env.PG_DATABASE ?? 'test'
  }
  buildUserDB(conf)
    .then(() => {
      buildMatrixDb(conf)
        .then(() => {
          done()
        })
        .catch((e) => {
          logger.error('Error while building matrix db:', e)
          done(e)
        })
    })
    .catch((e) => {
      logger.error('Error while building user db:', e)
      done(e)
    })
})

afterAll(() => {
  fs.unlinkSync('src/__testData__/userTest.db')
  fs.unlinkSync('src/__testData__/userTestMatrix.db')
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Use configuration file', () => {
  beforeAll((done) => {
    clientServer = new ClientServer(conf)
    app = express()
    clientServer.ready
      .then(() => {
        Object.keys(clientServer.api.get).forEach((k) => {
          app.get(k, clientServer.api.get[k])
        })
        Object.keys(clientServer.api.post).forEach((k) => {
          app.post(k, clientServer.api.post[k])
        })
        Object.keys(clientServer.api.put).forEach((k) => {
          app.put(k, clientServer.api.put[k])
        })
        Object.keys(clientServer.api.delete).forEach((k) => {
          app.delete(k, clientServer.api.delete[k])
        })
        done()
      })
      .catch((e) => {
        done(e)
      })
  })

  afterAll(() => {
    clientServer.cleanJobs()
  })

  describe('Endpoints with authentication', () => {
    beforeAll(async () => {
      await setupTokens(clientServer, logger)
    })

    describe('/_matrix/client/v3/user/:userId', () => {
      describe('/_matrix/client/v3/user/:userId/account_data/:type', () => {
        it('should reject invalid userId', async () => {
          const response = await request(app)
            .get(
              '/_matrix/client/v3/user/invalidUserId/account_data/m.room.message'
            )
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(400)
          expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        })
        it('should reject invalid roomId', async () => {
          const response = await request(app)
            .get(
              '/_matrix/client/v3/user/@testuser:example.com/rooms/invalidRoomId/account_data/m.room.message'
            )
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(400)
          expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        })
        it('should reject an invalid event type', async () => {
          const response = await request(app)
            .get(
              '/_matrix/client/v3/user/@testuser:example.com/account_data/invalidEventType'
            )
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(400)
          expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        })
        it('should reject missing account data', async () => {
          const response = await request(app)
            .get(
              '/_matrix/client/v3/user/@testuser:example.com/account_data/m.room.message'
            )
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(404)
          expect(response.body).toHaveProperty('errcode', 'M_NOT_FOUND')
        })
        it('should refuse to return account data for another user', async () => {
          const response = await request(app)
            .get(
              '/_matrix/client/v3/user/@anotheruser:example.com/account_data/m.room.message'
            )
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(403)
          expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
        })
        it('should return account data', async () => {
          await clientServer.matrixDb.insert('account_data', {
            user_id: '@testuser:example.com',
            account_data_type: 'm.room.message',
            stream_id: 1,
            content: 'test content'
          })
          const response = await request(app)
            .get(
              '/_matrix/client/v3/user/@testuser:example.com/account_data/m.room.message'
            )
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(200)
          expect(response.body['m.room.message']).toBe('test content')
        })
        it('should reject invalid userId', async () => {
          const response = await request(app)
            .put(
              '/_matrix/client/v3/user/invalidUserId/account_data/m.room.message'
            )
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(400)
          expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        })
        it('should reject an invalid event type', async () => {
          const response = await request(app)
            .put(
              '/_matrix/client/v3/user/@testuser:example.com/account_data/invalidEventType'
            )
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(400)
          expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        })
        it('should reject missing account data', async () => {
          const response = await request(app)
            .put(
              '/_matrix/client/v3/user/@testuser:example.com/account_data/m.room.message'
            )
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response.statusCode).toBe(400)
          expect(response.body).toHaveProperty('errcode', 'M_UNKNOWN') // Error code from jsonContent function of @twake/utils
        })
        it('should refuse to update account data for another user', async () => {
          const response = await request(app)
            .put(
              '/_matrix/client/v3/user/@anotheruser:example.com/account_data/m.room.message'
            )
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({ content: 'new content' })
          expect(response.statusCode).toBe(403)
          expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
        })
        it('should update account data', async () => {
          const response = await request(app)
            .put(
              '/_matrix/client/v3/user/@testuser:example.com/account_data/m.room.message'
            )
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({ content: 'updated content' })
          expect(response.statusCode).toBe(200)
          const response2 = await request(app)
            .get(
              '/_matrix/client/v3/user/@testuser:example.com/account_data/m.room.message'
            )
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
          expect(response2.statusCode).toBe(200)
          expect(response2.body['m.room.message']).toBe('updated content')
        })
      })

      describe('/_matrix/client/v3/user/:userId/rooms/:roomId/account_data/:type', () => {
        describe('GET', () => {
          it('should reject invalid userId', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/invalidUserId/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should reject invalid roomId', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/invalidRoomId/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should reject an invalid event type', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/invalidEventType'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should reject missing account data', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(404)
            expect(response.body).toHaveProperty('errcode', 'M_NOT_FOUND')
          })
          it('should refuse to return account data for another user', async () => {
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/@anotheruser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(403)
            expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
          })
          it('should return account data', async () => {
            await clientServer.matrixDb.insert('room_account_data', {
              user_id: '@testuser:example.com',
              account_data_type: 'm.room.message',
              stream_id: 1,
              content: 'test content',
              room_id: '!roomId:example.com'
            })
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(200)
            expect(response.body['m.room.message']).toBe('test content')
          })
        })
        describe('PUT', () => {
          it('should reject invalid userId', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/invalidUserId/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should reject invalid roomId', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/invalidRoomId/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should reject an invalid event type', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/invalidEventType'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should reject missing account data', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_UNKNOWN') // Error code from jsonContent function of @twake/utils
          })
          it('should refuse to update account data for another user', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@anotheruser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ content: 'new content' })
            expect(response.statusCode).toBe(403)
            expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
          })
          it('should update account data', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ content: 'updated content' })
            expect(response.statusCode).toBe(200)
            const response2 = await request(app)
              .get(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response2.statusCode).toBe(200)
            expect(response2.body['m.room.message']).toBe('updated content')
          })
        })
      })
      describe('/_matrix/client/v3/user/:userId/filter', () => {
        beforeAll(async () => {
          try {
            await clientServer.matrixDb.insert('user_filters', {
              user_id: '@testuser:example.com',
              filter_id: '1234',
              filter_json: JSON.stringify({ filter: true })
            })
            await clientServer.matrixDb.insert('user_filters', {
              user_id: '@testuser2:example.com',
              filter_id: '1235',
              filter_json: JSON.stringify({ filter: true })
            })
            await clientServer.matrixDb.insert('user_filters', {
              user_id: '@testuser:example2.com',
              filter_id: '1234',
              filter_json: JSON.stringify({ filter: true })
            })
            logger.info('Filters inserted')
          } catch (e) {
            logger.error('Error inserting filters in db', e)
          }
        })
        afterAll(async () => {
          try {
            await clientServer.matrixDb.deleteEqual(
              'user_filters',
              'user_id',
              '@testuser:example.com'
            )
            await clientServer.matrixDb.deleteEqual(
              'user_filters',
              'user_id',
              '@testuser2:example.com'
            )
            await clientServer.matrixDb.deleteEqual(
              'user_filters',
              'user_id',
              '@testuser:example2.com'
            )
            logger.info('Filters deleted')
          } catch (e) {
            logger.error('Error deleting filters in db', e)
          }
        })
        const filter: Filter = {
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
        }
        let filterId: string

        describe('POST', () => {
          it('should reject invalid parameters', async () => {
            // Additional parameters not supported
            const response = await request(app)
              .post('/_matrix/client/v3/user/@testuser:example.com/filter')
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ notAFilterField: 'test' })
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'UNKNOWN_PARAM')
          })
          it('should reject posting a filter for an other userId', async () => {
            const response = await request(app)
              .post('/_matrix/client/v3/user/@testuser2:example.com/filter')
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send(filter)
            expect(response.statusCode).toBe(403)
            expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
          })
          it('should reject posting a filter for an other server name', async () => {
            const response = await request(app)
              .post('/_matrix/client/v3/user/@testuser:example2.com/filter')
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send(filter)
            expect(response.statusCode).toBe(403)
            expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
          })
          it('should post a filter', async () => {
            const response = await request(app)
              .post('/_matrix/client/v3/user/@testuser:example.com/filter')
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send(filter)
            expect(response.statusCode).toBe(200)
            expect(response.body).toHaveProperty('filter_id')
            filterId = response.body.filter_id
          })
        })
        describe('GET', () => {
          it('should reject getting a filter for an other userId', async () => {
            const response = await request(app)
              .get(
                `/_matrix/client/v3/user/@testuser2:example.com/filter/${filterId}`
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(403)
            expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
          })
          it('should reject getting a filter for an other server name', async () => {
            const response = await request(app)
              .get(
                `/_matrix/client/v3/user/@testuser:example2.com/filter/${filterId}`
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(403)
            expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
          })
          it('should reject getting a filter that does not exist', async () => {
            const response = await request(app)
              .get(
                `/_matrix/client/v3/user/@testuser:example.com/filter/invalidFilterId`
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(404)
            expect(response.body).toHaveProperty('errcode', 'M_NOT_FOUND')
          })
          it('should get a filter', async () => {
            const response = await request(app)
              .get(
                `/_matrix/client/v3/user/@testuser:example.com/filter/${filterId}`
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(200)
            // We can't simply write expect(response.body).toEqual(filter) because many default values were added
            expect(response.body.event_fields).toEqual(filter.event_fields)
            expect(response.body.event_format).toEqual(filter.event_format)
            expect(response.body.presence.not_senders).toEqual(
              filter.presence?.not_senders
            )
            expect(response.body.presence.types).toEqual(filter.presence?.types)
            expect(response.body.room.ephemeral.not_rooms).toEqual(
              filter.room?.ephemeral?.not_rooms
            )
            expect(response.body.room.ephemeral.not_senders).toEqual(
              filter.room?.ephemeral?.not_senders
            )
            expect(response.body.room.ephemeral.types).toEqual(
              filter.room?.ephemeral?.types
            )
            expect(response.body.room.state.not_rooms).toEqual(
              filter.room?.state?.not_rooms
            )
            expect(response.body.room.state.types).toEqual(
              filter.room?.state?.types
            )
            expect(response.body.room.timeline.limit).toEqual(
              filter.room?.timeline?.limit
            )
            expect(response.body.room.timeline.not_rooms).toEqual(
              filter.room?.timeline?.not_rooms
            )
            expect(response.body.room.timeline.not_senders).toEqual(
              filter.room?.timeline?.not_senders
            )
            expect(response.body.room.timeline.types).toEqual(
              filter.room?.timeline?.types
            )
          })
        })
      })
    })
  })
})
