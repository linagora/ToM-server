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
import router, { PATH } from '../routes'

const app = express()

spyOn(IdentityServerDb.prototype, 'get')
  .mockResolvedValue([{ data: '"test"' }])

const idServer = new IdServer(
  {
    get: mock()
  } as unknown as MatrixDB,
  {
    qr_code_url: 'https://example.com/'
  } as unknown as Config,
  {
    database_engine: 'sqlite',
    database_host: 'test.db',
    rate_limiting_window: 5000,
    rate_limiting_nb_requests: 10,
    template_dir: 'assets/templates',
    userdb_host: './tokens.db',
    qr_code_url: 'https://example.com',
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

beforeEach(() => {
  spyOn(console, 'warn').mockImplementation(() => {})
  controllerGetSpy.mockClear()
})

const controllerGetSpy = mock().mockImplementation((_req, res, _next) => {
  res.status(200).send('OK')
})

mock.module('../controllers/index.ts', () => {
  return {
    default: function () {
      return {
        get: controllerGetSpy
      }
    }
  }
})

describe('the QRCode API router', () => {
  beforeAll((done) => {
    idServer.ready
      .then(() => {
        app.use(router(idServer, {} as unknown as Config))
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

  it('should reject if rate limit is exceeded', { timeout: 30000 }, async () => {
    let response

    for (let i = 0; i < 11; i++) {
      response = await supertest(app)
        .get(PATH)
        .set('Authorization', 'Bearer test')
    }

    expect((response as unknown as Response).status).toEqual(429)
    await new Promise((resolve) => setTimeout(resolve, 6000))
  })

  it('should call the controller if the user is authenticated via Bearer', async () => {
    await supertest(app).get(PATH).set('Authorization', 'Bearer test')

    expect(controllerGetSpy).toHaveBeenCalled()
  })

  it('should call the controller if the user is authenticated via access_token', async () => {
    await supertest(app).get(PATH).query({ access_token: 'test' })

    expect(controllerGetSpy).toHaveBeenCalled()
  })

  it('should not call the controller if no bearer or access_token is provided', async () => {
    await supertest(app).get(PATH)

    expect(controllerGetSpy).not.toHaveBeenCalled()
  })
})
