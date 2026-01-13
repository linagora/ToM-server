import express, { type NextFunction, type Response } from 'express'
import supertest from 'supertest'
import type TwakeIdentityServer from '../../identity-server'
import type { AuthRequest, Config } from '../../types'
import router, { PATH } from '../routes'
import type { UserInformation } from '../types'
import type { MatrixDB } from '@twake-chat/matrix-identity-server'
import UserInfoController from '../controllers'
import { ForbiddenError } from '../types'

const app = express()
app.use(express.json())

jest.mock('../middlewares/require-ldap.ts', () => {
  return () =>
    (_req: AuthRequest, _res: Response, next: NextFunction): void => {
      next()
    }
})

const getMock = jest.fn()
const updateVisibilityMock = jest.fn()

jest.mock('../services/index.ts', () => {
  return function () {
    return {
      get: getMock,
      updateVisibility: updateVisibilityMock
    }
  }
})

jest.mock('../../utils/middlewares/auth.middleware', () => {
  return jest.fn(() => {
    return (req: any, _res: any, next: any) => {
      // set userId for tests
      req.userId = '@dwho:docker.localhost'
      next()
    }
  })
})

const matrixDBMock: Partial<MatrixDB> = {
  get: jest
    .fn()
    .mockResolvedValue([{ displayname: '', avatar_url: 'avatar_url' }])
} as unknown as Partial<MatrixDB>

const idServerMock = {
  db: {},
  userDb: {},
  authenticate: jest.fn().mockImplementation((req, res, callbackMethod) => {
    callbackMethod('test', 'test')
  })
}

app.use(
  router(
    idServerMock as unknown as TwakeIdentityServer,
    {} as unknown as Config,
    matrixDBMock as MatrixDB
  )
)

beforeEach(() => {
  jest.restoreAllMocks()
})

describe('the user info API controller', () => {
  it('should return the user info', async () => {
    getMock.mockImplementation(
      async () =>
        ({
          givenName: 'David',
          sn: 'Who',
          uid: '@dwho:docker.localhost'
        } satisfies UserInformation)
    )

    const response = await supertest(app).get(`${PATH}/@dwho:docker.localhost`)

    expect(response.status).toEqual(200)
    expect(response.body).toEqual({
      givenName: 'David',
      sn: 'Who',
      uid: '@dwho:docker.localhost'
    })
  })

  it('should return 404 if user info cannot be found', async () => {
    getMock.mockImplementation(async () => null)

    const result = await supertest(app).get(`${PATH}/@dwho:docker.localhost`)

    expect(result.status).toEqual(404)
  })

  it('should return 500 if something wrong happens', async () => {
    getMock.mockRejectedValue(new Error('test'))

    const result = await supertest(app).get(`${PATH}/@dwho:docker.localhost`)

    expect(result.status).toEqual(500)
  })
})

describe('the user visibility API controller', () => {
  it('should update the user profile visibility settings', async () => {
    updateVisibilityMock.mockImplementation(async (userId, payload) => ({
      matrix_id: userId,
      ...payload
    }))

    const payload = {
      visibility: 'contacts',
      visible_fields: ['email']
    }

    const userId = '@dwho:docker.localhost'

    const response = await supertest(app)
      .post(`${PATH}/${encodeURIComponent(userId)}/visibility`)
      .send(payload)
      .set('Accept', 'application/json')

    // verify the route worked
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      matrix_id: userId,
      visibility: 'contacts',
      visible_fields: ['email']
    })

    expect(updateVisibilityMock).toHaveBeenCalledWith(userId, payload)
  })
})

describe('UserInfoController – additional branch coverage (unit)', () => {
  const userdb = {} as any
  const db = {} as any
  const matrixDB = {} as any
  const config = {} as any
  const logger = {} as any

  const makeRes = () => {
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }
    return res
  }

  const makeReq = (overrides: Partial<AuthRequest> = {}): AuthRequest => {
    return {
      params: {},
      body: {},
      userId: '@dwho:docker.localhost',
      ...overrides
    } as AuthRequest
  }

  const next = jest.fn()
  let controller: UserInfoController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new UserInfoController(userdb, db, matrixDB, config, logger)
  })

  it('get() → 400 when request has no authenticated userId', async () => {
    const req = makeReq({
      userId: undefined,
      params: { userId: '@foo:example.com' }
    })
    const res = makeRes()
    await controller.get(req, res, next)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: expect.anything() })
    expect(next).not.toHaveBeenCalled()
  })

  it('get() → 403 when service throws ForbiddenError', async () => {
    getMock.mockRejectedValue(new ForbiddenError('nope'))

    const req = makeReq({ params: { userId: '@foo:example.com' } })
    const res = makeRes()
    await controller.get(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: expect.anything() })
    expect(next).not.toHaveBeenCalled()
  })

  it('updateVisibility() → 403 when path userId differs from auth userId', async () => {
    const req = makeReq({
      params: { userId: '@other:user' },
      body: { visibility: 'public', visible_fields: [] }
    })
    const res = makeRes()
    await controller.updateVisibility(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: expect.anything() })
    expect(next).not.toHaveBeenCalled()
  })

  it('updateVisibility() → 500 when service returns undefined', async () => {
    updateVisibilityMock.mockResolvedValue(undefined)

    const req = makeReq({
      params: { userId: '@dwho:docker.localhost' },
      body: { visibility: 'public', visible_fields: [] }
    })
    const res = makeRes()
    await controller.updateVisibility(req, res, next)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: expect.anything() })
    expect(next).not.toHaveBeenCalled()
  })

  it('updateVisibility() → passes error to next() when service throws database error', async () => {
    const dbError = new Error(
      'Failed to retrieve visibility settings for user @dwho:docker.localhost'
    )
    updateVisibilityMock.mockRejectedValue(dbError)

    const req = makeReq({
      params: { userId: '@dwho:docker.localhost' },
      body: { visibility: 'public', visible_fields: [] }
    })
    const res = makeRes()
    await controller.updateVisibility(req, res, next)

    expect(next).toHaveBeenCalledWith(dbError)
    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).not.toHaveBeenCalled()
  })

  it('updateVisibility() → passes error to next() when service throws insert error', async () => {
    const dbError = new Error(
      'Failed to create visibility settings for user @dwho:docker.localhost'
    )
    updateVisibilityMock.mockRejectedValue(dbError)

    const req = makeReq({
      params: { userId: '@dwho:docker.localhost' },
      body: { visibility: 'contacts', visible_fields: ['email'] }
    })
    const res = makeRes()
    await controller.updateVisibility(req, res, next)

    expect(next).toHaveBeenCalledWith(dbError)
    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).not.toHaveBeenCalled()
  })

  it('updateVisibility() → passes error to next() when service throws update error', async () => {
    const dbError = new Error(
      'Failed to update visibility settings for user @dwho:docker.localhost'
    )
    updateVisibilityMock.mockRejectedValue(dbError)

    const req = makeReq({
      params: { userId: '@dwho:docker.localhost' },
      body: { visibility: 'private', visible_fields: [] }
    })
    const res = makeRes()
    await controller.updateVisibility(req, res, next)

    expect(next).toHaveBeenCalledWith(dbError)
    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).not.toHaveBeenCalled()
  })
})
