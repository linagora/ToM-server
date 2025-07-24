import { type Request, type Response } from 'express'
import type http from 'http'
import querystring from 'querystring'
import {
  send,
  jsonContent,
  validateParameters,
  epoch,
  toMatrixId,
  isValidUrl
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
        body: { key: 'value' },
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
            callback(querystring.encode({ key: 'value' }))
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

    it('should handle JSON parsing errors', () => {
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

      jsonContent(req, mockResponse as Response, mockLogger, () => {})

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockResponse.writeHead).toHaveBeenCalledWith(
        400,
        expect.any(Object)
      )
      expect(mockResponse.write).toHaveBeenCalled()
      expect(mockResponse.end).toHaveBeenCalled()
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
    it('should return a Matrix ID for valid inputs', () => {
      expect(toMatrixId('localpart', 'server')).toBe('@localpart:server')
      expect(toMatrixId('user.name-123', 'example.com')).toBe(
        '@user.name-123:example.com'
      )
      expect(toMatrixId('user/id+test', 'matrix.org:8080')).toBe(
        '@user/id+test:matrix.org:8080'
      )
      expect(toMatrixId('alice', '192.168.1.1')).toBe('@alice:192.168.1.1')
      expect(toMatrixId('localpart', '192.168.1')).toBe('@localpart:192.168.1') // Incomplete IPv4 but DNS-NAME valid
      expect(toMatrixId('bob', '[2001:0db8::1]')).toBe('@bob:[2001:0db8::1]')
      expect(
        toMatrixId('charlie', '[FE80:0000:0000:0000:0202:B3FF:FE1E:8329]:443')
      ).toBe('@charlie:[FE80:0000:0000:0000:0202:B3FF:FE1E:8329]:443')
    })

    it('should throw TypeError if localpart is not a string', () => {
      // @ts-expect-error Testing invalid input type
      expect(() => toMatrixId(123, 'example.com')).toThrow(TypeError)
      // @ts-expect-error Testing invalid input type
      expect(() => toMatrixId(null, 'example.com')).toThrow(TypeError)
      // @ts-expect-error Testing invalid input type
      expect(() => toMatrixId(undefined, 'example.com')).toThrow(TypeError)
    })

    it('should throw TypeError if localpart is an empty string', () => {
      expect(() => toMatrixId('', 'example.com')).toThrow(TypeError)
    })

    it('should throw errMsg for an invalid localpart format', () => {
      // Assuming errMsg is a function that throws an error with a specific message
      // If errMsg throws a generic Error, you might need to adjust the expectation.
      expect(() =>
        toMatrixId('invalid localpart!', 'example.com')
      ).toThrowError()
      expect(() => toMatrixId('user@name', 'example.com')).toThrowError()
      expect(() => toMatrixId('user space', 'example.com')).toThrowError()
    })

    it('should throw TypeError if serverName is not a string', () => {
      // @ts-expect-error Testing invalid input type
      expect(() => toMatrixId('localpart', 123)).toThrow(TypeError)
      // @ts-expect-error Testing invalid input type
      expect(() => toMatrixId('localpart', null)).toThrow(TypeError)
      // @ts-expect-error Testing invalid input type
      expect(() => toMatrixId('localpart', undefined)).toThrow(TypeError)
    })

    it('should throw TypeError if serverName is an empty string', () => {
      expect(() => toMatrixId('localpart', '')).toThrow(TypeError)
    })

    it('should throw TypeError for an invalid serverName format', () => {
      expect(() => toMatrixId('localpart', 'invalid server')).toThrow(TypeError)
      expect(() => toMatrixId('localpart', 'example.com:port')).toThrow(
        TypeError
      ) // Invalid port
      expect(() => toMatrixId('localpart', 'example.com:')).toThrow(TypeError) // Missing port
      expect(() => toMatrixId('localpart', '[2001:db8::invalid]')).toThrow(
        TypeError
      ) // Invalid IPv6
      expect(() => toMatrixId('localpart', 'example..com')).toThrow(TypeError) // Invalid DNS name
    })
  })
  describe('isValidUrl', () => {
    it('should return false for a non-string input', () => {
      // @ts-expect-error Testing non-string input
      expect(isValidUrl(12345)).toBe(false)
      // @ts-expect-error Testing non-string input
      expect(isValidUrl(null)).toBe(false)
      // @ts-expect-error Testing non-string input
      expect(isValidUrl(undefined)).toBe(false)
    })
    it('should return false for an empty string', () => {
      expect(isValidUrl('')).toBe(false)
    })
    it('should return false for an invalid URL with invalid characters', () => {
      expect(isValidUrl('https://exam ple.com')).toBe(false)
    })
    it('should return true for a valid URL with query parameters', () => {
      expect(isValidUrl('https://example.com/path?name=value')).toBe(true)
    })

    it('should return true for a valid URL with a port number', () => {
      expect(isValidUrl('https://example.com:8080')).toBe(true)
    })

    it('should return false for an invalid URL missing scheme', () => {
      expect(isValidUrl('example.com')).toBe(false)
    })

    it('should return false for an invalid URL missing domain', () => {
      expect(isValidUrl('http://')).toBe(false)
    })
  })
})
