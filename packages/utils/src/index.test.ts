import { type Request, type Response } from 'express'
import type http from 'http'
import querystring from 'querystring'
import {
  send,
  jsonContent,
  validateParameters,
  epoch,
  toMatrixId
} from './index'
import { type TwakeLogger } from '@twake/logger'

describe('Utility Functions', () => {
  let mockResponse: Partial<Response & http.ServerResponse>
  let mockLogger: TwakeLogger

  beforeEach(() => {
    mockResponse = {
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn()
    }

    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn()
    } as unknown as TwakeLogger
  })

  describe('send', () => {
    it('should send a response with JSON content', () => {
      send(mockResponse as Response, 200, { message: 'ok' })

      expect(mockResponse.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': 16,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers':
          'Origin, X-Requested-With, Content-Type, Accept, Authorization'
      })
      expect(mockResponse.write).toHaveBeenCalledWith(
        JSON.stringify({ message: 'ok' })
      )
      expect(mockResponse.end).toHaveBeenCalled()
    })
  })

  describe('jsonContent', () => {
    it('should parse JSON content and call the callback', (done) => {
      const req = {
        headers: { 'content-type': 'application/json' },
        on: (event: string, callback: any) => {
          if (event === 'data') {
            callback(JSON.stringify({ key: 'value' }))
          }
          if (event === 'end') {
            callback()
          }
        }
      } as unknown as Request

      jsonContent(
        req,
        mockResponse as Response,
        mockLogger,
        (obj: Record<string, string>) => {
          expect(obj).toEqual({ key: 'value' })
          done()
        }
      )
    })

    it('should handle form-urlencoded content', (done) => {
      const req = {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        on: (event: string, callback: any) => {
          if (event === 'data') {
            callback(querystring.stringify({ key: 'value' }))
          }
          if (event === 'end') {
            callback()
          }
        }
      } as unknown as Request

      jsonContent(
        req,
        mockResponse as Response,
        mockLogger,
        (obj: Record<string, string>) => {
          expect(obj).toEqual({ key: 'value' })
          done()
        }
      )
    })

    it('should handle JSON parsing errors', (done) => {
      const req = {
        headers: { 'content-type': 'application/json' },
        on: (event: string, callback: any) => {
          if (event === 'data') {
            callback('invalid json')
          }
          if (event === 'end') {
            callback()
          }
        }
      } as unknown as Request

      jsonContent(req, mockResponse as Response, mockLogger, () => {
        // No-op
      })

      setImmediate(() => {
        expect(mockLogger.error).toHaveBeenCalled()
        expect(mockResponse.writeHead).toHaveBeenCalledWith(
          400,
          expect.any(Object)
        )
        expect(mockResponse.write).toHaveBeenCalled()
        expect(mockResponse.end).toHaveBeenCalled()
        done()
      })
    })
  })

  describe('validateParameters', () => {
    it('should validate required parameters', () => {
      const desc = { key: true, optional: false }
      const content = { key: 'value' }

      validateParameters(
        mockResponse as Response,
        desc,
        content,
        mockLogger,
        (obj) => {
          expect(obj).toEqual(content)
        }
      )

      expect(mockResponse.writeHead).not.toHaveBeenCalled()
    })

    it('should return an error for missing parameters', () => {
      const desc = { key: true, missing: true }
      const content = { key: 'value' }

      validateParameters(
        mockResponse as Response,
        desc,
        content,
        mockLogger,
        () => {
          // No-op
        }
      )

      expect(mockResponse.writeHead).toHaveBeenCalledWith(
        400,
        expect.any(Object)
      )
      expect(mockResponse.write).toHaveBeenCalled()
      expect(mockResponse.end).toHaveBeenCalled()
    })
  })

  describe('epoch', () => {
    it('should return the current timestamp', () => {
      const now = Date.now()
      jest.spyOn(Date, 'now').mockReturnValue(now)

      expect(epoch()).toBe(now)
    })
  })

  describe('toMatrixId', () => {
    it('should return a Matrix ID', () => {
      expect(toMatrixId('localpart', 'server')).toBe('@localpart:server')
    })
    it('should throw an error for an invalid localpart', () => {
      expect(() => toMatrixId('invalid localpart', 'example.com')).toThrow(
        'Invalid localpart'
      )
    })
  })
})
