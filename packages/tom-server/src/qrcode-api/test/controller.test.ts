import express, { type Response } from 'express'
import supertest from 'supertest'
import type { Config } from '../../types'
import type TwakeIdentityServer from '../../identity-server'
import router, { PATH } from '../routes'
import { type TwakeLogger } from '@twake/logger'

const app = express()
const getMock = jest.fn()
const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}

jest.mock('../services/index.ts', () => {
  return function () {
    return { get: getMock }
  }
})

const idServerMock = {
  db: {},
  userDb: {},
  authenticate: jest
    .fn()
    .mockImplementation((_req: Request, _res: Response, callbackMethod) => {
      callbackMethod('test', 'test')
    })
}

app.use(
  router(
    idServerMock as unknown as TwakeIdentityServer,
    {} as unknown as Config,
    loggerMock as unknown as TwakeLogger
  )
)

beforeEach(() => {
  jest.restoreAllMocks()
})

describe('the QRCode API controller', () => {
  it('should return a QRCode', async () => {
    getMock.mockResolvedValue('test')

    const response = await supertest(app).get(PATH)

    expect(response.status).toBe(200)
    expect(response.body).toEqual(Buffer.from('test'))
  })

  it('should return 500 if something wrong happens', async () => {
    getMock.mockRejectedValue(new Error('test'))

    const result = await supertest(app).get(PATH)

    expect(result.status).toBe(500)
  })
})
