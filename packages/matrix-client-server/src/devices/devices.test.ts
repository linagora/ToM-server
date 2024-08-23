import fs from 'fs'
import request from 'supertest'
import express from 'express'
import ClientServer from '../index'
import { buildMatrixDb, buildUserDB } from '../__testData__/buildUserDB'
import { type Config } from '../types'
import defaultConfig from '../__testData__/registerConf.json'
import { getLogger, type TwakeLogger } from '@twake/logger'
import { setupTokens, validToken } from '../__testData__/setupTokens'
import { randomString } from '@twake/crypto'
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
    matrix_database_host: 'src/__testData__/devicesTestMatrix.db',
    userdb_host: 'src/__testData__/devicesTest.db',
    database_host: 'src/__testData__/devicesTest.db',
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
  fs.unlinkSync('src/__testData__/devicesTest.db')
  fs.unlinkSync('src/__testData__/devicesTestMatrix.db')
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

        describe('DELETE', () => {
          it('should refuse an invalid auth token', async () => {
            const response = await request(app)
              .delete(`/_matrix/client/v3/devices/${_device_id}`)
              .set('Authorization', `Bearer ${validToken}`)
              .send({
                devices: ['device1', 'device2'],
                auth: { invalid: 'auth' }
              })
            expect(response.status).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should refuse an invalid deviceId', async () => {
            const response = await request(app)
              .delete(`/_matrix/client/v3/devices/${randomString(1000)}`)
              .set('Authorization', `Bearer ${validToken}`)
              .send({
                devices: ['device1', 'device2']
              })
            expect(response.status).toBe(400)
            expect(response.body).toHaveProperty('errcode', 'M_INVALID_PARAM')
          })
          it('should delete a device', async () => {
            const response1 = await request(app)
              .delete(`/_matrix/client/v3/devices/${_device_id}`)
              .set('Authorization', `Bearer ${validToken}`)
              .send({})
            expect(response1.status).toBe(401)
            expect(response1.body).toHaveProperty('session')
            const session = response1.body.session
            const response = await request(app)
              .delete(`/_matrix/client/v3/devices/${_device_id}`)
              .set('Authorization', `Bearer ${validToken}`)
              .send({
                devices: [_device_id],
                auth: {
                  type: 'm.login.password',
                  identifier: { type: 'm.id.user', user: testUserId },
                  password:
                    '$2a$10$zQJv3V3Kjw7Jq7Ww1X7z5e1QXsVd1m3JdV9vG6t8Jv7jQz4Z5J1QK',
                  session
                }
              })
            expect(response.status).toBe(200)
            const devices = await clientServer.matrixDb.get(
              'devices',
              ['device_id'],
              { device_id: _device_id }
            )
            expect(devices).toHaveLength(0)
          })
        })
      })
    })
  })
})
