/* eslint-disable n/no-callback-literal */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
import express, { type NextFunction } from 'express'
import router, { PATH } from '../routes'
import supertest from 'supertest'
import bodyParser from 'body-parser'
import type { Config, IdentityServerDb, AuthRequest } from '../../types'
import fetch, { type Response } from 'node-fetch'

const app = express()

const dbMock = {
  get: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  deleteEqual: jest.fn(),
  getCount: jest.fn()
}

const smsConfig = {
  sms_api_key: 'test',
  sms_api_login: 'test',
  sms_api_url: 'http://url/'
}

jest.mock('node-fetch')

const mockFetch = fetch as jest.MockedFunction<typeof fetch>

jest.mock('../../identity-server/utils/authenticate', () => {
  return (db: IdentityServerDb, conf: Config) =>
    (
      req: AuthRequest,
      res: Response,
      cb: (data: any, token: string) => void
    ) => {
      cb('test', 'test')
    }
})

jest.mock('../middlewares/index', () => {
  const passiveMiddlewareMock = (
    _req: AuthRequest,
    _res: Response,
    next: NextFunction
  ): void => {
    next()
  }

  return function () {
    return {
      checkSendRequirements: passiveMiddlewareMock,
      validateMobilePhone: passiveMiddlewareMock
    }
  }
})

beforeEach(() => {
  mockFetch.mockResolvedValue(Promise.resolve({ status: 200 } as Response))
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(router(dbMock as unknown as IdentityServerDb, smsConfig as Config))

describe('the SMS API controller', () => {
  it('should attempt to send sms using the service', async () => {
    const response = await supertest(app).post(PATH).send({
      to: '0000000000000',
      text: 'test'
    })

    expect(mockFetch).toHaveBeenCalledWith('http://url/', expect.anything())

    expect(response.status).toEqual(200)
  })

  it('should fail if missing data', async () => {
    const response = await supertest(app).post(PATH).send({
      to: '123456'
    })

    expect(response.status).toBe(500)
  })

  it('should work correctly with multiple phones', async () => {
    const response = await supertest(app)
      .post(PATH)
      .send({
        to: ['0000000000000', '0000000000001'],
        text: 'test'
      })

    expect(mockFetch).toHaveBeenCalledWith('http://url/', {
      method: 'POST',
      body: JSON.stringify({
        recipients: [
          { phone_number: '0000000000000' },
          { phone_number: '0000000000001' }
        ],
        sender: 'Twake',
        text: 'test',
        type: 'sms_low_cost'
      }),
      headers: {
        'Content-Type': 'application/json',
        'cache-control': 'no-cache',
        'api-key': 'test',
        'api-login': 'test'
      }
    })

    expect(response.status).toEqual(200)
  })

  it('should return 500 is something wrong happens', async () => {
    mockFetch.mockResolvedValue(
      Promise.resolve({
        status: 400,
        statusText: 'Insufficient credits'
      } as Response)
    )

    const response = await supertest(app).post(PATH).send({
      to: '0000000000000',
      text: 'test'
    })

    expect(response.status).toBe(500)
  })
})
