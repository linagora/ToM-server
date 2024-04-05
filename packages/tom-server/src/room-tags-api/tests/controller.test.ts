/* eslint-disable @typescript-eslint/consistent-type-assertions */
import type { MatrixDBBackend } from '@twake/matrix-identity-server'
import bodyParser from 'body-parser'
import express, { type NextFunction, type Response } from 'express'
import supertest from 'supertest'
import type { AuthRequest, Config, IdentityServerDb } from '../../types'
import router, { PATH } from '../routes'

const app = express()

const dbMock = {
  get: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  deleteEqual: jest.fn(),
  getCount: jest.fn()
}

const matrixDbMock = { ...dbMock }

const authenticatorMock = jest
  .fn()
  .mockImplementation((req, res, callbackMethod) => {
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
      checkFetchRequirements: passiveMiddlewareMock,
      checkCreateRequirements: passiveMiddlewareMock,
      checkUpdateRequirements: passiveMiddlewareMock,
      checkDeleteRequirements: passiveMiddlewareMock
    }
  }
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(
  router(
    dbMock as unknown as IdentityServerDb,
    matrixDbMock as unknown as MatrixDBBackend,
    {} as Config,
    authenticatorMock
  )
)

beforeEach(() => {
  jest.restoreAllMocks()
})

describe('the room tags API controller', () => {
  it('should try to fetch tags for a room', async () => {
    dbMock.get.mockResolvedValue([
      {
        id: 1,
        authorId: 'test',
        content: '["TAG"]',
        roomId: 'testroom'
      }
    ])

    const response = await supertest(app).get(`${PATH}/testroom`).send()

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ tags: ['TAG'] })
  })

  it('should try to create a tag for a room', async () => {
    const response = await supertest(app)
      .post(PATH)
      .send({ roomId: 'testroom', content: ['TAG1', 'TAG2'] })

    expect(response.status).toBe(201)
  })

  it('should try to update a tag for a room', async () => {
    dbMock.get.mockResolvedValue([
      {
        id: 1,
        authorId: 'test',
        content: '["TAG1", "TAG2"]',
        roomId: 'test'
      }
    ])

    const response = await supertest(app)
      .put(`${PATH}/test`)
      .send({ content: ['TAG1', 'TAG2', 'TAG3'] })

    expect(response.status).toBe(204)
  })

  it('should try to delete a tag for a room', async () => {
    dbMock.get.mockResolvedValue([
      {
        id: 1,
        authorId: 'test',
        content: '["TAG1", "TAG2"]',
        roomId: 'test'
      }
    ])

    const response = await supertest(app).delete(`${PATH}/test`).send()

    expect(response.status).toBe(204)
  })

  it('should return an empty list if the room tag does not exist', async () => {
    dbMock.get.mockResolvedValue([])

    const response = await supertest(app).get(`${PATH}/test`)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ tags: [] })
  })

  it("should return an error when the room tag can't be created", async () => {
    dbMock.insert.mockRejectedValue(new Error('some random error'))

    const response = await supertest(app)
      .post(PATH)
      .send({ roomId: 'testroom', content: ['TAG1', 'TAG2'] })

    expect(response.status).toBe(500)
  })

  it("should return an error when the room tag can't be updated", async () => {
    dbMock.get.mockResolvedValue([])
    dbMock.update.mockRejectedValue(new Error('some random error'))

    const response = await supertest(app)
      .put(`${PATH}/test`)
      .send({ content: ['TAG1', 'TAG2', 'TAG3'] })

    expect(response.status).toBe(500)
  })

  it("should return an error when the room tag can't be deleted", async () => {
    dbMock.get.mockResolvedValue([])
    dbMock.deleteEqual.mockRejectedValue(new Error('some random error'))

    const response = await supertest(app).delete(`${PATH}/test`).send()

    expect(response.status).toBe(500)
  })

  it("should return an error when the room tag can't be fetched", async () => {
    dbMock.get.mockRejectedValue(new Error('some random error'))

    const response = await supertest(app).get(`${PATH}/test`)

    expect(response.status).toBe(500)
  })

  it('should return an error when the room that is about to be updated does not exist', async () => {
    dbMock.get.mockResolvedValue([])

    const response = await supertest(app)
      .put(`${PATH}/test`)
      .send({ content: ['TAG1', 'TAG2', 'TAG3'] })

    expect(response.status).toBe(500)
  })
})
