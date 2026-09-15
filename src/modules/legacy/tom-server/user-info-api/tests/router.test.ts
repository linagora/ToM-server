import { afterAll, beforeAll, beforeEach, describe, expect, it, mock, spyOn, test } from 'bun:test'
import { type ConfigDescription } from '../../../../config-parser'
import { IdentityServerDb, type MatrixDB } from '../../../matrix-identity-server'
import express from 'express'
import fs from 'fs'
import path from 'path'
import supertest, { type Response } from 'supertest'
import JEST_PROCESS_ROOT_PATH from '../../../jest.globals'
import IdServer from '../../identity-server'
import type { Config } from '../../types'
import type { IUserInfoService } from '../types'
import router, { PATH } from '../routes'

const app = express()

spyOn(IdentityServerDb.prototype, 'get').mockResolvedValue([{ data: '"test"' }])

const matrixDBMock: Partial<MatrixDB> = {
  get: mock().mockResolvedValue([{ displayname: '', avatar_url: 'avatar_url' }])
} as unknown as Partial<MatrixDB>

const idServer = new IdServer(
  matrixDBMock as MatrixDB,
  {} as unknown as Config,
  {
    database_engine: 'sqlite',
    database_host: 'test.db',
    rate_limiting_window: 10000,
    rate_limiting_nb_requests: 100,
    template_dir: 'assets/templates',
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
  } as unknown as ConfigDescription
)

const serviceGetSpy = mock().mockResolvedValue({ uid: 'test' })
const userInfoServiceMock = { get: serviceGetSpy } as unknown as IUserInfoService

beforeEach(() => {
  spyOn(console, 'warn').mockImplementation(() => {})
  serviceGetSpy.mockClear()
})

describe('the user info API Router', () => {
  beforeAll((done) => {
    idServer.ready
      .then(() => {
        app.use(
          router(
            idServer,
            { userdb_engine: 'ldap' } as unknown as Config,
            matrixDBMock as MatrixDB,
            undefined,
            userInfoServiceMock
          )
        )
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

  it('should reject if more than 100 requests are done in less than 10 seconds', { timeout: 30000 }, async () => {
    let response
    let token
    // eslint-disable-next-line @typescript-eslint/no-for-in-array, @typescript-eslint/no-unused-vars
    for (const i in [...Array(101).keys()]) {
      token = Number(i) % 2 === 0 ? `Bearer test` : 'falsy_token'
      response = await supertest(app)
        .get(`${PATH}/test`)
        .set('Authorization', token)
    }
    expect((response as Response).statusCode).toEqual(429)
    await new Promise((resolve) => setTimeout(resolve, 11000))
  })

  it('should call the ldap check middleware', async () => {
    const nonLdapApp = express()
    nonLdapApp.use(
      router(
        idServer,
        {} as unknown as Config,
        matrixDBMock as MatrixDB,
        undefined,
        userInfoServiceMock
      )
    )

    const blocked = await supertest(nonLdapApp).get(`${PATH}/test`)
    expect(blocked.status).toEqual(500)
    expect(serviceGetSpy).not.toHaveBeenCalled()
  })

  it('should call the controller if the user is authenticated via Bearer', async () => {
    await supertest(app).get(`${PATH}/test`).set('Authorization', 'Bearer test')

    expect(serviceGetSpy).toHaveBeenCalled()
  })

  it('should call the controller if the user is authenticated via access_token', async () => {
    await supertest(app).get(`${PATH}/test`).query({ access_token: 'test' })

    expect(serviceGetSpy).toHaveBeenCalled()
  })

  it('should not call the controller if no bearer or access_token is provided', async () => {
    await supertest(app).get(`${PATH}/test`)

    expect(serviceGetSpy).not.toHaveBeenCalled()
  })
})
