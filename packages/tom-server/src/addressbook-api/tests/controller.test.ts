import express, { NextFunction } from 'express'
import type { AuthRequest, Config, TwakeDB } from '../../types'
import bodyParser from 'body-parser'
import router, { PATH } from '../routes'
import { TwakeLogger } from '@twake-chat/logger'
import supertest from 'supertest'

const app = express()

const dbMock = {
  get: jest.fn(),
  getAll: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  deleteEqual: jest.fn(),
  getCount: jest.fn()
}

const loggerMock = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn()
}

const authenticatorMock = jest
  .fn()
  .mockImplementation((_req, _res, callbackMethod) => {
    callbackMethod({ sub: 'test' }, 'test')
  })

jest.mock('../middlewares/index.ts', () => {
  const passiveMiddlewareMock = (
    _req: AuthRequest,
    _res: Response,
    next: NextFunction
  ): void => {
    _req.userId = 'test'
    next()
  }

  return function () {
    return {
      checkContactOwnership: passiveMiddlewareMock,
      validateContactUpdate: passiveMiddlewareMock,
      validateContactsCreation: passiveMiddlewareMock
    }
  }
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(
  router(
    {
      matrix_server: 'http://localhost:789',
      base_url: 'http://localhost'
    } as unknown as Config,
    dbMock as unknown as TwakeDB,
    authenticatorMock,
    loggerMock as unknown as TwakeLogger
  )
)

describe('the Addressbook API controller', () => {
  describe('the listAddressbook handler', () => {
    it('should try to list an addressbook', async () => {
      dbMock.get.mockImplementation((table) => {
        if (table === 'addressbooks') {
          return [
            {
              id: 'addressbookId',
              owner: 'testowner'
            }
          ]
        }

        if (table === 'contacts') {
          return [
            {
              id: 'contactId1',
              mxid: '@test1:server.com',
              display_name: 'my test contact 1',
              addressbook_id: 'addressbookId',
              active: 1
            },
            {
              id: 'contactId2',
              mxid: '@test2:server.com',
              display_name: 'my test contact 2',
              addressbook_id: 'addressbookId',
              active: 1
            }
          ]
        }
      })

      const response = await supertest(app)
        .get(PATH)
        .set('Authorization', 'Bearer test')
        .set('Accept', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        id: 'addressbookId',
        owner: 'test',
        contacts: [
          {
            id: 'contactId1',
            mxid: '@test1:server.com',
            display_name: 'my test contact 1',
            addressbook_id: 'addressbookId',
            active: true
          },
          {
            id: 'contactId2',
            mxid: '@test2:server.com',
            display_name: 'my test contact 2',
            addressbook_id: 'addressbookId',
            active: true
          }
        ]
      })
    })
    it("should list an empty addressbook when the user doesn't have one", async () => {
      dbMock.get.mockResolvedValue([])

      const response = await supertest(app)
        .get(PATH)
        .set('Authorization', 'Bearer test')
        .set('Accept', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        id: '',
        owner: 'test',
        contacts: []
      })
    })

    it('should en empty addressbook when an error occurs', async () => {
      dbMock.get.mockRejectedValue(new Error('test error'))

      const response = await supertest(app)
        .get(PATH)
        .set('Authorization', 'Bearer test')
        .set('Accept', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        id: '',
        owner: 'test',
        contacts: []
      })
    })
  })

  describe('the deleteAddressbook handler', () => {
    it('should try to delete an addressbook', async () => {
      dbMock.get.mockResolvedValue([
        {
          id: 'addressbookId',
          owner: 'testowner'
        }
      ])
      dbMock.deleteEqual.mockResolvedValue(true)

      const response = await supertest(app)
        .delete(PATH)
        .set('Authorization', 'Bearer test')
        .set('Accept', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        message: 'Addressbook deleted'
      })
    })

    it('should return a 500 error if something wrong happens', async () => {
      dbMock.get.mockResolvedValue([
        {
          id: 'addressbookId',
          owner: 'testowner'
        }
      ])
      dbMock.deleteEqual.mockRejectedValue(new Error('test error'))

      const response = await supertest(app)
        .delete(PATH)
        .set('Authorization', 'Bearer test')
        .set('Accept', 'application/json')

      expect(response.status).toBe(500)
    })

    it('should first delete all addressbook contacts then addressbook', async () => {
      dbMock.get.mockResolvedValue([
        {
          id: 'addressbookId',
          owner: 'testowner'
        }
      ])
      dbMock.deleteEqual.mockResolvedValue(true)

      const response = await supertest(app)
        .delete(PATH)
        .set('Authorization', 'Bearer test')
        .set('Accept', 'application/json')

      expect(dbMock.deleteEqual).toHaveBeenNthCalledWith(
        1,
        'contacts',
        'addressbook_id',
        'addressbookId'
      )
      expect(dbMock.deleteEqual).toHaveBeenNthCalledWith(
        2,
        'addressbooks',
        'id',
        'addressbookId'
      )
    })
  })

  describe('the fetchContact handler', () => {
    it('should attempt to fetch a contact', async () => {
      dbMock.get.mockResolvedValue([
        {
          id: 'contactId',
          mxid: '@test:server.com',
          display_name: 'my test contact',
          addressbook_id: 'addressbookId',
          active: 1
        }
      ])
      const response = await supertest(app)
        .get(`${PATH}/contactId`)
        .set('Authorization', 'Bearer test')
        .set('Accept', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        id: 'contactId',
        mxid: '@test:server.com',
        display_name: 'my test contact',
        addressbook_id: 'addressbookId',
        active: true
      })
    })

    it('should return 404 when a contact is not found', async () => {
      dbMock.get.mockResolvedValue([])

      const response = await supertest(app)
        .get(`${PATH}/contactId`)
        .set('Authorization', 'Bearer test')
        .set('Accept', 'application/json')

      expect(response.status).toBe(404)
      expect(response.body).toEqual({ message: 'Contact not found' })
    })
  })

  describe('the addContacts handler', () => {
    it('should attempt to add a contact to an addressbook', async () => {
      dbMock.get.mockImplementation((table) => {
        if (table === 'addressbooks') {
          return [
            {
              id: 'addressbookId',
              owner: 'testowner'
            }
          ]
        }

        if (table === 'contacts') {
          return []
        }
      })

      dbMock.insert.mockResolvedValue([
        {
          id: 'contactId',
          mxid: '@test1:server.com',
          display_name: 'test1',
          addressbook_id: 'addressbookId',
          active: 1
        }
      ])

      const response = await supertest(app)
        .post(PATH)
        .send({
          contacts: [
            {
              mxid: '@test1:server.com',
              display_name: 'test1'
            }
          ]
        })
        .set('Authorization', 'Bearer test')
        .set('Accept', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        id: 'addressbookId',
        owner: 'test',
        contacts: [
          {
            id: 'contactId',
            mxid: '@test1:server.com',
            display_name: 'test1',
            addressbook_id: 'addressbookId',
            active: true
          }
        ]
      })
    })

    it('should avoid creating duplicate contacts', async () => {
      dbMock.get.mockImplementation((table) => {
        if (table === 'addressbooks') {
          return [
            {
              id: 'addressbookId',
              owner: 'testowner'
            }
          ]
        }

        if (table === 'contacts') {
          return [
            {
              id: 'contactId',
              mxid: '@test1:server.com',
              display_name: 'test1',
              addressbook_id: 'addressbookId',
              active: 1
            }
          ]
        }
      })

      dbMock.insert.mockResolvedValue([
        {
          id: 'contactId2',
          mxid: '@test1:server.com',
          display_name: 'test1',
          addressbook_id: 'addressbookId',
          active: 1
        }
      ])

      const response = await supertest(app)
        .post(PATH)
        .send({
          contacts: [
            {
              mxid: '@test1:server.com',
              display_name: 'test1'
            }
          ]
        })
        .set('Authorization', 'Bearer test')
        .set('Accept', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        id: 'addressbookId',
        owner: 'test',
        contacts: []
      })
    })

    it('should only return created contacts and skip duplicates', async () => {
      dbMock.get.mockImplementation((table, _fields, filters) => {
        if (table === 'addressbooks') {
          return [
            {
              id: 'addressbookId',
              owner: 'testowner'
            }
          ]
        }

        if (table === 'contacts') {
          if (filters.mxid === '@test1:server.com') {
            return [
              {
                id: 'contactId',
                mxid: '@test1:server.com',
                display_name: 'test1',
                addressbook_id: 'addressbookId',
                active: 1
              }
            ]
          } else {
            return []
          }
        }
      })

      dbMock.insert.mockImplementation((table, data) => {
        if (table === 'contacts') {
          if (data.mxid === '@test1:server.com') {
            return [
              {
                id: 'contactId',
                mxid: '@test1:server.com',
                display_name: 'test1',
                addressbook_id: 'addressbookId',
                active: 1
              }
            ]
          } else {
            return [
              {
                id: 'contactId2',
                mxid: '@test2:server.com',
                display_name: 'test2',
                addressbook_id: 'addressbookId',
                active: 1
              }
            ]
          }
        }
      })

      const response = await supertest(app)
        .post(PATH)
        .send({
          contacts: [
            {
              mxid: '@test1:server.com',
              display_name: 'test1'
            },
            {
              mxid: '@test2:server.com',
              display_name: 'test2'
            }
          ]
        })
        .set('Authorization', 'Bearer test')
        .set('Accept', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        id: 'addressbookId',
        owner: 'test',
        contacts: [
          {
            id: 'contactId2',
            mxid: '@test2:server.com',
            display_name: 'test2',
            addressbook_id: 'addressbookId',
            active: true
          }
        ]
      })
    })

    it("should attempt to create a new addressbook when the user doesn't have one", async () => {
      dbMock.get.mockImplementation((table) => {
        if (table === 'addressbooks') {
          return []
        }

        if (table === 'contacts') {
          return []
        }
      })

      dbMock.insert.mockImplementation((table, data) => {
        if (table === 'addressbooks') {
          return [
            {
              id: 'addressbookId',
              owner: 'testowner'
            }
          ]
        }

        if (table === 'contacts') {
          return [
            {
              id: 'contactId',
              mxid: '@test1:server.com',
              display_name: 'test1',
              addressbook_id: 'addressbookId',
              active: 1
            }
          ]
        }
      })

      const response = await supertest(app)
        .post(PATH)
        .send({
          contacts: [
            {
              mxid: '@test1:server.com',
              display_name: 'test1'
            }
          ]
        })
        .set('Authorization', 'Bearer test')
        .set('Accept', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        id: 'addressbookId',
        owner: 'test',
        contacts: [
          {
            id: 'contactId',
            mxid: '@test1:server.com',
            display_name: 'test1',
            addressbook_id: 'addressbookId',
            active: true
          }
        ]
      })
    })
  })

  describe('the updateContact handler', () => {
    it('should attempt to update a contact', async () => {
      dbMock.update.mockResolvedValue([
        {
          id: 'contactId',
          mxid: '@test:server.com',
          display_name: 'new name',
          addressbook_id: 'addressbookId',
          active: 1
        }
      ])

      const response = await supertest(app)
        .put(`${PATH}/contactId`)
        .send({
          mxid: '@test:server.com',
          display_name: 'new name',
          active: true
        })
        .set('Authorization', 'Bearer test')
        .set('Accept', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        id: 'contactId',
        mxid: '@test:server.com',
        display_name: 'new name',
        addressbook_id: 'addressbookId',
        active: true
      })
    })

    it('should return 500 if something wrong happens', async () => {
      dbMock.update.mockRejectedValue(new Error('test error'))

      const response = await supertest(app)
        .put(`${PATH}/contactId`)
        .send({
          mxid: '@test:server.com',
          display_name: 'new name',
          active: true
        })
        .set('Authorization', 'Bearer test')
        .set('Accept', 'application/json')

      expect(response.status).toBe(500)
    })
  })

  describe('the deleteContact handler', () => {
    it('should attempt to delete a contact', async () => {
      dbMock.deleteEqual.mockResolvedValue(true)

      const response = await supertest(app)
        .delete(`${PATH}/contactId`)
        .set('Authorization', 'Bearer test')
        .set('Accept', 'application/json')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        message: 'Contact deleted'
      })
    })

    it('should return 500 if something wrong happens', async () => {
      dbMock.deleteEqual.mockRejectedValue(new Error('test error'))

      const response = await supertest(app)
        .delete(`${PATH}/contactId`)
        .set('Authorization', 'Bearer test')
        .set('Accept', 'application/json')

      expect(response.status).toBe(500)
    })
  })
})
