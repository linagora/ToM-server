import express, { type Response, type NextFunction } from 'express'
import bodyParser from 'body-parser'
import type { AuthRequest, Config } from '../../types.ts'
import IdServer from '../../identity-server/index.ts'
import type { ConfigDescription } from '@twake-chat/config-parser'
import type { TwakeLogger } from '@twake-chat/logger'
import { type MatrixDB } from '@twake-chat/matrix-identity-server'
import router, { PATH } from '../routes/index.ts'
import errorMiddleware from '../../utils/middlewares/error.middleware.ts'
import JEST_PROCESS_ROOT_PATH from '../../../jest.globals'
import fs from 'fs'
import path from 'path'
import supertest from 'supertest'

const mockLogger: Partial<TwakeLogger> = {
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  close: jest.fn()
}

// Use in-memory databases to avoid conflicts between parallel test workers
const idServer = new IdServer(
  {
    get: jest.fn()
  } as unknown as MatrixDB,
  {} as unknown as Config,
  {
    database_engine: 'sqlite',
    database_host: ':memory:',
    rate_limiting_window: 5000,
    rate_limiting_nb_requests: 10,
    template_dir: './templates',
    userdb_host: ':memory:',
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

const app = express()
const middlewareSpy = jest.fn().mockImplementation((_req, _res, next) => {
  next()
})

jest.mock('../middlewares', () => {
  return function () {
    return {
      checkUserExists: middlewareSpy,
      checkAccessToken: middlewareSpy
    }
  }
})

jest.mock('../controllers', () => {
  const passiveController = (
    _req: AuthRequest,
    res: Response,
    _next: NextFunction
  ): void => {
    res.status(200).json({ message: 'test' })
  }

  return function () {
    return {
      handle: passiveController
    }
  }
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

describe('the Deactivate account API router', () => {
  beforeAll((done) => {
    idServer.ready
      .then(() => {
        app.use(router(idServer.conf, idServer.matrixDb.db, idServer.logger))

        app.use(errorMiddleware(idServer.logger))
        done()
      })
      .catch((err) => {
        done(err)
      })
  })

  afterAll(() => {
    idServer.cleanJobs()
  })

  it('should call the validation middleware', async () => {
    await supertest(app).post(`${PATH}/testuser`)

    expect(middlewareSpy).toHaveBeenCalled()
  })

  it('should call the controller handler', async () => {
    const response = await supertest(app)
      .post(`${PATH}/testuser`)
      .set('Authorization', 'Bearer test')

    expect(response.status).toEqual(200)
    expect(response.body).toEqual({ message: 'test' })
  })
})
