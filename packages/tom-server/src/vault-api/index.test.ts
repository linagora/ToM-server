import express from 'express'
import request from 'supertest'
import fs from 'fs'
import TwakeVaultAPI from './index'
import buildTokenTable from './__testData__/buildTokenTable'
import defaultConfig from './config.json'
import fetch from 'node-fetch'
import { recoveryWords } from './db/utils'
import { type VaultDBSQLite } from './db/sql/sqlite'
import { type Config } from '../utils'

const endpoint = '/_twake/recoveryWords'
const testFilePath = './server.db'
const words = 'This is a test sentence'
const accessToken =
  'accessTokenddddddddddddddddddddddddddddddddddddddddddddddddddddd'

const unsavedToken = accessToken.replace('accessToken', 'unsavedToken')

const matrixServerResponseBody = {
  user_id: 'test',
  is_guest: 'test',
  device_id: 'test'
}

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
    const config: Partial<Config> = {
      database_engine: 'sqlite',
      database_host: dbFilePath,
      server_name: 'test',
      matrix_server: 'localhost'
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
    process.env.TWAKE_VAULT_SERVER_CONF =
      './src/vault-api/__testData__/config.json'

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
    ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
      json: jest.fn().mockResolvedValue(matrixServerResponseBody)
    })
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
    const response = await request(app).put(endpoint)
    expect(response.statusCode).toBe(405)
    expect(response.body).toStrictEqual({
      error: 'Method not allowed'
    })
  })

  test('error on get words in database for connected who did not save words before', async () => {
    const response = await request(app)
      .get(endpoint)
      .set('Authorization', `Bearer ${accessToken}`)
    expect(response.statusCode).toBe(404)
    expect(response.body).toStrictEqual({
      error: 'User has no recovery sentence'
    })
  })

  test('insert words in dabase for the connected user', async () => {
    const response = await request(app)
      .post(endpoint)
      .send({ words })
      .set('Authorization', `Bearer ${accessToken}`)
    expect(response.statusCode).toBe(201)
    expect(response.body).toStrictEqual({
      message: 'Saved recovery words sucessfully'
    })
  })

  test('get words in dabase for the connected user', async () => {
    const response = await request(app)
      .get(endpoint)
      .set('Authorization', `Bearer ${accessToken}`)
    expect(response.statusCode).toBe(200)
    expect(response.body).toStrictEqual({
      words
    })
  })

  test('get words in database user authenticated whose access_token is not stored without recovery sentence', async () => {
    const response = await request(app)
      .get(endpoint)
      .set('Authorization', `Bearer ${unsavedToken}`)
    expect(response.statusCode).toBe(404)
    expect(response.body).toStrictEqual({
      error: 'User has no recovery sentence'
    })
    await removeUserInAccessTokenTable(unsavedToken)
  })

  test('get words in database user authenticated whose access_token is not stored with recovery sentence', async () => {
    const recoverySentence = 'This is another recovery sentence'
    await new Promise<void>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      ;(vaultApiServer.vaultDb.db as VaultDBSQLite).db.run(
        `INSERT INTO ${recoveryWords.title} VALUES('${matrixServerResponseBody.user_id}', '${recoverySentence}')`,
        () => {
          resolve()
        }
      )
    })
    let response = await request(app)
      .get(endpoint)
      .set('Authorization', `Bearer ${unsavedToken}`)
    expect(response.statusCode).toBe(200)
    expect(response.body).toStrictEqual({
      words: recoverySentence
    })
    await removeUserInAccessTokenTable(unsavedToken)
    await removeUserInRecoveryWordsTable(matrixServerResponseBody.user_id)
    response = await request(app)
      .get(endpoint)
      .set('Authorization', `Bearer ${unsavedToken}`)
    expect(response.statusCode).toBe(404)
  })

  test('post words in database for authenticated user whose access_token is not stored', async () => {
    const response = await request(app)
      .post(endpoint)
      .send({ words })
      .set('Authorization', `Bearer ${unsavedToken}`)
    expect(response.statusCode).toBe(201)
    expect(response.body).toStrictEqual({
      message: 'Saved recovery words sucessfully'
    })
    await removeUserInAccessTokenTable(unsavedToken)
    await removeUserInRecoveryWordsTable(matrixServerResponseBody.user_id)
  })

  const removeUserInAccessTokenTable = async (
    accessToken: string
  ): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/return-await
    return new Promise<void>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      ;(vaultApiServer.vaultDb.db as VaultDBSQLite).db.run(
        `DELETE FROM accessTokens WHERE id = '${accessToken}'`,
        () => {
          resolve()
        }
      )
    })
  }

  const removeUserInRecoveryWordsTable = async (
    userId: string
  ): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/return-await
    return new Promise<void>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      ;(vaultApiServer.vaultDb.db as VaultDBSQLite).db.run(
        `DELETE FROM ${recoveryWords.title} WHERE userId = '${userId}'`,
        () => {
          resolve()
        }
      )
    })
  }
})
