import express, { type Response, type NextFunction } from 'express'
import bodyParser from 'body-parser'
import type { AuthRequest, Config } from '../../types'
import IdServer from '../../identity-server'
import type { ConfigDescription } from '@twake/config-parser'
import type { TwakeLogger } from '@twake/logger'
import { IdentityServerDb, type MatrixDB } from '@twake/matrix-identity-server'
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
    rate_limiting_window: 5000,
    rate_limiting_nb_requests: 10,
    template_dir: './templates',
    userdb_host: './tokens.db',
    twake_chat: {
      enable_invitations: true
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
      checkInvitationPayload: middlewareSpy,
      checkInvitation: middlewareSpy,
      rateLimitInvitations: middlewareSpy,
      checkInvitationOwnership: middlewareSpy,
      checkGenerateInvitationLinkPayload: middlewareSpy,
      checkFeatureEnabled: jest.fn().mockImplementation((_req, _res, next) => {
        next()
      })
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
      sendInvitation: passiveController,
      acceptInvitation: passiveController,
      listInvitations: passiveController,
      generateInvitationLink: passiveController,
      getInvitationStatus: passiveController,
      removeInvitation: passiveController
    }
  }
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

describe('the Invitation API router', () => {
  beforeAll((done) => {
    idServer.ready
      .then(() => {
        app.use(
          router(
            idServer.conf,
            idServer.db,
            idServer.authenticate,
            idServer.logger
          )
        )

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

  it('should reject if rate limit is exceeded', async () => {
    let response

    for (let i = 0; i < 11; i++) {
      response = await supertest(app)
        .get(`${PATH}/list`)
        .set('Authorization', 'Bearer test')
    }

    expect((response as unknown as Response).status).toEqual(429)
    await new Promise((resolve) => setTimeout(resolve, 6000))
  })

  it('should not call the validation middleware if the Bearer token is not set', async () => {
    const response = await supertest(app).post(PATH).send({})

    expect(response.status).toEqual(401)
    expect(middlewareSpy).not.toHaveBeenCalled()
  })
  it('should call the validation middleware if the Bearer token is set', async () => {
    await supertest(app).post(PATH).set('Authorization', 'Bearer test')

    expect(middlewareSpy).toHaveBeenCalled()
  })

  it('should call the validation middleware if the access_token is set in the query', async () => {
    await supertest(app).post(PATH).query({ access_token: 'test' })

    expect(middlewareSpy).toHaveBeenCalled()
  })
})
