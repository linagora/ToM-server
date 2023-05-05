import express, { type Response } from 'express'
import type { Config, IdentityServerDb, AuthRequest } from '../../types'
import router, { PATH } from '../routes'
import supertest from 'supertest'
import bodyParser from 'body-parser'
import type { MatrixDBBackend } from '@twake/matrix-identity-server'

const app = express()

const dbMock = {
  get: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  deleteEqual: jest.fn(),
  getCount: jest.fn()
}

const matrixDbMock = {
  get: jest.fn()
}

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

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(
  router(
    dbMock as unknown as IdentityServerDb,
    {} as unknown as Config,
    matrixDbMock as unknown as MatrixDBBackend
  )
)

describe('the mutual rooms controller', () => {
  it('should try to fetch the list of mutual rooms', async () => {
    matrixDbMock.get.mockImplementation(
      async (table, ...args: any): Promise<any> => {
        if (table === 'room_memberships') {
          return [
            {
              room_id: 'test',
              user_id: 'test'
            }
          ]
        }

        if (table === 'room_stats_state') {
          return [
            {
              room_id: 'test',
              name: 'test',
              topic: 'test',
              room_type: 'test'
            }
          ]
        }
      }
    )

    const response = await supertest(app).get(`${PATH}/test`)

    expect(response.status).toEqual(200)
    expect(response.body).toEqual({
      rooms: [
        {
          room_id: 'test',
          name: 'test',
          topic: 'test',
          room_type: 'test'
        }
      ]
    })
  })

  it('should return an error if something goes wrong', async () => {
    matrixDbMock.get.mockImplementation(
      async (table, ...args: any): Promise<any> => {
        if (table === 'room_memberships') {
          throw new Error('test')
        }
      }
    )

    await supertest(app).get(`${PATH}/test`).expect(500)
  })

  it('should return an empty list if no rooms are found', async () => {
    matrixDbMock.get.mockImplementation(
      async (table, ...args: any): Promise<any> => {
        if (table === 'room_memberships') {
          return []
        }
      }
    )

    const response = await supertest(app).get(`${PATH}/test`)

    expect(response.status).toEqual(200)
    expect(response.body).toEqual({
      rooms: []
    })
  })
})
