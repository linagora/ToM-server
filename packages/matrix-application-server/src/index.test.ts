import MatrixApplicationServer, { type Config } from '.'
import defaultConfig from './config.json'
import fs from 'fs'
import path from 'path'
import testConfig from './__testData__/config.json'
import express from 'express'
import request from 'supertest'

const endpointPrefix = '/_matrix/app/v1'
const transactionEndpoint = endpointPrefix + '/transactions/1'
const homeserverToken =
  'hsTokenTestwdakZQunWWNe3DZitAerw9aNqJ2a6HVp0sJtg7qTJWXcHnBjgN0NL'
const registrationFilePath = path.join(__dirname, '..', 'registration.yaml')

describe('MatrixApplicationServer', () => {
  let appServer: MatrixApplicationServer

  describe('getConfigurationFile', () => {
    afterEach(() => {
      if (fs.existsSync(registrationFilePath)) {
        fs.unlinkSync(registrationFilePath)
      }
    })

    it('should return config from file linked to process.env.TWAKE_AS_SERVER_CONF', async () => {
      process.env.TWAKE_AS_SERVER_CONF = path.join(
        __dirname,
        '__testData__',
        'config.json'
      )
      appServer = new MatrixApplicationServer()
      expect(appServer.conf).toStrictEqual(testConfig)
    })

    it('should return default config', async () => {
      delete process.env.TWAKE_AS_SERVER_CONF
      appServer = new MatrixApplicationServer()
      expect(appServer.conf).toStrictEqual(defaultConfig)
    })

    it('should return config from etc folder', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true)
      const spyOnConfigParser = jest
        .spyOn(jest.requireActual('@twake/config-parser'), 'default')
        .mockImplementation(() => defaultConfig)
      appServer = new MatrixApplicationServer()
      expect(spyOnConfigParser).toHaveBeenCalledTimes(1)
      expect(spyOnConfigParser).toHaveBeenCalledWith(
        defaultConfig,
        '/etc/twake/as-server.conf'
      )
    })

    it('should return config from parameter', async () => {
      const config: Config = {
        base_url: 'http://localhost:8080',
        sender_localpart: 'matrix',
        registration_file_path: 'registration.yaml',
        namespaces: { users: [] }
      }
      appServer = new MatrixApplicationServer(config)
      expect(appServer.conf).toStrictEqual(config)
    })
  })

  describe('Integration tests', () => {
    let app: express.Application

    beforeAll(() => {
      app = express()
      appServer = new MatrixApplicationServer(testConfig)
      app.use(appServer.router.routes)
    })

    it('reject unimplemented endpoint with 404', async () => {
      const response = await request(app).get('/unkown')
      expect(response.statusCode).toBe(404)
    })

    it('old endpoint should send a response with 308 status, body with error message and "Location" header with correct url', async () => {
      const testEndpoint = '/users/test'
      const response = await request(app).get(testEndpoint)
      expect(response.statusCode).toBe(308)
      expect(response.body).toStrictEqual({
        errcode: 'M_UNKNOWN',
        error: 'This non-standard endpoint has been removed'
      })
      expect(response.get('Location')).toEqual(endpointPrefix + testEndpoint)
    })

    it('error on request without authorization header', async () => {
      const response = await request(app).put(transactionEndpoint)
      expect(response.statusCode).toBe(401)
      expect(response.body).toStrictEqual({
        errcode: 'M_UNAUTHORIZED',
        error: 'Unauthorized'
      })
    })

    it('error on request with invalid token', async () => {
      const response = await request(app)
        .put(transactionEndpoint)
        .set('Authorization', 'Bearer falsy_hs_token')
      expect(response.statusCode).toBe(403)
      expect(response.body).toStrictEqual({
        errcode: 'M_FORBIDDEN',
        error: 'Forbidden'
      })
    })

    describe('Transactions endpoint', () => {
      const correctBodyEventsValue = [
        {
          state_key: 'test',
          type: 'm.room.member'
        },
        {
          type: 'm.room.message'
        }
      ]

      beforeAll(() => {
        appServer.lastProcessedTxnId = '0'
      })

      it('reject not allowed method with 405', async () => {
        const response = await request(app).get(transactionEndpoint)
        expect(response.statusCode).toBe(405)
        expect(response.body).toStrictEqual({
          errcode: 'M_UNRECOGNIZED',
          error: 'Unrecognized'
        })
      })

      it('should send a response with 200 and update lastProcessedTxnId property', async () => {
        expect(appServer.lastProcessedTxnId).toEqual('0')
        const response = await request(app)
          .put(transactionEndpoint)
          .set('Authorization', `Bearer ${homeserverToken}`)
          .send({
            events: correctBodyEventsValue
          })
        expect(response.statusCode).toBe(200)
        expect(response.body).toEqual({})
        expect(appServer.lastProcessedTxnId).toEqual('1')
      })

      it('should send a response with 200 if transaction id already has been processed', async () => {
        expect(appServer.lastProcessedTxnId).toEqual('1')
        const response = await request(app)
          .put(transactionEndpoint)
          .set('Authorization', `Bearer ${homeserverToken}`)
          .send({
            events: correctBodyEventsValue
          })
        expect(response.statusCode).toBe(200)
        expect(response.body).toEqual({})
        expect(appServer.lastProcessedTxnId).toEqual('1')
      })

      it('should send an error with status 400 if body events property is not an array', async () => {
        const response = await request(app)
          .put(transactionEndpoint)
          .set('Authorization', `Bearer ${homeserverToken}`)
          .send({
            events: null
          })
        expect(response.statusCode).toBe(400)
        expect(response.body).toEqual({
          error: 'Error field: Invalid value (property: events)'
        })
      })
    })

    describe('Users endpoint', () => {
      const userEndpoint = endpointPrefix + '/users/1'

      it('reject not allowed method with 405', async () => {
        const response = await request(app).put(userEndpoint)
        expect(response.statusCode).toBe(405)
        expect(response.body).toStrictEqual({
          errcode: 'M_UNRECOGNIZED',
          error: 'Unrecognized'
        })
      })

      it('should send a response with 200', async () => {
        const response = await request(app)
          .get(userEndpoint)
          .set('Authorization', `Bearer ${homeserverToken}`)
          .send()
        expect(response.statusCode).toBe(200)
        expect(response.body).toEqual({})
      })
    })

    describe('Rooms endpoint', () => {
      const roomEndpoint = endpointPrefix + '/rooms/1'

      it('reject not allowed method with 405', async () => {
        const response = await request(app).put(roomEndpoint)
        expect(response.statusCode).toBe(405)
        expect(response.body).toStrictEqual({
          errcode: 'M_UNRECOGNIZED',
          error: 'Unrecognized'
        })
      })

      it('should send a response with 200', async () => {
        const response = await request(app)
          .get(roomEndpoint)
          .set('Authorization', `Bearer ${homeserverToken}`)
          .send()
        expect(response.statusCode).toBe(200)
        expect(response.body).toEqual({})
      })
    })
  })
})
