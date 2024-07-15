/* eslint-disable @typescript-eslint/consistent-type-assertions */
import bodyParser from 'body-parser'
import express, { type NextFunction, type Response } from 'express'
import supertest from 'supertest'
import type { AuthRequest, Config, IdentityServerDb } from '../../types'
import router, { PATH } from '../routes'
import type { TwakeLogger } from '@twake/logger'

const app = express()

const dbMock = {
  get: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  deleteEqual: jest.fn(),
  getCount: jest.fn()
}

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}

const authenticatorMock = jest
  .fn()
  .mockImplementation((_req, _res, callbackMethod) => {
    callbackMethod('test', 'test')
  })

jest.mock('../middlewares/index.ts', () => {
  const passiveMiddlewareMock = (
    _req: AuthRequest,
    _res: Response,
    next: NextFunction
  ): void => {
    next()
  }

  return function () {
    return {
      checkCreationRequirements: passiveMiddlewareMock
    }
  }
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(
  router(
    dbMock as unknown as IdentityServerDb,
    {} as Config,
    authenticatorMock,
    loggerMock as unknown as TwakeLogger
  )
)

describe('the active contacts API controller', () => {
  describe('active contacts fetch', () => {
    it('should try to fetch the saved active contacts', async () => {
      dbMock.get.mockResolvedValue([
        {
          userId: 'test',
          contacts: 'test'
        }
      ])

      const response = await supertest(app).get(PATH).send()

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ contacts: 'test' })
    })

    it('should return an error if no active contacts are found', async () => {
      dbMock.get.mockResolvedValue([])

      const response = await supertest(app).get(PATH).send()

      expect(response.status).toBe(404)
      expect(response.body).toEqual({ message: 'No active contacts found' })
    })

    it('should return an error if an error occurs while fetching active contacts', async () => {
      dbMock.get.mockRejectedValue(new Error('test'))

      const response = await supertest(app).get(PATH).send()

      expect(response.status).toBe(500)
    })
  })

  describe('active contacts save', () => {
    it('should try to save active contacts', async () => {
      dbMock.get.mockResolvedValue([])
      dbMock.insert.mockResolvedValue([])

      const response = await supertest(app)
        .post(PATH)
        .send({ contacts: 'test' })

      expect(response.status).toBe(201)
    })

    it('should return an error if an error occurs while saving active contacts', async () => {
      dbMock.insert.mockRejectedValue(new Error('test'))

      const response = await supertest(app)
        .post(PATH)
        .send({ contacts: 'test' })

      expect(response.status).toBe(500)
    })

    it('should return an error if the parameters are missing', async () => {
      const response = await supertest(app).post(PATH).send({})

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ message: 'Bad Request' })
    })
  })

  describe('active contacts delete', () => {
    it('should try to delete active contacts', async () => {
      dbMock.deleteEqual.mockResolvedValue([])

      const response = await supertest(app).delete(PATH).send()

      expect(response.status).toBe(200)
    })

    it('should return an error if an error occurs while deleting active contacts', async () => {
      dbMock.deleteEqual.mockRejectedValue(new Error('test'))

      const response = await supertest(app).delete(PATH).send()

      expect(response.status).toBe(500)
    })
  })
})
