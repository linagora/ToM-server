/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { type ConfigDescription } from '@twake/config-parser'
import { type TwakeLogger } from '@twake/logger'
import { IdentityServerDb, type MatrixDB } from '@twake/matrix-identity-server'
import bodyParser from 'body-parser'
import express, {
  type Response as ExpressResponse,
  type NextFunction
} from 'express'
import fs from 'fs'
import path from 'path'
import supertest, { type Response } from 'supertest'
import JEST_PROCESS_ROOT_PATH from '../../../jest.globals'
import IdServer from '../../identity-server'
import type { AuthRequest, Config } from '../../types'
import errorMiddleware from '../../utils/middlewares/error.middleware'
import router, { PATH } from '../routes'

const mockLogger: Partial<TwakeLogger> = {
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  close: jest.fn()
}

const app = express()

const middlewareSpy = jest.fn().mockImplementation((_req, _res, next) => {
  next()
})

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
    sms_api_key: 'test',
    sms_api_login: 'test',
    sms_api_url: 'http://url/',
    template_dir: './templates',
    userdb_host: './tokens.db',
    features: {
      common_settings: { enabled: false },
      user_profile: {
        default_visibility_settings: {
          visibility: 'private',
          visible_fields: []
        }
      },
      user_directory: { enabled: true }
    }
  } as unknown as ConfigDescription,
  mockLogger as TwakeLogger
)

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
    res: ExpressResponse,
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

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

describe('SMS API Router', () => {
  beforeAll((done) => {
    idServer.ready
      .then(() => {
        app.use(router(idServer.conf, idServer.authenticate, idServer.logger))
        app.use(errorMiddleware(idServer.logger))
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
      response = await supertest(app).post(PATH).set('Authorization', token)
    }
    expect((response as Response).statusCode).toEqual(429)
    await new Promise((resolve) => setTimeout(resolve, 11000))
  })

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
