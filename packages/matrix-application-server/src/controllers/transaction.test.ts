import type MatrixApplicationServer from '..'
import { AppServerAPIError, type expressAppHandler } from '../utils'
import { transaction } from './transaction'
import { type Request, type Response, type NextFunction } from 'express'
import { Result } from 'express-validator'

const transactionId = 'transaction_1'
const lastProcessedTxnId = 'transaction_0'

describe('Transaction', () => {
  let appServer: Partial<MatrixApplicationServer>
  const spyOnFilter = jest.spyOn(Array.prototype, 'filter')
  let mockRequest: Partial<Request>
  const mockResponse: Partial<Response> = {
    send: jest.fn().mockImplementation(() => mockResponse)
  }
  const nextFunction: NextFunction = jest.fn()
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequest = {
      params: {
        txnId: transactionId
      },
      body: {
        events: [
          {
            state_key: 'test',
            type: 'm.room.member'
          },
          {
            type: 'm.room.message'
          }
        ]
      }
    }
    appServer = {
      lastProcessedTxnId
    }
  })

  it('should browse request body events and send a response', () => {
    const handler: expressAppHandler = transaction(
      appServer as MatrixApplicationServer
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(spyOnFilter).toHaveReturnedWith([
      {
        state_key: 'test',
        type: 'm.room.member'
      }
    ])
    expect(mockResponse.send).toHaveBeenCalledWith()
    expect(appServer.lastProcessedTxnId).toEqual(transactionId)
  })

  it('should browse request body events, filter should return empty array if no state events and send a response', () => {
    mockRequest.body = {
      events: [
        {
          type: 'm.room.message'
        },
        {
          type: 'm.room.message'
        }
      ]
    }
    const handler: expressAppHandler = transaction(
      appServer as MatrixApplicationServer
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(spyOnFilter).toHaveReturnedWith([])
    expect(mockResponse.send).toHaveBeenCalledWith()
    expect(appServer.lastProcessedTxnId).toEqual(transactionId)
  })

  it('should send a response if transaction has already been processed', () => {
    mockRequest.params = {
      txnId: lastProcessedTxnId
    }
    const handler: expressAppHandler = transaction(
      appServer as MatrixApplicationServer
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(spyOnFilter).not.toHaveBeenCalled()
    expect(mockResponse.send).toHaveBeenCalledWith()
    expect(appServer.lastProcessedTxnId).toEqual(lastProcessedTxnId)
  })

  it('should throw an AppServerAPIError error status 400 if there are error with transaction id or request body events', () => {
    jest.spyOn(Result.prototype, 'isEmpty').mockImplementation(() => {
      return false
    })
    jest.spyOn(Result.prototype, 'array').mockImplementation(() => {
      return [
        {
          type: 'field',
          path: 'foo',
          msg: 'blabla',
          location: 'body',
          value: 123
        },
        {
          type: 'field',
          msg: 'yay',
          location: 'query',
          value: 'qux'
        }
      ]
    })

    const handler: expressAppHandler = transaction(
      appServer as MatrixApplicationServer
    )
    try {
      handler(mockRequest as Request, mockResponse as Response, nextFunction)
    } catch (e) {
      expect(e).toEqual(
        new AppServerAPIError({
          status: 400,
          message: 'Error field: blabla (property: foo), Error field: yay'
        })
      )
      expect(mockResponse.send).not.toHaveBeenCalled()
      expect(appServer.lastProcessedTxnId).toEqual(lastProcessedTxnId)
    }
  })
})
