import { beforeEach, describe, expect, it, mock, test } from 'bun:test'
import express, { type Response } from 'express'
import supertest from 'supertest'
import type { Config } from '../../types'
import type TwakeIdentityServer from '../../identity-server'
import router, { PATH } from '../routes'
import { type TwakeLogger } from '../../../logger'

const app = express()
const getAccessTokenMock = mock()
const getImageMock = mock()
const loggerMock = {
  info: mock(),
  error: mock(),
  warn: mock()
}

mock.module('../services', () => {
  return {
    default: function () {
      return {
        getImage: getImageMock
      }
    }
  }
})

mock.module('../../utils/services/token-service.ts', () => {
  return {
    default: function () {
      return {
        getAccessTokenWithCookie: getAccessTokenMock
      }
    }
  }
})

const idServerMock = {
  db: {},
  userDb: {},
  authenticate: mock()
    .mockImplementation((_req: Request, _res: Response, callbackMethod) => {
      callbackMethod('test', 'test')
    })
}

app.use(
  router(
    idServerMock as unknown as TwakeIdentityServer,
    {
      qr_code_url: 'https://example.com/'
    } as unknown as Config,
    loggerMock as unknown as TwakeLogger
  )
)

beforeEach(() => {
  mock.restore()
})

describe('the QRCode API controller', () => {
  it('should return a QRCode', async () => {
    getAccessTokenMock.mockResolvedValue('test')
    getImageMock.mockResolvedValue('test')

    const response = await supertest(app).get(PATH).set('cookie', 'lemon=test')

    expect(response.status).toBe(200)
    expect(response.body).toEqual(Buffer.from('test'))
  })

  it('should return 400 if auth cookies were missing', async () => {
    const response = await supertest(app).get(PATH)

    expect(response.status).toBe(400)
  })

  it('should return 500 if something wrong happens while generating the SVG', async () => {
    getAccessTokenMock.mockResolvedValue('test')
    getImageMock.mockRejectedValue(new Error('test'))

    const result = await supertest(app).get(PATH).set('cookie', 'lemon=test')

    expect(result.status).toBe(500)
  })

  it('should return 500 if something wrong happens while fetching the access token', async () => {
    getAccessTokenMock.mockRejectedValue(new Error('test'))

    const result = await supertest(app).get(PATH).set('cookie', 'lemon=test')

    expect(result.status).toBe(500)
  })

  it('should return 400 if the access token is invalid', async () => {
    getAccessTokenMock.mockResolvedValue(null)

    const result = await supertest(app).get(PATH).set('cookie', 'lemon=test')

    expect(result.status).toBe(400)
  })
})
