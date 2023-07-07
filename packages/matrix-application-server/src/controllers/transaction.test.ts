import { type NextFunction, type Request, type Response } from 'express'
import { Result } from 'express-validator'
import type MatrixApplicationServer from '..'
import { type ClientEvent } from '../interfaces'
import { AppServerAPIError, type expressAppHandler } from '../utils'
import { transaction } from './transaction'

const transactionId = 'transaction_1'
const lastProcessedTxnId = 'transaction_0'

describe('Transaction', () => {
  let appServer: Partial<MatrixApplicationServer>
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let nextFunction: NextFunction

  beforeEach(() => {
    jest.spyOn(Result.prototype, 'isEmpty').mockImplementation(() => {
      return true
    })
    mockResponse = {
      send: jest.fn().mockImplementation(() => mockResponse)
    }
    nextFunction = jest.fn()
    mockRequest = {
      params: {
        txnId: transactionId
      },
      body: {
        events: [
          {
            content: {
              avatar_url: 'mxc://example.org/SEsfnsuifSDFSSEF',
              displayname: 'Alice Margatroid',
              membership: 'join',
              reason: 'Looking for support'
            },
            event_id: '$143273582443PhrSn:example.org',
            origin_server_ts: 1432735824653,
            room_id: '!jEsUZKDJdhlrceRyVU:example.org',
            sender: '@example:example.org',
            state_key: '@alice:example.org',
            type: 'm.room.member',
            unsigned: {
              age: 1234
            }
          },
          {
            content: {
              body: 'This is an example text message',
              format: 'org.matrix.custom.html',
              formatted_body: '<b>This is an example text message</b>',
              msgtype: 'm.text'
            },
            event_id: '$143273582443PhrSn:example.org',
            origin_server_ts: 1432735824653,
            room_id: '!jEsUZKDJdhlrceRyVU:example.org',
            sender: '@example:example.org',
            type: 'm.room.message',
            unsigned: {
              age: 1234
            }
          }
        ]
      }
    }
    appServer = {
      lastProcessedTxnId,
      emit: jest.fn()
    }
  })

  it('should browse request body events and send a response', () => {
    const handler: expressAppHandler = transaction(
      appServer as MatrixApplicationServer
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(mockResponse.send).toHaveBeenCalledTimes(1)
    expect(mockResponse.send).toHaveBeenCalledWith({})
    expect(appServer.emit).toHaveBeenCalledTimes(2)
    const events: ClientEvent[] = mockRequest.body.events
    expect(appServer.emit).toHaveBeenNthCalledWith(
      1,
      'type: m.room.member | state_key: @alice:example.org',
      events[0]
    )
    expect(appServer.emit).toHaveBeenNthCalledWith(
      2,
      'type: m.room.message',
      events[1]
    )
    expect(appServer.lastProcessedTxnId).toEqual(transactionId)
  })

  it('should browse request body events and ephemerals then send a response', () => {
    mockRequest = {
      ...mockRequest,
      body: {
        ...mockRequest.body,
        'de.sorunome.msc2409.ephemeral': [
          {
            content: {
              avatar_url: 'mxc://localhost/wefuiwegh8742w',
              currently_active: false,
              last_active_ago: 2478593,
              presence: 'online',
              status_msg: 'Making cupcakes'
            },
            sender: '@example:localhost',
            type: 'm.presence'
          },
          {
            content: {
              body: 'This is an example event without type'
            },
            event_id: '$143273582443PhrSn:example.org',
            origin_server_ts: 1432735824653,
            sender: '@example:example.org'
          }
        ]
      }
    }
    const handler: expressAppHandler = transaction(
      appServer as MatrixApplicationServer
    )
    handler(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(mockResponse.send).toHaveBeenCalledTimes(1)
    expect(mockResponse.send).toHaveBeenCalledWith({})
    expect(appServer.emit).toHaveBeenCalledTimes(4)
    const events: ClientEvent[] = mockRequest.body.events
    const ephemerals: ClientEvent[] =
      mockRequest.body['de.sorunome.msc2409.ephemeral']
    expect(appServer.emit).toHaveBeenNthCalledWith(
      1,
      'type: m.room.member | state_key: @alice:example.org',
      events[0]
    )
    expect(appServer.emit).toHaveBeenNthCalledWith(
      2,
      'type: m.room.message',
      events[1]
    )
    expect(appServer.emit).toHaveBeenNthCalledWith(
      3,
      'ephemeral_type: m.presence',
      ephemerals[0]
    )
    expect(appServer.emit).toHaveBeenNthCalledWith(
      4,
      'ephemeral',
      ephemerals[1]
    )
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
    expect(mockResponse.send).toHaveBeenCalledTimes(1)
    expect(mockResponse.send).toHaveBeenCalledWith({})
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
