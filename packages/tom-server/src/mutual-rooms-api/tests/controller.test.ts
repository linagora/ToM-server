import type { MatrixDBBackend } from '@twake/matrix-identity-server'
import bodyParser from 'body-parser'
import express from 'express'
import supertest from 'supertest'
import type { Config } from '../../types'
import router, { PATH } from '../routes'

const app = express()

const matrixDbMock = {
  get: jest.fn()
}

const authenticatorMock = jest
  .fn()
  .mockImplementation((req, res, callbackMethod) => {
    callbackMethod('test', 'test')
  })

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(
  router(
    {} as unknown as Config,
    matrixDbMock as unknown as MatrixDBBackend,
    authenticatorMock
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
