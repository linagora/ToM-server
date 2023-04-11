import express from 'express'
import request from 'supertest'
import fs from 'fs'
import TwakeVaultAPI from './index'
import buildTokenTable from './__testData__/buildTokenTable'
import { type Config } from './utils'
import defaultConfig from './config.json'

const testFilePath = './server.db'
const words = 'This is a test sentence'
const accessToken =
  'accessTokenddddddddddddddddddddddddddddddddddddddddddddddddddddd'

describe('getConfigurationFile method', () => {
  let vaultApiServerConfigTest: TwakeVaultAPI

  it('should return default config', async () => {
    delete process.env.TWAKE_VAULT_SERVER_CONF
    vaultApiServerConfigTest = new TwakeVaultAPI()
    await vaultApiServerConfigTest.ready
    expect(vaultApiServerConfigTest.conf).toStrictEqual(defaultConfig)
    fs.unlinkSync('./tokens.db')
  })

  it('should return config from parameter', async () => {
    const dbFilePath = './customdb.db'
    const config: Config = {
      database_engine: 'sqlite',
      database_host: dbFilePath,
      server_name: 'test'
    }
    vaultApiServerConfigTest = new TwakeVaultAPI(config)
    await vaultApiServerConfigTest.ready
    expect(vaultApiServerConfigTest.conf).toStrictEqual(config)
    fs.unlinkSync(dbFilePath)
  })
})

describe('Vault API server', () => {
  let vaultApiServer: TwakeVaultAPI
  let app: express.Application

  beforeAll((done) => {
    process.env.TWAKE_VAULT_SERVER_CONF = './src/__testData__/config.json'

    vaultApiServer = new TwakeVaultAPI()
    app = express()

    vaultApiServer.ready
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then(() => {
        return buildTokenTable(vaultApiServer.vaultDb)
      })
      .then(() => {
        app.use(vaultApiServer.endpoints)
        done()
      })
      .catch((e) => {
        done(e)
      })
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath)
    }
  })

  test('reject unimplemented endpoint with 404', async () => {
    const response = await request(app).get('/unkown')
    expect(response.statusCode).toBe(404)
  })

  test('reject not allowed method with 405', async () => {
    const response = await request(app).put('/recoveryWords')
    expect(response.statusCode).toBe(405)
    expect(response.body).toStrictEqual({
      error: 'Method not allowed'
    })
  })

  test('error on get words in dabase for connected who did not save words before', async () => {
    const response = await request(app)
      .get('/recoveryWords')
      .set('Authorization', `Bearer ${accessToken}`)
    expect(response.statusCode).toBe(404)
    expect(response.body).toStrictEqual({
      error: 'User has no recovery sentence'
    })
  })

  test('insert words in dabase for the connected user', async () => {
    const response = await request(app)
      .post('/recoveryWords')
      .send({ words })
      .set('Authorization', `Bearer ${accessToken}`)
    expect(response.statusCode).toBe(201)
    expect(response.body).toStrictEqual({
      message: 'Saved recovery words sucessfully'
    })
  })

  test('get words in dabase for the connected user', async () => {
    const response = await request(app)
      .get('/recoveryWords')
      .set('Authorization', `Bearer ${accessToken}`)
    expect(response.statusCode).toBe(200)
    expect(response.body).toStrictEqual({
      words
    })
  })

  test('error on get words in dabase for unauthorized user', async () => {
    const response = await request(app)
      .get('/recoveryWords')
      .set(
        'Authorization',
        `Bearer ${accessToken.replace('accessToken', 'falsyT')}`
      )
    expect(response.statusCode).toBe(401)
    expect(response.body).toStrictEqual({ error: 'Not Authorized' })
  })

  test('error on post words in dabase for unauthorized user', async () => {
    const response = await request(app)
      .post('/recoveryWords')
      .send({ words })
      .set(
        'Authorization',
        `Bearer ${accessToken.replace('accessToken', 'falsyT')}`
      )
    expect(response.statusCode).toBe(401)
    expect(response.body).toStrictEqual({ error: 'Not Authorized' })
  })
})
