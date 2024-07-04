import { type ConfigDescription } from '@twake/config-parser'
import { IdentityServerDb, type MatrixDB } from '@twake/matrix-identity-server'
import express from 'express'
import fs from 'fs'
import path from 'path'
import supertest, { type Response } from 'supertest'
import JEST_PROCESS_ROOT_PATH from '../../../jest.globals'
import IdServer from '../../identity-server'
import type { Config } from '../../types'
import router, { PATH } from '../routes'

const app = express()

jest
  .spyOn(IdentityServerDb.prototype, 'get')
  .mockResolvedValue([{ data: '"test"' }])

const idServer = new IdServer(
  {
    get: jest.fn()
  } as unknown as MatrixDB,
  {} as unknown as Config,
  {
    database_engine: 'sqlite',
    database_host: 'test.db',
    rate_limiting_window: 10000,
    rate_limiting_nb_requests: 100,
    template_dir: './templates',
    userdb_host: './tokens.db'
  } as unknown as ConfigDescription
)

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

const middlewareSpy = jest.fn().mockImplementation((_req, _res, next) => {
  next()
})

const controllerGetSpy = jest.fn().mockImplementation((_req, res, _next) => {
  res.status(200).send('OK')
})

jest.mock('../middlewares/require-ldap.ts', () => {
  return () => middlewareSpy
})

jest.mock('../controllers/index.ts', () => {
  return function () {
    return {
      get: controllerGetSpy
    }
  }
})

describe('the user info API Router', () => {
  beforeAll((done) => {
    idServer.ready
      .then(() => {
        app.use(router(idServer, {} as unknown as Config))
        done()
      })
      .catch((e) => {
        done(e)
      })
  })

  afterAll(() => {
    idServer.cleanJobs()
    const pathFilesToDelete = [
      path.join(JEST_PROCESS_ROOT_PATH, 'test.db'),
      path.join(JEST_PROCESS_ROOT_PATH, 'tokens.db')
    ]
    pathFilesToDelete.forEach((path) => {
      if (fs.existsSync(path)) fs.unlinkSync(path)
    })
  })

  it('should reject if more than 100 requests are done in less than 10 seconds', async () => {
    let response
    let token
    // eslint-disable-next-line @typescript-eslint/no-for-in-array, @typescript-eslint/no-unused-vars
    for (const i in [...Array(101).keys()]) {
      token = Number(i) % 2 === 0 ? `Bearer test` : 'falsy_token'
      response = await supertest(app)
        .get(`${PATH}/test`)
        .set('Authorization', token)
    }
    expect((response as Response).statusCode).toEqual(429)
    await new Promise((resolve) => setTimeout(resolve, 11000))
  })

  it('should call the ldap check middleware', async () => {
    await supertest(app).get(`${PATH}/test`)

    expect(middlewareSpy).toHaveBeenCalled()
  })

  it('should call the controller if the user is authenticated via Bearer', async () => {
    await supertest(app).get(`${PATH}/test`).set('Authorization', 'Bearer test')

    expect(controllerGetSpy).toHaveBeenCalled()
  })

  it('should call the controller if the user is authenticated via access_token', async () => {
    await supertest(app).get(`${PATH}/test`).query({ access_token: 'test' })

    expect(controllerGetSpy).toHaveBeenCalled()
  })

  it('should not call the controller if no bearer or access_token is provided', async () => {
    await supertest(app).get(`${PATH}/test`)

    expect(controllerGetSpy).not.toHaveBeenCalled()
  })
})
