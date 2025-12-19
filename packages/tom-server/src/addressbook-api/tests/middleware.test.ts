import type { AuthRequest, TwakeDB, Config } from '../../types'
import type { UserDB } from '@twake/matrix-identity-server'
import type { Response, NextFunction } from 'express'
import Middleware from '../middlewares'
import { type TwakeLogger } from '@twake/logger'
import type { IUserInfoService } from '../../user-info-api/types'

let mockRequest: Partial<AuthRequest>
let mockResponse: Partial<Response>

const dbMock = {
  get: jest.fn(),
  getAll: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  deleteEqual: jest.fn(),
  getCount: jest.fn()
}

const userDBMock = {
  get: jest.fn(),
  getAll: jest.fn(),
  match: jest.fn(),
  close: jest.fn(),
  ready: Promise.resolve()
}

const configMock = {
  server_name: 'example.com',
  additional_features: false
}

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn()
}

const userInfoServiceMock = {
  get: jest.fn(),
  getMany: jest.fn(),
  getVisibility: jest.fn(),
  updateVisibility: jest.fn()
}

const nextFunction: NextFunction = jest.fn()
const addressbookApiMiddleware = new Middleware(
  dbMock as unknown as TwakeDB,
  loggerMock as unknown as TwakeLogger,
  userDBMock as unknown as UserDB,
  configMock as unknown as Config,
  userInfoServiceMock as unknown as IUserInfoService
)

beforeEach(() => {
  mockRequest = {
    body: {},
    query: {},
    params: {
      id: 'contactId'
    },
    userId: 'test'
  }

  mockResponse = {
    json: jest.fn(),
    status: jest.fn().mockReturnThis()
  }
})

describe('the Addressbook API middleware', () => {
  describe('the checkContactOwnership middleware', () => {
    it('should not call the next handler if the user is not the owner of the contact and return 403', async () => {
      dbMock.get.mockImplementation((table) => {
        if (table === 'contacts') {
          return [
            {
              id: 'contactId',
              mxid: '@test:server.com',
              display_name: 'contact',
              addressbookId: 'addressbookId',
              userId: 'anotherUser'
            }
          ]
        }

        if (table === 'addressbooks') {
          return [
            {
              id: 'addressbookId',
              owner: 'another'
            }
          ]
        }
      })

      await addressbookApiMiddleware.checkContactOwnership(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(403)
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Forbidden' })
    })

    it('should not call the next handler if the contact is not found and return 404', async () => {
      dbMock.get.mockReturnValue([])

      await addressbookApiMiddleware.checkContactOwnership(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(404)
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Contact not found'
      })
    })

    it('should not call the next handler if the user addressbook is not found and return 404', async () => {
      dbMock.get.mockImplementation((table) => {
        if (table === 'contacts') {
          return [
            {
              id: 'contactId',
              mxid: '@test:server.com',
              display_name: 'contact',
              addressbookId: 'addressbookId',
              userId: 'anotherUser'
            }
          ]
        }

        if (table === 'addressbooks') {
          return []
        }
      })

      await addressbookApiMiddleware.checkContactOwnership(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(404)
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Addressbook not found'
      })
    })
  })

  describe('the validateContactUpdate middleware', () => {
    it('should not call the next handler if the update payload has missing fields', async () => {
      await addressbookApiMiddleware.validateContactUpdate(
        {
          ...mockRequest,
          body: {
            mxid: '@test:server.com'
          }
        } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Missing display_name'
      })
    })

    it('should return 500 if the body is missing', async () => {
      await addressbookApiMiddleware.validateContactUpdate(
        {
          ...mockRequest,
          body: undefined
        } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).toHaveBeenCalledWith(Error('Missing body'))
    })
  })

  describe('the validateContactsCreation middleware', () => {
    it('should not call the next handler if the creation payload has missing fields', async () => {
      await addressbookApiMiddleware.validateContactsCreation(
        {
          ...mockRequest,
          body: {
            contacts: [
              {
                mxid: '@test:server.com'
              }
            ]
          }
        } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Missing display_name'
      })
    })

    it('should return 400 if the body is missing', async () => {
      await addressbookApiMiddleware.validateContactsCreation(
        {
          ...mockRequest,
          body: undefined
        } as AuthRequest,
        mockResponse as Response,
        nextFunction
      )

      expect(nextFunction).not.toHaveBeenCalled()
      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })
  })
})
