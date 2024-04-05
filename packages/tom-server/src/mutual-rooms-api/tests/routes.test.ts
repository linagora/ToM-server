import { type ConfigDescription } from '@twake/config-parser'
import { type TwakeLogger } from '@twake/logger'
import { IdentityServerDb, type MatrixDB } from '@twake/matrix-identity-server'
import bodyParser from 'body-parser'
import express from 'express'
import fs from 'fs'
import path from 'path'
import supertest, { type Response } from 'supertest'
import JEST_PROCESS_ROOT_PATH from '../../../jest.globals'
import IdServer from '../../identity-server'
import type { Config } from '../../types'
import router, { PATH } from '../routes'

const mockLogger: Partial<TwakeLogger> = {
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  close: jest.fn()
}

const controllerSpy = jest.fn().mockImplementation((_req, _res, next) => {
  next()
})

jest.mock('../../mutual-rooms-api/controllers/index.ts', () => {
  return function () {
    return {
      get: controllerSpy
    }
  }
})

const matrixDbMock = {
  get: jest.fn()
}

jest
  .spyOn(IdentityServerDb.default.prototype, 'get')
  .mockResolvedValue([{ data: '"test"' }])

const idServer = new IdServer(
  matrixDbMock as unknown as MatrixDB,
  {} as unknown as Config,
  {
    database_engine: 'sqlite',
    database_host: 'test.db',
    rate_limiting_window: 10000,
    rate_limiting_nb_requests: 100,
    template_dir: './templates',
    userdb_host: './tokens.db'
  } as unknown as ConfigDescription,
  mockLogger as TwakeLogger
)

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

beforeAll((done) => {
  idServer.ready
    .then(() => {
      app.use(
        router(
          idServer.conf,
          idServer.matrixDb,
          idServer.authenticate,
          idServer.logger
        )
      )
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

describe('the mutual rooms API router', () => {
  it('should reject if more than 100 requests are done in less than 10 seconds with falsy token', async () => {
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

  it('should not call the controller method if the Bearer token is not set', async () => {
    const response = await supertest(app).get(`${PATH}/test`)

    expect(response.status).toBe(401)
    expect(controllerSpy).not.toHaveBeenCalled()
  })

  it('should call the controller method if the Bearer token is set in the Authorization Headers', async () => {
    await supertest(app).get(`${PATH}/test`).set('Authorization', 'Bearer test')

    expect(controllerSpy).toHaveBeenCalled()
  })
  it('should call controller method if the access token is set in the request query', async () => {
    await supertest(app).get(`${PATH}/test`).query({ access_token: 'test' })

    expect(controllerSpy).toHaveBeenCalled()
  })
})
