/* eslint-disable @typescript-eslint/consistent-type-assertions */
import express, { type NextFunction, type Response } from 'express'
import router, { PATH } from '../routes'
import supertest from 'supertest'
import { prismaMock } from '../../../singleton'
import bodyParser from 'body-parser'
import type { Config, IdentityServerDb } from '../../utils'
import type { AuthRequest } from '../types'

const app = express()

jest.mock('../../identity-server/utils/authenticate', () => {
  return (db: IdentityServerDb, conf: Config) =>
    (
      req: AuthRequest,
      res: Response,
      cb: (data: any, token: string) => void
    ) => {
      // eslint-disable-next-line n/no-callback-literal
      cb('test', 'test')
    }
})

jest.mock('../../private-note-api/middlewares/validation.middleware.ts', () => {
  const passiveMiddlewareMock = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    next()
  }

  return {
    checkGetRequirements: passiveMiddlewareMock,
    checkCreationRequirements: passiveMiddlewareMock,
    checkUpdateRequirements: passiveMiddlewareMock,
    checkDeleteRequirements: passiveMiddlewareMock
  }
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(router({} as IdentityServerDb, {} as Config))

describe('the private note controller', () => {
  it('should try to fetch a note', async () => {
    prismaMock.note.findFirst.mockResolvedValue({
      id: 1,
      authorId: 'test',
      content: 'some note',
      targetId: 'test'
    })

    const response = await supertest(app)
      .get(PATH)
      .query({ target: 'test', author: 'test' })
      .send()

    expect(response.status).toBe(200)
    expect(response.body).toEqual('some note')
  })

  it('should try to create a note', async () => {
    prismaMock.note.findFirst.mockResolvedValue(null)
    prismaMock.note.create.mockResolvedValue({
      id: 1,
      authorId: 'test',
      content: 'some note',
      targetId: 'test'
    })

    const response = await supertest(app)
      .post(PATH)
      .send({ target: 'test', author: 'test', content: 'some note' })

    expect(response.status).toBe(201)
  })

  it('should try to update a note', async () => {
    prismaMock.note.findFirst.mockResolvedValue({
      id: 1,
      authorId: 'test',
      content: 'some note',
      targetId: 'test'
    })

    prismaMock.note.update.mockResolvedValue({
      id: 1,
      authorId: 'test',
      content: 'some note',
      targetId: 'test'
    })

    const response = await supertest(app)
      .put(PATH)
      .send({ id: 1, content: 'some note' })

    expect(response.status).toBe(204)
  })

  it('should try to delete a note', async () => {
    prismaMock.note.findFirst.mockResolvedValue({
      id: 1,
      authorId: 'test',
      content: 'some note',
      targetId: 'test'
    })

    prismaMock.note.delete.mockResolvedValue({
      id: 1,
      authorId: 'test',
      content: 'some note',
      targetId: 'test'
    })

    const response = await supertest(app).delete(`${PATH}/1`).send()

    expect(response.status).toBe(204)
  })

  it('should fail to fetch a note when a parameter is missing', async () => {
    const response = await supertest(app)
      .get(PATH)
      .query({ target: 'test' })
      .send()

    expect(response.status).toBe(500)
  })

  it('should return 404 when a note is not found', async () => {
    prismaMock.note.findFirst.mockResolvedValue(null)

    const response = await supertest(app)
      .get(PATH)
      .query({ target: 'test', author: 'test' })
      .send()

    expect(response.status).toBe(404)
  })

  it('should fail to create a note when a parameter is missing', async () => {
    const response = await supertest(app).post(PATH).send({ target: 'test' })

    expect(response.status).toBe(500)
  })

  it('should fail to update a note when it does not already exist', async () => {
    prismaMock.note.findFirst.mockResolvedValue(null)

    const response = await supertest(app)
      .put(PATH)
      .send({ id: 1, content: 'something' })

    expect(response.status).toBe(500)
  })

  it('should fail to delete a note when it does not already exist', async () => {
    prismaMock.note.findFirst.mockResolvedValue(null)

    const response = await supertest(app).delete(`${PATH}/1`).send()

    expect(response.status).toBe(500)
  })
})
