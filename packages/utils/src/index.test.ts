import { type Request, type Response } from 'express'
import type http from 'http'
import querystring from 'querystring'
import {
  send,
  jsonContent,
  validateParameters,
  validateParametersAndValues,
  getAccessToken,
  epoch,
  toMatrixId,
  isMatrixId,
  isValidUrl
} from './index'
import { type TwakeLogger } from '@twake/logger'

// Test helper functions
const expectErrorResponse = (
  mockResponse: Partial<Response>,
  statusCode: number = 400
): void => {
  expect(mockResponse.writeHead).toHaveBeenCalledWith(
    statusCode,
    expect.any(Object)
  )
  expect(mockResponse.write).toHaveBeenCalled()
  expect(mockResponse.end).toHaveBeenCalled()
}

const expectNoResponse = (mockResponse: Partial<Response>): void => {
  expect(mockResponse.writeHead).not.toHaveBeenCalled()
}

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
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
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

    it('should log the response status with info if status code in 200-299', () => {
      send(mockResponse as Response, 200, { message: 'ok' }, mockLogger)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Sending status 200 with content {"message":"ok"}'
      )
    })

    it('should log the response status with error if status code not in 200-299', () => {
      send(mockResponse as Response, 400, { message: 'error' }, mockLogger)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Sending status 400 with content {"message":"error"}'
      )
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
            // eslint-disable-next-line n/no-callback-literal
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

      expectNoResponse(mockResponse)
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

      expectErrorResponse(mockResponse)
    })

    it('should log a warning for additional parameters', () => {
      const desc = { key: true }
      const content = { key: 'value', extra: 'extra' }

      validateParameters(
        mockResponse as Response,
        desc,
        content,
        mockLogger,
        () => {
          // No-op
        }
      )

      expect(mockLogger.warn).toHaveBeenCalled()
      expectNoResponse(mockResponse)
    })
  })

  describe('validateParametersAndValues', () => {
    it('should validate required parameters and values', () => {
      const desc = { key: true }
      const content = { key: 'value' }
      const valuechecks = { key: (value: string) => value === 'value' }

      validateParametersAndValues(
        mockResponse as Response,
        desc,
        valuechecks,
        content,
        mockLogger,
        (obj) => {
          expect(obj).toEqual(content)
        }
      )

      expectNoResponse(mockResponse)
    })
    it('should return an error for missing parameters', () => {
      const desc = { key: true, missing: true }
      const content = { key: 'value' }
      const valuechecks = { key: (value: string) => value === 'value' }

      validateParametersAndValues(
        mockResponse as Response,
        desc,
        valuechecks,
        content,
        mockLogger,
        () => {
          // No-op
        }
      )

      expectErrorResponse(mockResponse)
    })
    it('should return an error for invalid values', () => {
      const desc = { key: true }
      const content = { key: 'invalid' }
      const valuechecks = { key: (value: string) => value === 'value' }

      validateParametersAndValues(
        mockResponse as Response,
        desc,
        valuechecks,
        content,
        mockLogger,
        () => {
          // No-op
        }
      )

      expectErrorResponse(mockResponse)
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

    it('should enforce 255 character limit for Matrix IDs', () => {
      // Create a localpart that would result in a Matrix ID exceeding 255 characters
      const longLocalpart = 'a'.repeat(250)
      expect(() => toMatrixId(longLocalpart, 'example.com')).toThrow(TypeError)
    })

    it('should validate port numbers correctly', () => {
      // Valid ports
      expect(toMatrixId('user', 'example.com:1')).toBe('@user:example.com:1')
      expect(toMatrixId('user', 'example.com:8448')).toBe(
        '@user:example.com:8448'
      )
      expect(toMatrixId('user', 'example.com:65535')).toBe(
        '@user:example.com:65535'
      )

      // Invalid ports
      expect(() => toMatrixId('user', 'example.com:0')).toThrow(TypeError) // Port 0 invalid
      expect(() => toMatrixId('user', 'example.com:65536')).toThrow(TypeError) // Port too high
      expect(() => toMatrixId('user', 'example.com:99999')).toThrow(TypeError) // Port too high
    })
  })

  describe('isMatrixId', () => {
    describe('valid Matrix IDs', () => {
      it('should return true for valid Matrix IDs with DNS names', () => {
        expect(isMatrixId('@alice:matrix.org')).toBe(true)
        expect(isMatrixId('@bob:example.com')).toBe(true)
        expect(isMatrixId('@user:sub.domain.example.com')).toBe(true)
        expect(isMatrixId('@test123:matrix-server.org')).toBe(true)
      })

      it('should return true for valid Matrix IDs with ports', () => {
        expect(isMatrixId('@user:matrix.org:8448')).toBe(true)
        expect(isMatrixId('@alice:example.com:443')).toBe(true)
        expect(isMatrixId('@bob:localhost:8008')).toBe(true)
      })

      it('should return true for valid Matrix IDs with IPv4 addresses', () => {
        expect(isMatrixId('@user:192.168.1.1')).toBe(true)
        expect(isMatrixId('@alice:10.0.0.1:8448')).toBe(true)
        expect(isMatrixId('@test:127.0.0.1')).toBe(true)
        expect(isMatrixId('@user:255.255.255.255')).toBe(true)
      })

      it('should return true for valid Matrix IDs with IPv6 addresses', () => {
        expect(isMatrixId('@user:[::1]')).toBe(true)
        expect(isMatrixId('@alice:[2001:db8::1]')).toBe(true)
        expect(isMatrixId('@bob:[fe80::1]')).toBe(true)
        expect(isMatrixId('@test:[2001:db8::1]:8448')).toBe(true)
        expect(isMatrixId('@user:[::ffff:192.0.2.1]')).toBe(true) // IPv4-mapped IPv6
      })

      it('should return true for Matrix IDs with special characters in localpart', () => {
        expect(isMatrixId('@user.name:matrix.org')).toBe(true)
        expect(isMatrixId('@user-name:matrix.org')).toBe(true)
        expect(isMatrixId('@user_name:matrix.org')).toBe(true)
        expect(isMatrixId('@user=name:matrix.org')).toBe(true)
        expect(isMatrixId('@user/name:matrix.org')).toBe(true)
        expect(isMatrixId('@user+name:matrix.org')).toBe(true)
        expect(
          isMatrixId('@test.user-123_name=value/path+extra:example.com')
        ).toBe(true)
      })
    })

    describe('invalid Matrix IDs', () => {
      it('should return false for non-string inputs', () => {
        // @ts-expect-error Testing invalid input type
        expect(isMatrixId(123)).toBe(false)
        // @ts-expect-error Testing invalid input type
        expect(isMatrixId(null)).toBe(false)
        // @ts-expect-error Testing invalid input type
        expect(isMatrixId(undefined)).toBe(false)
        // @ts-expect-error Testing invalid input type
        expect(isMatrixId({})).toBe(false)
      })

      it('should return false for strings missing @ sigil', () => {
        expect(isMatrixId('alice:matrix.org')).toBe(false)
        expect(isMatrixId('user:example.com')).toBe(false)
        expect(isMatrixId(':matrix.org')).toBe(false)
      })

      it('should return false for Matrix IDs without server name', () => {
        expect(isMatrixId('@alice')).toBe(false)
        expect(isMatrixId('@user:')).toBe(false)
        expect(isMatrixId('@')).toBe(false)
        expect(isMatrixId('@:')).toBe(false)
      })

      it('should return false for Matrix IDs without localpart', () => {
        expect(isMatrixId('@:matrix.org')).toBe(false)
        expect(isMatrixId('@:example.com:8448')).toBe(false)
      })

      it('should return false for invalid localpart characters', () => {
        expect(isMatrixId('@User Name:matrix.org')).toBe(false) // Space
        expect(isMatrixId('@UPPERCASE:matrix.org')).toBe(false) // Uppercase
        expect(isMatrixId('@user@name:matrix.org')).toBe(false) // @ symbol
        expect(isMatrixId('@user#name:matrix.org')).toBe(false) // # symbol
        expect(isMatrixId('@user!:matrix.org')).toBe(false) // ! symbol
        expect(isMatrixId('@user*:matrix.org')).toBe(false) // * symbol
      })

      it('should return false for invalid server names', () => {
        expect(isMatrixId('@user:invalid..domain')).toBe(false) // Consecutive dots
        expect(isMatrixId('@user:example.com:')).toBe(false) // Trailing colon
        expect(isMatrixId('@user:example.com:port')).toBe(false) // Non-numeric port
        expect(isMatrixId('@user:example.com:0')).toBe(false) // Invalid port 0
        expect(isMatrixId('@user:example.com:99999')).toBe(false) // Port too high
        expect(isMatrixId('@user:example com')).toBe(false) // Space in server name
        expect(isMatrixId('@user:-example.com')).toBe(false) // Starts with hyphen
      })

      it('should return false for invalid IPv4 addresses', () => {
        expect(isMatrixId('@user:256.1.1.1')).toBe(false) // Octet > 255
        expect(isMatrixId('@user:999.999.999.999')).toBe(false) // All octets invalid
        expect(isMatrixId('@user:192.168.256.1')).toBe(false) // Third octet > 255
        // Note: '192.168.1' is treated as a valid DNS name (3 labels)
        // Note: '192.168.1.1.1' is also a valid DNS name (5 labels with numeric parts)
      })

      it('should return false for invalid IPv6 addresses', () => {
        expect(isMatrixId('@user:[::1')).toBe(false) // Missing closing bracket
        expect(isMatrixId('@user:::1]')).toBe(false) // Missing opening bracket
        expect(isMatrixId('@user:[invalid]')).toBe(false) // Invalid IPv6
        expect(isMatrixId('@user:[gggg::1]')).toBe(false) // Invalid hex
      })

      it('should return false for Matrix IDs exceeding 255 characters', () => {
        const longId = '@' + 'a'.repeat(250) + ':example.com'
        expect(longId.length).toBeGreaterThan(255)
        expect(isMatrixId(longId)).toBe(false)
      })

      it('should return false for empty string', () => {
        expect(isMatrixId('')).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should handle Matrix IDs at 255 character limit', () => {
        // Create a Matrix ID exactly at the limit
        // @user:example.com has 1(@) + localpart + 1(:) + 11(example.com) = 13 + localpart
        // So we need localpart of 242 characters to get exactly 255
        const localpart = 'a'.repeat(242)
        const matrixId = `@${localpart}:example.com`
        expect(matrixId.length).toBe(255)
        expect(isMatrixId(matrixId)).toBe(true)
      })

      it('should handle single character localparts', () => {
        expect(isMatrixId('@a:matrix.org')).toBe(true)
        expect(isMatrixId('@1:matrix.org')).toBe(true)
      })

      it('should handle minimum valid server names', () => {
        expect(isMatrixId('@user:a')).toBe(true)
        expect(isMatrixId('@user:a.b')).toBe(true)
      })

      it('should correctly parse server names with multiple colons (IPv6 with port)', () => {
        expect(isMatrixId('@user:[2001:db8::1]:8448')).toBe(true)
        expect(isMatrixId('@user:[::1]:443')).toBe(true)
      })
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

    it('should throw an error for a localpart longer than 512 characters', () => {
      const longLocalpart = 'a'.repeat(513)
      expect(() => toMatrixId(longLocalpart, 'example.com')).toThrowError()
    })
  })
  describe('getAccessToken', () => {
    it('should return the access token from the Authorization header', () => {
      const req = {
        headers: {
          authorization: 'Bearer some-token'
        },
        query: {}
      } as unknown as Request

      const token = getAccessToken(req)
      expect(token).toBe('some-token')
    })

    it('should return null if there is no authorization header', () => {
      const req = {
        headers: {},
        query: {}
      } as unknown as Request

      const token = getAccessToken(req)
      expect(token).toBeNull()
    })

    it('should return the access token from the query parameters', () => {
      const req = {
        headers: {},
        query: {
          access_token: 'some-token'
        }
      } as unknown as Request

      const token = getAccessToken(req)
      expect(token).toBe('some-token')
    })

    it('should return null if there is no token in headers or query', () => {
      const req = {
        headers: {},
        query: {}
      } as unknown as Request

      const token = getAccessToken(req)
      expect(token).toBeNull()
    })
  })
})
