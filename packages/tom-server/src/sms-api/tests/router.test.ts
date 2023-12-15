/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { type TwakeLogger } from '@twake/logger'
import bodyParser from 'body-parser'
import express, { type NextFunction, type Response } from 'express'
import supertest from 'supertest'
import type { AuthRequest, Config, IdentityServerDb } from '../../types'
import errorMiddleware from '../../utils/middlewares/error.middleware'
import router, { PATH } from '../routes'

const mockLogger: Partial<TwakeLogger> = {
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}

const smsConfig = {
  sms_api_key: 'test',
  sms_api_login: 'test',
  sms_api_url: 'http://url/'
}

const app = express()

const middlewareSpy = jest.fn().mockImplementation((_req, _res, next) => {
  next()
})

jest.mock('../middlewares/index.ts', () => {
  return function () {
    return {
      checkSendRequirements: middlewareSpy,
      validateMobilePhone: middlewareSpy
    }
  }
})

jest.mock('../controllers/index.ts', () => {
  const passiveControllerMock = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    res.status(200).json({ message: 'ok' })
  }

  return function () {
    return {
      send: passiveControllerMock
    }
  }
})
const dbMock = {
  get: async () => [{ data: '"test"' }],
  logger: mockLogger as TwakeLogger
}

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(
  router(
    dbMock as unknown as IdentityServerDb,
    smsConfig as Config,
    mockLogger as TwakeLogger
  )
)
app.use(errorMiddleware(mockLogger as TwakeLogger))

describe('SMS API Router', () => {
  it('should not call the middleware if the Bearer token is not set', async () => {
    const response = await supertest(app).post(PATH)

    expect(middlewareSpy).not.toHaveBeenCalled()
    expect(response.status).toBe(401)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Access tried without token',
      expect.anything()
    )
  })

  it('should call the middleware if the Bearer token is set', async () => {
    await supertest(app).post(PATH).set('Authorization', 'Bearer test')

    expect(middlewareSpy).toHaveBeenCalled()
  })
})
