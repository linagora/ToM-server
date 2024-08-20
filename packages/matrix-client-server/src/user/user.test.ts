import fs from 'fs'
import request from 'supertest'
import express from 'express'
import ClientServer from '../index'
import { buildMatrixDb, buildUserDB } from '../__testData__/buildUserDB'
import { type Config, type Filter } from '../types'
import defaultConfig from '../__testData__/registerConf.json'
import { getLogger, type TwakeLogger } from '@twake/logger'
import {
  setupTokens,
  validToken,
  validToken2
} from '../__testData__/setupTokens'
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
    database_host: 'src/__testData__/userTest.db',
    registration_required_3pid: ['email', 'msisdn']
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
      const content = { content_key: 'content value' }
      const content2 = { content_key: 'content value 2' }
      let longContentValue = ''
      for (let i = 0; i < 10000; i++) {
        longContentValue += 'a'
      }
      const longContent = { content_key: longContentValue }
      describe('/_matrix/client/v3/user/:userId/account_data/:type', () => {
        describe('PUT', () => {
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
            expect(response.body).toHaveProperty('errcode', 'M_NOT_JSON') // Error code from jsonContent function of @twake/utils
          })
          it('should refuse to update account data for another user', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@anotheruser:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send(content)
            expect(response.statusCode).toBe(403)
            expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
          })
          it('should refuse content that is too long', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send(longContent)
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should refuse to update account data for an event type managed by the server', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/account_data/m.push_rules'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send(content)
            expect(response.statusCode).toBe(405)
            expect(response.body).toHaveProperty('errcode', 'M_BAD_JSON')
            const response2 = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/account_data/m.fully_read'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send(content)
            expect(response2.statusCode).toBe(405)
            expect(response2.body).toHaveProperty('errcode', 'M_BAD_JSON')
          })
          it('should insert account data', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send(content)
            expect(response.statusCode).toBe(200)
          })
          it('should update account data', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send(content2)
            expect(response.statusCode).toBe(200)
          })
        })
        describe('GET', () => {
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
                '/_matrix/client/v3/user/@testuser:example.com/account_data/m.other.type'
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
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/@testuser:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(200)
            expect(response.body).toEqual(content2)
          })
        })
      })

      describe('/_matrix/client/v3/user/:userId/rooms/:roomId/account_data/:type', () => {
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
            expect(response.body).toHaveProperty('errcode', 'M_NOT_JSON') // Error code from jsonContent function of @twake/utils
          })
          it('should refuse to update account data for another user', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@anotheruser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send(content)
            expect(response.statusCode).toBe(403)
            expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
          })
          it('should refuse content that is too long', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send(longContent)
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should refuse to update account data for an event type managed by the server', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.push_rules'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send(content)
            expect(response.statusCode).toBe(405)
            expect(response.body).toHaveProperty('errcode', 'M_BAD_JSON')
            const response2 = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.fully_read'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send(content)
            expect(response2.statusCode).toBe(405)
            expect(response2.body).toHaveProperty('errcode', 'M_BAD_JSON')
          })
          it('should insert account data', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send(content)
            expect(response.statusCode).toBe(200)
          })
          it('should update account data', async () => {
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send(content2)
            expect(response.statusCode).toBe(200)
          })
        })
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
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.other.type'
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
            const response = await request(app)
              .get(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
            expect(response.statusCode).toBe(200)
            expect(response.body).toEqual(content2)
          })
        })
      })
    })
    describe('/_matrix/client/v3/user/:userId/openid/request_token', () => {
      it('should reject invalid userId', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/user/invalidUserId/openid/request_token')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      })
      it('should reject a userId that does not match the token', async () => {
        const response = await request(app)
          .post(
            '/_matrix/client/v3/user/@testuser:example.com/openid/request_token'
          )
          .set('Authorization', `Bearer ${validToken2}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(403)
        expect(response.body).toHaveProperty('errcode', 'M_FORBIDDEN')
      })
      it('should return a token on a valid attempt', async () => {
        const response = await request(app)
          .post(
            '/_matrix/client/v3/user/@testuser:example.com/openid/request_token'
          )
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(200)
        expect(response.body).toHaveProperty('access_token')
        expect(response.body).toHaveProperty('expires_in')
        expect(response.body).toHaveProperty('matrix_server_name')
        expect(response.body).toHaveProperty('token_type')
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
  describe('/_matrix/client/v3/register', () => {
    let session: string
    it('should validate UIAuth with msisdn and email verification', async () => {
      const response1 = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'user' })
        .send({
          username: 'new_user',
          device_id: 'device_Id',
          inhibit_login: true,
          initial_device_display_name: 'testdevice'
        })
      expect(response1.statusCode).toBe(401)
      expect(response1.body).toHaveProperty('session')
      session = response1.body.session
      const response2 = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'user' })
        .send({
          username: 'new_user',
          device_id: 'device_Id',
          inhibit_login: true,
          initial_device_display_name: 'testdevice',
          auth: {
            type: 'm.login.msisdn',
            session,
            threepid_creds: {
              sid: 'validatedSession',
              client_secret: 'validatedSecret'
            }
          }
        })
      expect(response2.statusCode).toBe(401)
      expect(response2.body).toHaveProperty('completed')
      expect(response2.body.completed).toEqual(['m.login.msisdn'])
      const response3 = await request(app)
        .post('/_matrix/client/v3/register')
        .set('User-Agent', 'curl/7.31.0-DEV')
        .set('X-Forwarded-For', '203.0.113.195')
        .query({ kind: 'user' })
        .send({
          username: 'new_user',
          device_id: 'device_Id',
          inhibit_login: true,
          initial_device_display_name: 'testdevice',
          auth: {
            type: 'm.login.email.identity',
            session,
            threepid_creds: {
              sid: 'validatedSession2',
              client_secret: 'validatedSecret2'
            }
          }
        })
      expect(response3.statusCode).toBe(200)
    })
  })
})
