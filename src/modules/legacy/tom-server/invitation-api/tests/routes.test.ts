import { afterAll, beforeAll, beforeEach, describe, expect, it, mock, spyOn, test } from 'bun:test'
import express, { type Response, type NextFunction } from 'express'
import bodyParser from 'body-parser'
import type { AuthRequest, Config } from '../../types'
import IdServer from '../../identity-server'
import type { ConfigDescription } from '../../../../config-parser'
import type { TwakeLogger } from '../../../logger'
import { IdentityServerDb, type MatrixDB } from '../../../matrix-identity-server'
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

spyOn(IdentityServerDb.prototype, 'get').mockResolvedValue([{ data: '"test"' }])

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
    twake_chat: {
      enable_invitations: true
    },
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
        checkInvitationPayload: middlewareSpy,
        checkInvitation: middlewareSpy,
        rateLimitInvitations: middlewareSpy,
        checkInvitationOwnership: middlewareSpy,
        checkGenerateInvitationLinkPayload: middlewareSpy,
        checkFeatureEnabled: mock().mockImplementation((_req, _res, next) => {
          next()
        })
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
        sendInvitation: passiveController,
        acceptInvitation: passiveController,
        listInvitations: passiveController,
        generateInvitationLink: passiveController,
        getInvitationStatus: passiveController,
        removeInvitation: passiveController
      }
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
            idServer.userDB,
            idServer.matrixDb,
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
  })

  beforeEach(() => {
    middlewareSpy.mockClear()
  })

  it('should reject if rate limit is exceeded', { timeout: 30000 }, async () => {
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
