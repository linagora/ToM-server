import express, { type NextFunction, type Response } from 'express'
import type { AuthRequest, Config, IdentityServerDb } from '../../types'
import router, { PATH } from '../routes'
import type TwakeIdentityServer from '../../identity-server'
import supertest from 'supertest'
import type { UserInformation } from '../types'

const app = express()

jest.mock('../middlewares/require-ldap.ts', () => {
  return () =>
    (_req: AuthRequest, _res: Response, next: NextFunction): void => {
      next()
    }
})

jest.mock('../../identity-server/utils/authenticate', () => {
  return (_db: IdentityServerDb, _conf: Config) =>
    (
      _req: AuthRequest,
      _res: Response,
      cb: (data: any, token: string) => void
    ) => {
      // eslint-disable-next-line n/no-callback-literal
      cb('test', 'test')
    }
})

const getMock = jest.fn()

jest.mock('../services/index.ts', () => {
  return function () {
    return {
      get: getMock
    }
  }
})

const idServerMock = {
  db: {},
  userDb: {}
}

app.use(
  router(
    idServerMock as unknown as TwakeIdentityServer,
    {} as unknown as Config
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
          uid: 'dwho'
        } satisfies UserInformation)
    )

    const response = await supertest(app).get(`${PATH}/dwho`)

    expect(response.status).toEqual(200)
    expect(response.body).toEqual({
      info: {
        givenName: 'David',
        sn: 'Who',
        uid: 'dwho'
      }
    })
  })

  it('should return 404 if user info cannot be found', async () => {
    getMock.mockImplementation(async () => null)

    const result = await supertest(app).get(`${PATH}/dwho`)

    expect(result.status).toEqual(404)
  })

  it('should return 500 if something wrong happens', async () => {
    getMock.mockRejectedValue(new Error('test'))

    const result = await supertest(app).get(`${PATH}/dwho`)

    expect(result.status).toEqual(500)
  })
})
