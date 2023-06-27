import express from 'express'
import request from 'supertest'
import fs from 'fs'
import buildTokenTable from './__testData__/buildTokenTable'
import defaultConfig from '../config.json'
import fetch from 'node-fetch'
import path from 'path'
import JEST_PROCESS_ROOT_PATH from '../../jest.globals'
import TwakeServer from '..'
import { type Config } from '../types'

const endpoint = '/_twake/recoveryWords'
const testFilePath = path.join(JEST_PROCESS_ROOT_PATH, 'vault.db')
const matrixTestFilePath = path.join(JEST_PROCESS_ROOT_PATH, 'matrix.db')

const words = 'This is a test sentence'
const accessToken =
  'accessTokenddddddddddddddddddddddddddddddddddddddddddddddddddddd'

// @ts-expect-error ignore this
delete defaultConfig.policies

const unsavedToken = accessToken.replace('accessToken', 'unsavedToken')
const unsavedToken2 = accessToken.replace('accessToken', 'unsavedT2ken')

const matrixServerResponseBody = {
  user_id: 'test',
  is_guest: 'test',
  device_id: 'test'
}

/*
describe('getConfigurationFile method', () => {
  let vaultApiServerConfigTest: TwakeVaultAPI

  it('should return default config', async () => {
    delete process.env.TWAKE_VAULT_SERVER_CONF
    vaultApiServerConfigTest = new TwakeVaultAPI()
    await vaultApiServerConfigTest.ready
    expect(vaultApiServerConfigTest.conf).toStrictEqual({defaultConfig})
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
*/

describe('Vault API server', () => {
  let vaultApiServer: TwakeServer
  let app: express.Application

  beforeAll((done) => {
    const conf = {
      ...defaultConfig,
      database_engine: 'sqlite',
      database_host: testFilePath,
      matrix_server: 'localhost',
      template_dir: './templates',
      userdb_engine: 'sqlite',
      userdb_host: testFilePath,
      matrix_database_engine: 'sqlite',
      matrix_database_host: matrixTestFilePath
    }
    buildTokenTable(conf as Config)
      .then(() => {
        app = express()
        vaultApiServer = new TwakeServer(conf as Config)
        vaultApiServer.ready
          .then(() => {
            app.use(vaultApiServer.endpoints)
            done()
          })
          .catch((e) => {
            console.error(e)
            done(e)
          })
      })
      .catch((e) => {
        console.error(e)
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
    if (fs.existsSync(matrixTestFilePath)) {
      fs.unlinkSync(matrixTestFilePath)
    }
    vaultApiServer.cleanJobs()
  })

  it('reject unimplemented endpoint with 404', async () => {
    const response = await request(app).get('/unkown')
    expect(response.statusCode).toBe(404)
  })

  it('reject not allowed method with 405', async () => {
    const response = await request(app).put(endpoint)
    expect(response.statusCode).toBe(405)
    expect(response.body).toStrictEqual({
      error: 'Method not allowed'
    })
  })

  it('error on get words in database for connected who did not save words before', async () => {
    const response = await request(app)
      .get(endpoint)
      .set('Authorization', `Bearer ${accessToken}`)
    expect(response.statusCode).toBe(404)
    expect(response.body).toStrictEqual({
      error: 'User has no recovery sentence'
    })
  })

  it('insert words in database for the connected user', async () => {
    const response = await request(app)
      .post(endpoint)
      .send({ words })
      .set('Authorization', `Bearer ${accessToken}`)
    expect(response.statusCode).toBe(201)
    expect(response.body).toStrictEqual({
      message: 'Saved recovery words sucessfully'
    })
  })

  it('get words in database for the connected user', async () => {
    const response = await request(app)
      .get(endpoint)
      .set('Authorization', `Bearer ${accessToken}`)
    expect(response.statusCode).toBe(200)
    expect(response.body).toStrictEqual({
      words
    })
  })

  it('get words in database user authenticated whose access_token is not stored without recovery sentence', async () => {
    const response = await request(app)
      .get(endpoint)
      .set('Authorization', `Bearer ${unsavedToken}`)
    expect(response.statusCode).toBe(404)
    expect(response.body).toStrictEqual({
      error: 'User has no recovery sentence'
    })
    await removeUserInAccessTokenTable(unsavedToken)
  })

  it('get words in database user authenticated whose access_token is not stored with recovery sentence', async () => {
    const recoverySentence = 'This is another recovery sentence'
    await new Promise<void>((resolve, reject) => {
      vaultApiServer.db
        // @ts-expect-error recoveryWords not in Collections
        ?.insert('recoveryWords', {
          userId: matrixServerResponseBody.user_id,
          words: recoverySentence
        })
        .then(() => {
          resolve()
        })
        .catch(reject)
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

  it('post words in database for authenticated user whose access_token is not stored', async () => {
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

  // Delete words from database for connected user whose recovery sentence is previously saved
  it('delete words in database for the connected user whose recovery sentence is previously saved', async () => {
    await request(app)
      .post(endpoint)
      .send({ words })
      .set('Authorization', `Bearer ${unsavedToken2}`)
    const response = await request(app)
      .delete(endpoint)
      .set('Authorization', `Bearer ${unsavedToken2}`)
    expect(response.statusCode).toBe(204)
  })

  // Delete words from database for connected user whose doesn't have a recovery sentence associated to his access_token
  // It returns 201 even if there weren't any words saved : depends on the behaviour we would like to have.
  it('delete words in database for the connected user whose recovery sentence is not saved saved', async () => {
    const response = await request(app)
      .delete(endpoint)
      .set('Authorization', `Bearer ${unsavedToken}`)
    expect(response.statusCode).toBe(404)
    expect(response.body).toStrictEqual({
      error: 'User has no recovery sentence'
    })
  })

  const removeUserInAccessTokenTable = async (
    accessToken: string
  ): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/return-await
    return new Promise<void>((resolve, reject) => {
      vaultApiServer.db
        // @ts-expect-error matrixTokens isn't member of Collections
        ?.deleteEqual('matrixTokens', 'id', accessToken)
        .then(() => {
          resolve()
        })
        .catch(reject)
    })
  }

  const removeUserInRecoveryWordsTable = async (
    userId: string
  ): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/return-await
    return new Promise<void>((resolve, reject) => {
      vaultApiServer.db
        // @ts-expect-error recoveryWords not in Collections
        ?.deleteEqual('recoveryWords', 'userId', userId)
        .then(() => {
          resolve()
        })
        .catch(reject)
    })
  }
})
