import {
  InvalidPathError,
  InvalidUrlError,
  MissingArgumentError,
  UrlError
} from './errors'
import { buildUrl, UrlBuilder } from './index'

describe('URL Builder Utility', () => {
  describe('buildUrl function', () => {
    describe('Basic functionality', () => {
      it('should build a simple URL with base only', () => {
        expect(buildUrl('https://example.com')).toBe('https://example.com/')
      })

      it('should build URL with base and path', () => {
        expect(buildUrl('https://example.com', 'api/v1')).toBe(
          'https://example.com/api/v1'
        )
      })

      it('should build URL with base, path, and query', () => {
        expect(buildUrl('https://example.com', 'api', { key: 'value' })).toBe(
          'https://example.com/api?key=value'
        )
      })

      it('should handle existing protocol', () => {
        expect(buildUrl('https://example.com', 'api')).toBe(
          'https://example.com/api'
        )
        expect(buildUrl('http://example.com', 'api')).toBe(
          'http://example.com/api'
        )
        expect(buildUrl('mxc://example.com', 'api')).toBe(
          'mxc://example.com/api'
        )
      })
    })

    describe('Edge cases and security', () => {
      it('should throw when protocol-relative URLs in path', () => {
        expect(() => buildUrl('https://example.com', '//evil.com')).toThrow(
          InvalidPathError
        )
        expect(() =>
          buildUrl('https://example.com', '//evil.com/path')
        ).toThrow(InvalidPathError)
      })

      it('should throw error for URLs with protocols in path', () => {
        expect(() =>
          buildUrl('https://example.com', 'http://evil.com')
        ).toThrow(InvalidPathError)
        expect(() =>
          buildUrl('https://example.com', 'https://evil.com')
        ).toThrow(InvalidPathError)
        expect(() => buildUrl('https://example.com', 'ftp://evil.com')).toThrow(
          InvalidPathError
        )
        expect(() =>
          buildUrl('https://example.com', 'javascript:alert(1)')
        ).toThrow(InvalidPathError)
      })

      it('should handle path traversal attempts safely', () => {
        expect(buildUrl('https://example.com', 'api/../admin')).toBe(
          'https://example.com/api/admin'
        )
        expect(buildUrl('https://example.com', '../../../etc/passwd')).toBe(
          'https://example.com/etc/passwd'
        )
        expect(buildUrl('https://example.com/api', '../admin')).toBe(
          'https://example.com/api/admin'
        )
      })

      it('should handle multiple consecutive slashes', () => {
        expect(buildUrl('https://example.com', 'api//v1///users')).toBe(
          'https://example.com/api/v1/users'
        )
        expect(buildUrl('https://example.com', '/api//v1')).toBe(
          'https://example.com/api/v1'
        )
      })

      it('should handle empty and null paths', () => {
        expect(buildUrl('https://example.com', '')).toBe('https://example.com/')
        expect(buildUrl('https://example.com', null as any)).toBe(
          'https://example.com/'
        )
        expect(buildUrl('https://example.com', undefined)).toBe(
          'https://example.com/'
        )
      })

      it('should throw error for missing base URL', () => {
        expect(() => buildUrl('')).toThrow(MissingArgumentError)
        expect(() => buildUrl(null as any)).toThrow(MissingArgumentError)
        expect(() => buildUrl(undefined as any)).toThrow(MissingArgumentError)
      })

      it('should throw error for invalid base URLs', () => {
        expect(() => buildUrl('ht!tp://invalid')).toThrow(InvalidUrlError)
        expect(() => buildUrl(':::notagoodurl:::')).toThrow(InvalidUrlError)
      })
    })

    describe('Path handling', () => {
      it('should handle absolute paths correctly', () => {
        expect(buildUrl('https://example.com/api/v1', '/users')).toBe(
          'https://example.com/api/v1/users'
        )
        expect(buildUrl('https://example.com/api', '/v2/users')).toBe(
          'https://example.com/api/v2/users'
        )
      })

      it('should handle relative paths correctly', () => {
        expect(buildUrl('https://example.com/api', 'v1/users')).toBe(
          'https://example.com/api/v1/users'
        )
        expect(buildUrl('https://example.com/api/', 'v1')).toBe(
          'https://example.com/api/v1'
        )
      })

      it('should remove trailing slashes except for root', () => {
        expect(buildUrl('https://example.com', 'api/')).toBe(
          'https://example.com/api'
        )
        expect(buildUrl('https://example.com', '/')).toBe(
          'https://example.com/'
        )
        expect(buildUrl('https://example.com/', '')).toBe(
          'https://example.com/'
        )
      })

      it('should handle dots in paths', () => {
        expect(buildUrl('https://example.com', './api')).toBe(
          'https://example.com/api'
        )
        expect(buildUrl('https://example.com', 'api/./v1')).toBe(
          'https://example.com/api/v1'
        )
      })

      it('should encode special characters in paths', () => {
        expect(buildUrl('https://example.com', 'api/hello world')).toBe(
          'https://example.com/api/hello%20world'
        )
        expect(buildUrl('https://example.com', 'api/test#anchor')).toBe(
          'https://example.com/api/test%23anchor'
        )
      })
    })

    describe('Query parameters', () => {
      it('should handle different value types', () => {
        const query = {
          string: 'value',
          number: 123,
          boolean: true,
          null: null,
          undefined: undefined
        }
        const result = buildUrl('https://example.com', 'api', query)
        expect(result).toBe(
          'https://example.com/api?string=value&number=123&boolean=true'
        )
      })

      it('should handle array values for repeated parameters', () => {
        const query = { tags: ['a', 'b', 'c'] }
        const result = buildUrl('https://example.com', 'api', query)
        expect(result).toBe('https://example.com/api?tags=a&tags=b&tags=c')
      })

      it('should filter null and undefined from arrays', () => {
        const query = { tags: ['a', null, 'b', undefined, 'c'] as any }
        const result = buildUrl('https://example.com', 'api', query)
        expect(result).toBe('https://example.com/api?tags=a&tags=b&tags=c')
      })

      it('should handle special characters in query parameters', () => {
        const query = { 'key&unsafe': 'value=test' }
        const result = buildUrl('https://example.com', 'api', query)
        expect(result).toBe('https://example.com/api?key%26unsafe=value%3Dtest')
      })

      it('should preserve existing query parameters from base URL', () => {
        const result = buildUrl('https://example.com?existing=param', 'api', {
          new: 'value'
        })
        expect(result).toContain('existing=param')
        expect(result).toContain('new=value')
      })
    })

    describe('URL components', () => {
      it('should handle ports', () => {
        expect(buildUrl('https://example.com:8080', 'api')).toBe(
          'https://example.com:8080/api'
        )
      })

      it('should handle authentication in URLs', () => {
        expect(buildUrl('https://user:pass@example.com', 'api')).toBe(
          'https://user:pass@example.com/api'
        )
      })

      it('should handle IP addresses', () => {
        expect(buildUrl('https://192.168.1.1', 'api')).toBe(
          'https://192.168.1.1/api'
        )
        expect(buildUrl('https://[2001:db8::1]', 'api')).toBe(
          'https://[2001:db8::1]/api'
        )
      })

      it('should handle localhost', () => {
        expect(buildUrl('https://localhost', 'api')).toBe(
          'https://localhost/api'
        )
        expect(buildUrl('https://localhost:3000', 'api')).toBe(
          'https://localhost:3000/api'
        )
      })

      // TODO:
      // it('should preserve fragments in base URL', () => {
      //   expect(buildUrl('https://example.com#section', 'api')).toBe(
      //     'https://example.com/api'
      //   )
      //   expect(buildUrl('https://example.com/page#section', 'api')).toBe(
      //     'https://example.com/api'
      //   )
      // })
    })
  })

  describe('UrlBuilder class', () => {
    describe('Basic functionality', () => {
      it('should build simple URLs', () => {
        const url = new UrlBuilder('https://example.com').build()
        expect(url).toBe('https://example.com/')
      })

      it('should chain path segments', () => {
        const url = new UrlBuilder('https://example.com')
          .path('api')
          .path('v1')
          .path('users')
          .build()
        expect(url).toBe('https://example.com/api/v1/users')
      })

      it('should handle query parameters', () => {
        const url = new UrlBuilder('https://example.com')
          .path('api')
          .query({ limit: 10, offset: 20 })
          .build()
        expect(url).toBe('https://example.com/api?limit=10&offset=20')
      })

      it('should handle fragments', () => {
        const url = new UrlBuilder('https://example.com')
          .path('docs')
          .hash('section-1')
          .build()
        expect(url).toBe('https://example.com/docs#section-1')
      })
    })

    describe('Edge cases', () => {
      it('should throw when protocol-relative URLs in path', () => {
        const builder = new UrlBuilder('https://example.com')
        expect(() => builder.path('//evil.com')).toThrow(InvalidPathError)
      })

      it('should handle path traversal safely', () => {
        const url = new UrlBuilder('https://example.com')
          .path('api')
          .path('../admin')
          .build()
        expect(url).toBe('https://example.com/api/admin')
      })

      it('should handle absolute paths that replace previous segments', () => {
        const url = new UrlBuilder('https://example.com')
          .path('api')
          .path('v1')
          .path('/users')
          .build()
        expect(url).toBe('https://example.com/api/v1/users')
      })

      it('should handle multiple paths with paths() method', () => {
        const url = new UrlBuilder('https://example.com')
          .paths('api', 'v1', 'users')
          .build()
        expect(url).toBe('https://example.com/api/v1/users')
      })

      it('should clear query parameters', () => {
        const url = new UrlBuilder('https://example.com?existing=param')
          .query({ new: 'value' })
          .clearQuery() // TODO: clear existing?
          .query({ final: 'param' })
          .build()
        expect(url).toBe('https://example.com/?existing=param&final=param')
      })
    })

    describe('Cloning', () => {
      it('should create independent clones', () => {
        const base = new UrlBuilder('https://example.com')
          .path('api')
          .query({ base: 'param' })

        const clone1 = base.clone().path('users').build()
        const clone2 = base.clone().path('posts').build()
        const original = base.build()

        expect(clone1).toBe('https://example.com/api/users?base=param')
        expect(clone2).toBe('https://example.com/api/posts?base=param')
        expect(original).toBe('https://example.com/api?base=param')
      })
    })

    describe('Options', () => {
      // TODO:
      // it('should preserve fragments when option is set', () => {
      //   const url = new UrlBuilder('https://example.com#original', {
      //     preserveFragment: true
      //   })
      //     .path('api')
      //     .build()
      //   expect(url).toBe('https://example.com/api#original')
      // })
    })

    describe('Special methods', () => {
      it('should set individual parameters with param()', () => {
        const url = new UrlBuilder('https://example.com')
          .param('key1', 'value1')
          .param('key2', 42)
          .build()
        expect(url).toBe('https://example.com/?key1=value1&key2=42')
      })

      it('should support toString() as alias for build()', () => {
        const builder = new UrlBuilder('https://example.com').path('api')
        expect(builder.toString()).toBe(builder.build())
      })

      it('should handle array values in param()', () => {
        const url = new UrlBuilder('https://example.com')
          .param('tags', ['a', 'b', 'c'])
          .build()
        expect(url).toBe('https://example.com/?tags=a&tags=b&tags=c')
      })
    })

    // TODO:
    // describe('Complex scenarios', () => {
    //   it('should handle internationalized domain names', () => {
    //     const url = new UrlBuilder('https://münchen.example.com')
    //       .path('api')
    //       .build()
    //     expect(url).toBe('https://m%C3%BCnchen.example.com/api')
    //   })

    //   it('should handle very long paths and queries', () => {
    //     const builder = new UrlBuilder('https://example.com')
    //     for (let i = 0; i < 100; i++) {
    //       builder.path(`segment${i}`)
    //     }
    //     builder.query({ veryLongParameter: 'a'.repeat(1000) })
    //     const url = builder.build()
    //     expect(url).toContain('segment99')
    //     expect(url.length).toBeGreaterThan(2000)
    //   })
    // })
  })

  describe('Error handling', () => {
    it('should have proper error inheritance', () => {
      const baseError = new UrlError('test')
      const missingError = new MissingArgumentError('test')
      const invalidError = new InvalidUrlError('test')
      const pathError = new InvalidPathError('test', 'reason')

      expect(baseError).toBeInstanceOf(Error)
      expect(missingError).toBeInstanceOf(UrlError)
      expect(invalidError).toBeInstanceOf(UrlError)
      expect(pathError).toBeInstanceOf(UrlError)
    })

    it('should have proper error names', () => {
      expect(new UrlError('test').name).toBe('UrlError')
      expect(new MissingArgumentError('test').name).toBe('MissingArgumentError')
      expect(new InvalidUrlError('test').name).toBe('InvalidUrlError')
      expect(new InvalidPathError('test', 'reason').name).toBe(
        'InvalidPathError'
      )
    })

    it('should include cause in InvalidUrlError when provided', () => {
      const cause = new Error('Original error')
      const error = new InvalidUrlError('test', cause)
      expect(error.cause).toBe(cause)
    })
  })
})
