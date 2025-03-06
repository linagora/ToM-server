import express, { type Response, type NextFunction } from 'express'
import bodyParser from 'body-parser'
import type { AuthRequest, Config } from '../../types'
import IdServer from '../../identity-server'
import type { ConfigDescription } from '@twake/config-parser'
import type { TwakeLogger } from '@twake/logger'
import { type MatrixDB } from '@twake/matrix-identity-server'
import router, { PATH } from '../routes'
import errorMiddleware from '../../utils/middlewares/error.middleware'
import JEST_PROCESS_ROOT_PATH from '../../../jest.globals'
import fs from 'fs'
import path from 'path'
import supertest from 'supertest'

const mockLogger: Partial<TwakeLogger> = {
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  close: jest.fn()
}

const idServer = new IdServer(
  {
    get: jest.fn()
  } as unknown as MatrixDB,
  {} as unknown as Config,
  {
    database_engine: 'sqlite',
    database_host: 'test.db',
    rate_limiting_window: 5000,
    rate_limiting_nb_requests: 10,
    template_dir: './templates',
    userdb_host: './tokens.db'
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

    const pathFilesToDelete = [
      path.join(JEST_PROCESS_ROOT_PATH, 'test.db'),
      path.join(JEST_PROCESS_ROOT_PATH, 'tokens.db')
    ]

    pathFilesToDelete.forEach((path) => {
      if (fs.existsSync(path)) fs.unlinkSync(path)
    })
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
