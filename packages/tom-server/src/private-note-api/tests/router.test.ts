/* eslint-disable @typescript-eslint/consistent-type-assertions */
import express, { type NextFunction, type Response } from 'express'
import router, { PATH } from '../routes'
import supertest from 'supertest'
import bodyParser from 'body-parser'
import type { Config, IdentityServerDb } from '../../utils'
import type { AuthRequest } from '../types'
import { checkGetRequirements } from '../../private-note-api/middlewares/validation.middleware'
import errorMiddleware from '../middlewares/error.middleware'

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

const app = express()

jest.mock('../../private-note-api/middlewares/validation.middleware.ts', () => {
  const passiveMiddlewareMock = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    next()
  }

  return {
    checkGetRequirements: jest.fn(passiveMiddlewareMock),
    checkCreationRequirements: passiveMiddlewareMock,
    checkUpdateRequirements: passiveMiddlewareMock,
    checkDeleteRequirements: passiveMiddlewareMock
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

  return {
    get: passiveControllerMock,
    create: passiveControllerMock,
    update: passiveControllerMock,
    deleteNote: passiveControllerMock
  }
})

const dbMock = {
  get: async () => [{ data: '"test"' }]
}

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(router(dbMock as unknown as IdentityServerDb, {} as Config))
app.use(errorMiddleware)

describe('Private Note API Router', () => {
  it('should not call the validation middleware if Bearer token is not set', async () => {
    const response = await supertest(app).get(PATH)

    expect(checkGetRequirements).not.toHaveBeenCalled()
    expect(response.status).toBe(401)
    expect(console.warn).toHaveBeenCalledWith(
      'Access tried without token',
      expect.anything()
    )
  })

  it('should call the validation middleware if Bearer token is set in the Authorization Headers', async () => {
    await supertest(app).get(PATH).set('Authorization', 'Bearer test')

    expect(checkGetRequirements).toHaveBeenCalled()
  })
  it('should call the validation middleware if access token is set in the request query', async () => {
    await supertest(app).get(PATH).query({ access_token: 'test' })

    expect(checkGetRequirements).toHaveBeenCalled()
  })
})
