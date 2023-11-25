import fetch from 'node-fetch'
import { resolve as dnsResolve, lookup } from 'node:dns'
import resolve from './index'
import { type WellKnownMatrixServer } from './index'

type DnsResolve = (
  name: string,
  type: string,
  callback: (
    err: null | Error,
    records: null | Record<string, string | number>
  ) => void
) => void

describe('resolve', () => {
  afterEach(() => jest.clearAllMocks())

  it('should accept ip with port', async () => {
    expect(await resolve('1.2.3.4:567')).toBe('https://1.2.3.4:567/')
  })

  it('should accept ip without port', async () => {
    expect(await resolve('1.2.3.4')).toBe('https://1.2.3.4:8448/')
  })

  it('should accept a hostname with port', async () => {
    expect(await resolve('example.com:1234')).toBe('https://example.com:1234/')
  })

  it('should reject non fqdn names without port', (done) => {
    resolve('{}')
      .then((m) => {
        done(`Receive ${m} instead of error`)
      })
      .catch((e) => {
        expect(e instanceof Error)
        done()
      })
  })

  it('should reject non fqdn names with port', (done) => {
    resolve('{}:234')
      .then((m) => {
        done(`Receive ${m} instead of error`)
      })
      .catch((e) => {
        expect(e instanceof Error)
        done()
      })
  })

  describe('when hostname has no port', () => {
    describe('when .well-knwon/matrix/server#m.server is available', () => {
      it('should accept IP address with port', async () => {
        const wellKnown: WellKnownMatrixServer = {
          'm.server': '1.2.3.5:678'
        }
        ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
          json: jest.fn().mockResolvedValue(wellKnown)
        })
        expect(await resolve('matrix.org')).toBe('https://1.2.3.5:678/')
      })

      it('should accept IP address without port', async () => {
        const wellKnown: WellKnownMatrixServer = {
          'm.server': '1.2.3.5'
        }
        ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
          json: jest.fn().mockResolvedValue(wellKnown)
        })
        expect(await resolve('matrix.org')).toBe('https://1.2.3.5:8448/')
      })

      it('should accept hostname with port', async () => {
        const wellKnown: WellKnownMatrixServer = {
          'm.server': 'matrix-federation.matrix.org:443'
        }
        ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
          json: jest.fn().mockResolvedValue(wellKnown)
        })
        expect(await resolve('matrix.org')).toBe(
          'https://matrix-federation.matrix.org:443/'
        )
      })
    })

    describe('when .well-knwon/matrix/server#m.server is not available', () => {
      beforeEach(() => {
        ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
          json: Promise.reject
        })
      })
      it('should try _matrix-fed._tcp when no .well-knwon', async () => {
        expect(await resolve('matrix.org')).toBe(
          'https://matrix-federation.matrix.org.cdn.cloudflare.net:8443/'
        )
      })
    })
  })
})
