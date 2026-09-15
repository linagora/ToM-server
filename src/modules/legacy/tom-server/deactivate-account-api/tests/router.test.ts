import { afterAll, beforeAll, describe, expect, it, mock, test } from 'bun:test'
import express, { type Response, type NextFunction } from 'express'
import bodyParser from 'body-parser'
import type { AuthRequest, Config } from '../../types'
import IdServer from '../../identity-server'
import type { ConfigDescription } from '../../../../config-parser'
import type { TwakeLogger } from '../../../logger'
import { type MatrixDB } from '../../../../matrix-identity-server'
import router, { PATH } from '../routes'
import errorMiddleware from '../../utils/middlewares/error.middleware'
import JEST_PROCESS_ROOT_PATH from '../../../jest.globals'
import fs from 'fs'
import path from 'path'
import supertest from 'supertest'

const mockLogger: Partial<TwakeLogger> = {
  debug: mock(),
  error: mock(),
  warn: mock(),
  info: mock(),
  close: mock()
}

// Use in-memory databases to avoid conflicts between parallel test workers
const idServer = new IdServer(
  {
    get: mock()
  } as unknown as MatrixDB,
  {} as unknown as Config,
  {
    database_engine: 'sqlite',
    database_host: ':memory:',
    rate_limiting_window: 5000,
    rate_limiting_nb_requests: 10,
    template_dir: 'assets/templates',
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
const middlewareSpy = mock().mockImplementation((_req, _res, next) => {
  next()
})

mock.module('../middlewares', () => {
  return {
    default: function () {
      return {
        checkUserExists: middlewareSpy,
        checkAccessToken: middlewareSpy
      }
    }
  }
})

mock.module('../controllers', () => {
  const passiveController = (
    _req: AuthRequest,
    res: Response,
    _next: NextFunction
  ): void => {
    res.status(200).json({ message: 'test' })
  }

  return {
    default: function () {
      return {
        handle: passiveController
      }
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
