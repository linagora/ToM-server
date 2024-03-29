import { type TwakeLogger } from '@twake/logger'
import { type MatrixDBBackend } from '@twake/matrix-identity-server'
import bodyParser from 'body-parser'
import express from 'express'
import supertest from 'supertest'
import type { Config, IdentityServerDb } from '../../types'
import router, { PATH } from '../routes'

const mockLogger: Partial<TwakeLogger> = {
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
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

const dbMock = {
  get: async () => [{ data: '"test"' }],
  logger: mockLogger as TwakeLogger
}

const matrixDbMock = {
  get: jest.fn()
}

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(
  router(
    dbMock as unknown as IdentityServerDb,
    {} as unknown as Config,
    matrixDbMock as unknown as MatrixDBBackend,
    mockLogger as TwakeLogger
  )
)

describe('the mutual rooms API router', () => {
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
