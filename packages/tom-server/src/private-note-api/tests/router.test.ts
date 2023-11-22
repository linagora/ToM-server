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

const app = express()

const middlewareSpy = jest.fn().mockImplementation((_req, _res, next) => {
  next()
})

jest.mock('../../private-note-api/middlewares/validation.middleware.ts', () => {
  return function () {
    return {
      checkGetRequirements: middlewareSpy,
      checkCreationRequirements: jest.fn(),
      checkUpdateRequirements: jest.fn(),
      checkDeleteRequirements: jest.fn()
    }
  }
})

jest.mock('../../private-note-api/controllers/index.ts', () => {
  const passiveControllerMock = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    res.status(200).json({ message: 'test' })
  }

  return function () {
    return {
      get: passiveControllerMock,
      create: passiveControllerMock,
      update: passiveControllerMock,
      deleteNote: passiveControllerMock
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
    {} as Config,
    mockLogger as TwakeLogger
  )
)
app.use(errorMiddleware(mockLogger as TwakeLogger))

describe('Private Note API Router', () => {
  it('should not call the validation middleware if Bearer token is not set', async () => {
    const response = await supertest(app).get(PATH)

    expect(middlewareSpy).not.toHaveBeenCalled()
    expect(response.status).toBe(401)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Access tried without token',
      expect.anything()
    )
  })

  it('should call the validation middleware if Bearer token is set in the Authorization Headers', async () => {
    await supertest(app).get(PATH).set('Authorization', 'Bearer test')

    expect(middlewareSpy).toHaveBeenCalled()
  })
  it('should call the validation middleware if access token is set in the request query', async () => {
    await supertest(app).get(PATH).query({ access_token: 'test' })

    expect(middlewareSpy).toHaveBeenCalled()
  })
})
