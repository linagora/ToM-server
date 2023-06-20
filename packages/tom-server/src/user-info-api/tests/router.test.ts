import express from 'express'
import type { Config } from '../../types'
import router, { PATH } from '../routes'
import type TwakeIdentityServer from '../../identity-server'
import supertest from 'supertest'

const app = express()

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

const middlewareSpy = jest.fn().mockImplementation((_req, _res, next) => {
  next()
})

const controllerGetSpy = jest.fn().mockImplementation((_req, res, _next) => {
  res.status(200).send('OK')
})

jest.mock('../middlewares/require-ldap.ts', () => {
  return () => middlewareSpy
})

jest.mock('../controllers/index.ts', () => {
  return function () {
    return {
      get: controllerGetSpy
    }
  }
})

const idServerMock = {
  db: {
    get: async () => [{ data: '"test"' }]
  },
  userDb: {
    get: jest.fn()
  }
}

app.use(
  router(
    idServerMock as unknown as TwakeIdentityServer,
    {} as unknown as Config
  )
)

describe('the user info API Router', () => {
  it('should call the ldap check middleware', async () => {
    await supertest(app).get(`${PATH}/test`)

    expect(middlewareSpy).toHaveBeenCalled()
  })

  it('should call the controller if the user is authenticated via Bearer', async () => {
    await supertest(app).get(`${PATH}/test`).set('Authorization', 'Bearer test')

    expect(controllerGetSpy).toHaveBeenCalled()
  })

  it('should call the controller if the user is authenticated via access_token', async () => {
    await supertest(app).get(`${PATH}/test`).query({ access_token: 'test' })

    expect(controllerGetSpy).toHaveBeenCalled()
  })

  it('should not call the controller if no bearer or access_token is provided', async () => {
    await supertest(app).get(`${PATH}/test`)

    expect(controllerGetSpy).not.toHaveBeenCalled()
  })
})
