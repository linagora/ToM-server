import fs from 'fs'
import request from 'supertest'
import express from 'express'
import ClientServer from './index'
import { buildMatrixDb, buildUserDB } from './__testData__/buildUserDB'
import { type Config } from './types'
import defaultConfig from './__testData__/registerConf.json'
import { getLogger, type TwakeLogger } from '@twake/logger'
import { randomString } from '@twake/crypto'
import {
  setupTokens,
  validToken,
  validRefreshToken1,
  validRefreshToken2
} from './__testData__/setupTokens'
// import * as deleteDevicesModule from './delete_devices'

process.env.TWAKE_CLIENT_SERVER_CONF = './src/__testData__/registerConf.json'
jest.mock('node-fetch', () => jest.fn())
const sendMailMock = jest.fn()
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: sendMailMock
  }))
}))
// const deleteMessagesBetweenStreamIdsMock = jest.fn()
// jest
//   .spyOn(deleteDevicesModule, 'deleteMessagesBetweenStreamIds')
//   .mockImplementation(deleteMessagesBetweenStreamIdsMock)

let conf: Config
let clientServer: ClientServer
let app: express.Application

const logger: TwakeLogger = getLogger()

beforeAll((done) => {
  // @ts-expect-error TS doesn't understand that the config is valid
  conf = {
    ...defaultConfig,
    base_url: 'http://example.com/'
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
  fs.unlinkSync('src/__testData__/test.db')
  fs.unlinkSync('src/__testData__/testMatrix.db')
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Error on server start', () => {
  process.env.HASHES_RATE_LIMIT = 'falsy_number'

  it('should display message error about hashes rate limit value', () => {
    expect(() => {
      clientServer = new ClientServer()
    }).toThrow(
      new Error(
        'hashes_rate_limit must be a number or a string representing a number'
      )
    )
    delete process.env.HASHES_RATE_LIMIT
  })
})

describe('Use configuration file', () => {
  beforeAll((done) => {
    clientServer = new ClientServer()
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

  test('Reject unimplemented endpoint with 404', async () => {
    const response = await request(app).get('/_matrix/unknown')
    expect(response.statusCode).toBe(404)
  })

  test('Reject bad method with 405', async () => {
    const response = await request(app).post(
      '/_matrix/client/v3/account/whoami'
    )
    expect(response.statusCode).toBe(405)
  })

  describe('/_matrix/client/versions', () => {
    it('sould correctly provide supported versions', async () => {
      const response = await request(app).get('/_matrix/client/versions')
      expect(response.statusCode).toBe(200)
    })
  })

  it('should return true if provided user is hosted on local server', async () => {
    expect(clientServer.isMine('@testuser:example.com')).toBe(true)
  })

  it('should return false if provided user is hosted on remote server', async () => {
    expect(clientServer.isMine('@testuser:remote.com')).toBe(false)
  })

  describe('Endpoints with authentication', () => {
    beforeAll(async () => {
      await setupTokens(clientServer, logger)
    })
    describe('/_matrix/client/v3/refresh', () => {
      it('should refuse a request without refresh token', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/refresh')
          .send({})
        expect(response.statusCode).toBe(400)
        expect(response.body.errcode).toBe('M_MISSING_PARAMS')
      })
      it('should refuse a request with an unknown refresh token', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/refresh')
          .send({ refresh_token: 'unknownToken' })
        expect(response.statusCode).toBe(400)
        expect(response.body.errcode).toBe('M_UNKNOWN_TOKEN')
      })
      it('should refuse a request with an expired refresh token', async () => {
        await clientServer.matrixDb.insert('refresh_tokens', {
          id: 0,
          user_id: 'expiredUser',
          device_id: 'expiredDevice',
          token: 'expiredToken',
          expiry_ts: 0
        })
        const response = await request(app)
          .post('/_matrix/client/v3/refresh')
          .send({ refresh_token: 'expiredToken' })
        expect(response.statusCode).toBe(401)
        expect(response.body.errcode).toBe('INVALID_TOKEN')
      })
      it('should send the next request token if the token sent in the request has such a field in the DB', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/refresh')
          .send({ refresh_token: validRefreshToken1 })
        expect(response.statusCode).toBe(200)
        expect(response.body).toHaveProperty('access_token')
        expect(response.body).toHaveProperty('refresh_token')
        expect(response.body.refresh_token).toBe(validRefreshToken2)
      })
      it('should generate a new refresh token  and access token if there was no next token in the DB', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/refresh')
          .send({ refresh_token: validRefreshToken2 })
        expect(response.statusCode).toBe(200)
        expect(response.body).toHaveProperty('access_token')
        expect(response.body).toHaveProperty('refresh_token')
      })
    })

    describe('/_matrix/client/v3/admin/whois', () => {
      it('should refuse a request without a userId', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/admin/whois')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(400)
      })
      it('should send device information for the user being looked-up', async () => {
        await clientServer.matrixDb.insert('user_ips', {
          user_id: '@testuser:example.com',
          device_id: 'testdevice',
          access_token: validToken,
          ip: '10.0.0.2',
          user_agent:
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36',
          last_seen: 1411996332123
        })
        const response = await request(app)
          .get('/_matrix/client/v3/admin/whois')
          .query({ userId: '@testuser:example.com' })
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(200)
        expect(response.body).toHaveProperty('user_id', '@testuser:example.com')
        expect(response.body).toHaveProperty('devices')
        expect(response.body.devices).toHaveProperty('testdevice')
        expect(response.body.devices.testdevice).toHaveProperty('sessions')
        expect(response.body.devices.testdevice.sessions).toHaveLength(1)
        expect(response.body.devices.testdevice.sessions).toEqual([
          {
            connections: [
              {
                ip: '127.0.0.1',
                last_seen: 1411996332123,
                user_agent: 'curl/7.31.0-DEV'
              },
              {
                ip: '10.0.0.2',
                last_seen: 1411996332123,
                user_agent:
                  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36'
              }
            ]
          }
        ])
      })
      it('should work if the user has multiple devices and with multiple sessions', async () => {
        const validTokenbis = randomString(64)
        await clientServer.matrixDb.insert('user_ips', {
          user_id: '@testuser:example.com',
          device_id: 'testdevice2',
          access_token: validTokenbis,
          ip: '127.0.0.1',
          last_seen: 1411996332123,
          user_agent: 'curl/7.31.0-DEV'
        })
        const response = await request(app)
          .get('/_matrix/client/v3/admin/whois')
          .query({ userId: '@testuser:example.com' })
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(200)
        expect(response.body).toHaveProperty('user_id', '@testuser:example.com')
        expect(response.body).toHaveProperty('devices')
        expect(response.body.devices).toHaveProperty('testdevice')
        expect(response.body.devices).toHaveProperty('testdevice2')
        expect(response.body.devices.testdevice2).toHaveProperty('sessions')
        expect(response.body.devices.testdevice2.sessions).toHaveLength(1)
        expect(response.body.devices.testdevice2.sessions).toEqual([
          {
            connections: [
              {
                ip: '127.0.0.1',
                last_seen: 1411996332123,
                user_agent: 'curl/7.31.0-DEV'
              }
            ]
          }
        ])
      })
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
        it('should refuse content that is too long', async () => {
          let content = ''
          for (let i = 0; i < 10000; i++) {
            content += 'a'
          }
          const response = await request(app)
            .put(
              '/_matrix/client/v3/user/@testuser:example.com/account_data/m.room.message'
            )
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({ content })
          expect(response.statusCode).toBe(400)
          expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
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
          it('should refuse content that is too long', async () => {
            let content = ''
            for (let i = 0; i < 10000; i++) {
              content += 'a'
            }
            const response = await request(app)
              .put(
                '/_matrix/client/v3/user/@testuser:example.com/rooms/!roomId:example.com/account_data/m.room.message'
              )
              .set('Authorization', `Bearer ${validToken}`)
              .set('Accept', 'application/json')
              .send({ content })
            expect(response.statusCode).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
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
    })

    describe('/_matrix/client/v3/devices', () => {
      const testUserId = '@testuser:example.com'

      beforeAll(async () => {
        try {
          await clientServer.matrixDb.insert('devices', {
            user_id: testUserId,
            device_id: 'testdevice1',
            display_name: 'Test Device 1',
            last_seen: 1411996332123,
            ip: '127.0.0.1',
            user_agent: 'curl/7.31.0-DEV'
          })
          logger.info('Test device 1 created')

          await clientServer.matrixDb.insert('devices', {
            user_id: testUserId,
            device_id: 'testdevice2',
            display_name: 'Test Device 2',
            last_seen: 14119963321254,
            ip: '127.0.0.2',
            user_agent: 'curl/7.31.0-DEV'
          })
          logger.info('Test device 2 created')
        } catch (e) {
          logger.error('Error creating devices:', e)
        }
      })

      afterAll(async () => {
        try {
          await clientServer.matrixDb.deleteEqual(
            'devices',
            'device_id',
            'testdevice1'
          )
          logger.info('Test device 1 deleted')

          await clientServer.matrixDb.deleteEqual(
            'devices',
            'device_id',
            'testdevice2'
          )
          logger.info('Test device 2 deleted')
        } catch (e) {
          logger.error('Error deleting devices:', e)
        }
      })

      it('should return 401 if the user is not authenticated', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/devices')
          .set('Authorization', 'Bearer invalidToken')
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(401)
      })

      it('should return all devices for the current user', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/devices')
          .set('Authorization', `Bearer ${validToken}`)

        expect(response.statusCode).toBe(200)

        expect(response.body).toHaveProperty('devices')
        expect(response.body.devices).toHaveLength(2)
        expect(response.body.devices[0]).toHaveProperty('device_id')
        expect(response.body.devices[0]).toHaveProperty('display_name')
        expect(response.body.devices[0]).toHaveProperty('last_seen_ts')
        expect(response.body.devices[0]).toHaveProperty('last_seen_ip')
      })
    })

    describe('/_matrix/client/v3/devices/:deviceId', () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      let _device_id: string
      beforeAll(async () => {
        try {
          _device_id = 'testdevice2_id'
          await clientServer.matrixDb.insert('devices', {
            user_id: '@testuser:example.com',
            device_id: _device_id,
            display_name: 'testdevice2_name',
            last_seen: 12345678,
            ip: '127.0.0.1',
            user_agent: 'curl/7.31.0-DEV',
            hidden: 0
          })

          await clientServer.matrixDb.insert('devices', {
            user_id: '@testuser2:example.com',
            device_id: 'another_device_id',
            display_name: 'another_name',
            last_seen: 12345678,
            ip: '127.0.0.1',
            user_agent: 'curl/7.31.0-DEV',
            hidden: 0
          })
          logger.info('Devices inserted in db')
        } catch (e) {
          logger.error('Error when inserting devices', e)
        }
      })

      afterAll(async () => {
        try {
          await clientServer.matrixDb.deleteEqual(
            'devices',
            'device_id',
            _device_id
          )
          await clientServer.matrixDb.deleteEqual(
            'devices',
            'device_id',
            'another_device_id'
          )
          logger.info('Devices deleted from db')
        } catch (e) {
          logger.error('Error when deleting devices', e)
        }
      })

      describe('GET', () => {
        it('should return the device information for the given device ID', async () => {
          const response = await request(app)
            .get(`/_matrix/client/v3/devices/${_device_id}`)
            .set('Authorization', `Bearer ${validToken}`)

          expect(response.statusCode).toBe(200)

          expect(response.body).toHaveProperty('device_id')
          expect(response.body.device_id).toEqual(_device_id)
          expect(response.body).toHaveProperty('display_name')
          expect(response.body.display_name).toEqual('testdevice2_name')
          expect(response.body).toHaveProperty('last_seen_ip')
          expect(response.body.last_seen_ip).toEqual('127.0.0.1')
          expect(response.body).toHaveProperty('last_seen_ts')
          expect(response.body.last_seen_ts).toEqual(12345678)
        })

        it('should return 404 if the device ID does not exist', async () => {
          const deviceId = 'NON_EXISTENT_DEVICE_ID'
          const response = await request(app)
            .get(`/_matrix/client/v3/devices/${deviceId}`)
            .set('Authorization', `Bearer ${validToken}`)

          expect(response.statusCode).toBe(404)
        })

        it('should return 404 if the user has no device with the given device Id', async () => {
          const response = await request(app)
            .get(`/_matrix/client/v3/devices/another_device_id`)
            .set('Authorization', `Bearer ${validToken}`)

          expect(response.statusCode).toBe(404)
        })

        it('should return 401 if the user is not authenticated', async () => {
          const response = await request(app).get(
            `/_matrix/client/v3/devices/${_device_id}`
          )

          expect(response.statusCode).toBe(401)
        })
      })

      describe('PUT', () => {
        const updateData = {
          display_name: 'updated_device_name'
        }

        it('should update the device information for the given device ID', async () => {
          // Update the device
          const response = await request(app)
            .put(`/_matrix/client/v3/devices/${_device_id}`)
            .set('Authorization', `Bearer ${validToken}`)
            .send(updateData)
          expect(response.statusCode).toBe(200)

          // Verify the update in the database
          const updatedDevice = await clientServer.matrixDb.get(
            'devices',
            ['device_id', 'display_name'],
            { device_id: _device_id }
          )

          expect(updatedDevice[0]).toHaveProperty('device_id', _device_id)
          expect(updatedDevice[0]).toHaveProperty(
            'display_name',
            updateData.display_name
          )
        })

        it('should return 400 if the display_name is too long', async () => {
          const response = await request(app)
            .put(`/_matrix/client/v3/devices/${_device_id}`)
            .set('Authorization', `Bearer ${validToken}`)
            .send({ display_name: randomString(257) })

          expect(response.statusCode).toBe(400)
          expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
        })

        it('should return 404 if the device ID does not exist', async () => {
          const response = await request(app)
            .put('/_matrix/client/v3/devices/NON_EXISTENT_DEVICE_ID')
            .set('Authorization', `Bearer ${validToken}`)
            .send(updateData)

          expect(response.statusCode).toBe(404)
        })

        it('should return 404 if the user has no device with the given device ID', async () => {
          const deviceId = 'another_device_id'
          const response = await request(app)
            .put(`/_matrix/client/v3/devices/${deviceId}`)
            .set('Authorization', `Bearer ${validToken}`)
            .send(updateData)

          expect(response.statusCode).toBe(404)
        })

        it('should return 401 if the user is not authenticated', async () => {
          const response = await request(app)
            .put(`/_matrix/client/v3/devices/${_device_id}`)
            .send(updateData)

          expect(response.statusCode).toBe(401)
        })
      })
    })

    describe('/_matrix/client/v3/directory/list/room/:roomId', () => {
      describe('GET', () => {
        const publicRoomId = '!testroomid:example.com'
        const privateRoomId = '!private:example.com'

        beforeAll(async () => {
          try {
            await clientServer.matrixDb.insert('rooms', {
              room_id: publicRoomId,
              is_public: 1
            })

            await clientServer.matrixDb.insert('rooms', {
              room_id: privateRoomId,
              is_public: 0
            })

            await clientServer.matrixDb.insert('rooms', {
              room_id: '!anotherroomid:example.com'
            })
          } catch (e) {
            logger.error('Error setting up test data:', e)
          }
        })

        afterAll(async () => {
          try {
            await clientServer.matrixDb.deleteEqual(
              'rooms',
              'room_id',
              publicRoomId
            )

            await clientServer.matrixDb.deleteEqual(
              'rooms',
              'room_id',
              privateRoomId
            )

            await clientServer.matrixDb.deleteEqual(
              'rooms',
              'room_id',
              '!anotherroomid:example.com'
            )
          } catch (e) {
            logger.error('Error tearing down test data:', e)
          }
        })

        it('should return the correct visibility for a public room', async () => {
          const response = await request(app).get(
            `/_matrix/client/v3/directory/list/room/${publicRoomId}`
          )
          expect(response.statusCode).toBe(200)
          expect(response.body).toEqual({
            visibility: 'public'
          })
        })

        it('should return the correct visibility for a private room', async () => {
          const response = await request(app).get(
            `/_matrix/client/v3/directory/list/room/${privateRoomId}`
          )
          expect(response.statusCode).toBe(200)
          expect(response.body).toEqual({
            visibility: 'private'
          })
        })

        it('should return private visibility if no visibility is set', async () => {
          const response = await request(app).get(
            `/_matrix/client/v3/directory/list/room/!anotherroomid:example.com`
          )
          expect(response.statusCode).toBe(200)
          expect(response.body).toEqual({
            visibility: 'private'
          })
        })

        it('should return 404 if the room is not found', async () => {
          const invalidRoomId = '!invalidroomid:example.com'
          const response = await request(app).get(
            `/_matrix/client/v3/directory/list/room/${invalidRoomId}`
          )
          expect(response.statusCode).toBe(404)
          expect(response.body).toEqual({
            errcode: 'M_NOT_FOUND',
            error: 'Room not found'
          })
        })
      })

      describe('PUT', () => {
        const testRoomId = '!testroomid:example.com'

        beforeAll(async () => {
          try {
            await clientServer.matrixDb.insert('rooms', {
              room_id: testRoomId,
              is_public: 1
            })
          } catch (e) {
            logger.error('Error setting up test data:', e)
          }
        })

        afterAll(async () => {
          try {
            await clientServer.matrixDb.deleteEqual(
              'rooms',
              'room_id',
              testRoomId
            )
          } catch (e) {
            logger.error('Error tearing down test data:', e)
          }
        })

        it('should require authentication', async () => {
          const response = await request(app)
            .put(`/_matrix/client/v3/directory/list/room/${testRoomId}`)
            .set('Authorization', 'Bearer invalidToken')
            .set('Accept', 'application/json')
            .send({ visibility: 'private' })
          expect(response.statusCode).toBe(401)
        })

        it('should return 400 invalidParams if wrong parameters given', async () => {
          const response = await request(app)
            .put(`/_matrix/client/v3/directory/list/room/${testRoomId}`)
            .set('Authorization', `Bearer ${validToken}`)
            .set('Accept', 'application/json')
            .send({ visibility: 'wrongParams' })
          expect(response.statusCode).toBe(400)
          expect(response.body.errcode).toBe('M_INVALID_PARAM')
        })

        it('should update the visibility of the room', async () => {
          const response = await request(app)
            .put(`/_matrix/client/v3/directory/list/room/${testRoomId}`)
            .set('Authorization', `Bearer ${validToken}`)
            .send({ visibility: 'private' })
          expect(response.statusCode).toBe(200)

          const row = await clientServer.matrixDb.get('rooms', ['is_public'], {
            room_id: testRoomId
          })
          expect(row[0].is_public).toBe(0)
        })

        it('should update the visibility of the room', async () => {
          const response = await request(app)
            .put(`/_matrix/client/v3/directory/list/room/${testRoomId}`)
            .set('Authorization', `Bearer ${validToken}`)
            .send({ visibility: 'public' })
          expect(response.statusCode).toBe(200)

          const row = await clientServer.matrixDb.get('rooms', ['is_public'], {
            room_id: testRoomId
          })
          expect(row[0].is_public).toBe(1)
        })

        it('should return 404 if the room is not found', async () => {
          const invalidRoomId = '!invalidroomid:example.com'
          const response = await request(app)
            .put(`/_matrix/client/v3/directory/list/room/${invalidRoomId}`)
            .set('Authorization', `Bearer ${validToken}`)
            .send({ visibility: 'private' })
          expect(response.statusCode).toBe(404)
          expect(response.body).toEqual({
            errcode: 'M_NOT_FOUND',
            error: 'Room not found'
          })
        })
      })
    })

    describe('/_matrix/client/v3/capabilities', () => {
      it('should require authentication', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/capabilities')
          .set('Authorization', 'Bearer invalid_token')
          .set('Accept', 'application/json')
        expect(response.statusCode).toBe(401)
      })

      it('should return the capabilities of the server', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/capabilities')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')

        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty('capabilities')
        // expect(response.body.capabilities).toHaveProperty('m.room_versions')
        expect(response.body.capabilities).toHaveProperty(['m.change_password'])
        expect(response.body.capabilities).toHaveProperty(['m.set_displayname'])
        expect(response.body.capabilities).toHaveProperty(['m.set_avatar_url'])
        expect(response.body.capabilities).toHaveProperty(['m.3pid_changes'])
      })

      it('should return rigth format for m.change_password capability', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/capabilities')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')

        expect(response.status).toBe(200)
        expect(response.body.capabilities).toHaveProperty(['m.change_password'])
        expect(response.body.capabilities['m.change_password']).toHaveProperty(
          'enabled'
        )
        const numKeyValuePairs = Object.keys(
          response.body.capabilities['m.change_password']
        ).length
        expect(numKeyValuePairs).toBe(1)
      })

      it('should return rigth format for m.set_displayname capability', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/capabilities')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')

        expect(response.status).toBe(200)
        expect(response.body.capabilities).toHaveProperty(['m.set_displayname'])
        expect(response.body.capabilities['m.set_displayname']).toHaveProperty(
          'enabled'
        )
        const numKeyValuePairs = Object.keys(
          response.body.capabilities['m.set_displayname']
        ).length
        expect(numKeyValuePairs).toBe(1)
      })

      it('should return rigth format for m.set_avatar_url capability', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/capabilities')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')

        expect(response.status).toBe(200)
        expect(response.body.capabilities).toHaveProperty(['m.set_avatar_url'])
        expect(response.body.capabilities['m.set_avatar_url']).toHaveProperty(
          'enabled'
        )
        const numKeyValuePairs = Object.keys(
          response.body.capabilities['m.set_avatar_url']
        ).length
        expect(numKeyValuePairs).toBe(1)
      })

      it('should return rigth format for m.3pid_changes capability', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/capabilities')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')

        expect(response.status).toBe(200)
        expect(response.body.capabilities).toHaveProperty(['m.3pid_changes'])
        expect(response.body.capabilities['m.3pid_changes']).toHaveProperty(
          'enabled'
        )
        const numKeyValuePairs = Object.keys(
          response.body.capabilities['m.3pid_changes']
        ).length
        expect(numKeyValuePairs).toBe(1)
      })

      it('should return rigth format for m.room_versions capability', async () => {
        const response = await request(app)
          .get('/_matrix/client/v3/capabilities')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Accept', 'application/json')

        expect(response.status).toBe(200)
        expect(response.body.capabilities).toHaveProperty(['m.room_versions'])
        expect(response.body.capabilities['m.room_versions']).toHaveProperty(
          'default'
        )
        expect(response.body.capabilities['m.room_versions']).toHaveProperty(
          'available'
        )
        const numKeyValuePairs = Object.keys(
          response.body.capabilities['m.room_versions']
        ).length
        expect(numKeyValuePairs).toBe(2)
      })
    })
    describe('/_matrix/client/v3/delete_devices', () => {
      let session: string
      const userId = '@testuser:example.com'
      it('should return 400 if devices is not an array of strings', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/delete_devices')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ devices: 'not an array' })
        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      })

      it('should return 400 if auth is provided but invalid', async () => {
        const response = await request(app)
          .post('/_matrix/client/v3/delete_devices')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            devices: ['device1', 'device2'],
            auth: { invalid: 'auth' }
          })
        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
      })

      it('should successfully delete devices', async () => {
        await clientServer.matrixDb.insert('devices', {
          device_id: 'device_id',
          user_id: userId,
          display_name: 'Device to delete'
        })
        const response1 = await request(app)
          .post('/_matrix/client/v3/delete_devices')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ devices: ['device_id'] })
        expect(response1.status).toBe(401)
        expect(response1.body).toHaveProperty('session')
        session = response1.body.session
        const response = await request(app)
          .post('/_matrix/client/v3/delete_devices')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            devices: ['device_id'],
            auth: {
              type: 'm.login.password',
              identifier: { type: 'm.id.user', user: userId },
              password:
                '$2a$10$zQJv3V3Kjw7Jq7Ww1X7z5e1QXsVd1m3JdV9vG6t8Jv7jQz4Z5J1QK',
              session
            }
          })
        expect(response.status).toBe(200)
        const devices = await clientServer.matrixDb.get(
          'devices',
          ['device_id'],
          { user_id: userId }
        )
        expect(devices).toHaveLength(0)
      })
      it('should delete associated pushers', async () => {
        await clientServer.matrixDb.insert('devices', {
          device_id: 'device1',
          user_id: userId,
          display_name: 'Test Device'
        })
        await clientServer.matrixDb.insert('pushers', {
          user_name: userId,
          device_display_name: 'Test Device',
          app_id: 'test_app',
          pushkey: 'test_pushkey',
          profile_tag: 'test_profile_tag',
          kind: 'test_kind',
          app_display_name: 'test_app_display_name',
          ts: 0
        })
        const response1 = await request(app)
          .post('/_matrix/client/v3/delete_devices')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ devices: ['device1'] })
        expect(response1.status).toBe(401)
        expect(response1.body).toHaveProperty('session')
        session = response1.body.session
        const response = await request(app)
          .post('/_matrix/client/v3/delete_devices')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            devices: ['device1'],
            auth: {
              type: 'm.login.password',
              session,
              identifier: { type: 'm.id.user', user: userId },
              password:
                '$2a$10$zQJv3V3Kjw7Jq7Ww1X7z5e1QXsVd1m3JdV9vG6t8Jv7jQz4Z5J1QK'
            }
          })
        expect(response.status).toBe(200)

        const pushers = await clientServer.matrixDb.get('pushers', ['app_id'], {
          user_name: userId
        })
        expect(pushers).toHaveLength(0)

        const deletedPushers = await clientServer.matrixDb.get(
          'deleted_pushers',
          ['app_id'],
          { user_id: userId }
        )
        expect(deletedPushers).toHaveLength(1)
        expect(deletedPushers[0].app_id).toBe('test_app')
      })
      it('should delete messages in batches', async () => {
        const deviceId = 'device1'

        // Set up mock data in the database
        await clientServer.matrixDb.insert('devices', {
          device_id: deviceId,
          user_id: userId
        })
        // Insert some device inbox messages
        for (let i = 1; i <= 25; i++) {
          await clientServer.matrixDb.insert('device_inbox', {
            user_id: userId,
            device_id: deviceId,
            stream_id: i,
            message_json: JSON.stringify({ content: `Message ${i}` })
          })
        }

        // deleteMessagesBetweenStreamIdsMock
        //   .mockResolvedValueOnce(2)
        const response1 = await request(app)
          .post('/_matrix/client/v3/delete_devices')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ devices: ['device1'] })
        expect(response1.status).toBe(401)
        expect(response1.body).toHaveProperty('session')
        session = response1.body.session
        const response = await request(app)
          .post('/_matrix/client/v3/delete_devices')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            devices: [deviceId],
            auth: {
              type: 'm.login.password',
              identifier: { type: 'm.id.user', user: userId },
              password:
                '$2a$10$zQJv3V3Kjw7Jq7Ww1X7z5e1QXsVd1m3JdV9vG6t8Jv7jQz4Z5J1QK',
              session
            }
          })
        console.log('body : ', response.body)
        expect(response.status).toBe(200)

        // Verify that deleteMessagesBetweenStreamIds was called multiple times
        // expect(deleteMessagesBetweenStreamIdsMock).toHaveBeenCalledTimes(4)
        // expect(deleteMessagesBetweenStreamIdsMock).toHaveBeenNthCalledWith(
        //   1,
        //   clientServer,
        //   userId,
        //   deviceId,
        //   0,
        //   expect.any(Number),
        //   10
        // )
        // expect(deleteMessagesBetweenStreamIdsMock).toHaveBeenNthCalledWith(
        //   2,
        //   clientServer,
        //   userId,
        //   deviceId,
        //   10,
        //   expect.any(Number),
        //   10
        // )
        // expect(deleteMessagesBetweenStreamIdsMock).toHaveBeenNthCalledWith(
        //   3,
        //   clientServer,
        //   userId,
        //   deviceId,
        //   20,
        //   expect.any(Number),
        //   10
        // )
        // expect(deleteMessagesBetweenStreamIdsMock).toHaveBeenNthCalledWith(
        //   4,
        //   clientServer,
        //   userId,
        //   deviceId,
        //   25,
        //   expect.any(Number),
        //   10
        // )

        // Verify that all messages were deleted
        const remainingMessages = await clientServer.matrixDb.get(
          'device_inbox',
          ['stream_id'],
          { user_id: userId, device_id: deviceId }
        )
        expect(remainingMessages).toHaveLength(0)
      })
    })
  })
})
