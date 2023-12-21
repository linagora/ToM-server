import fetch from 'node-fetch'
import { resolve as dnsResolve, lookup } from 'node:dns'
import { matrixResolve, MatrixResolve } from './index'
import { type WellKnownMatrixServer } from './index'

type DnsResolve = (
  name: string,
  type: string,
  callback: (
    err: null | Error,
    records: null | Record<string, string | number>
  ) => void
) => void

jest.mock('node-fetch', () => jest.fn())

afterEach(() => jest.clearAllMocks())

describe('matrixResolve', () => {
  it('should accept ip with port', async () => {
    expect(await matrixResolve('1.2.3.4:567')).toBe('https://1.2.3.4:567/')
  })

  it('should accept ip without port', async () => {
    expect(await matrixResolve('1.2.3.4')).toBe('https://1.2.3.4:8448/')
  })

  it('should accept a hostname with port', async () => {
    expect(await matrixResolve('example.com:1234')).toBe(
      'https://example.com:1234/'
    )
  })

  it('should reject non fqdn names without port', (done) => {
    matrixResolve('{}')
      .then((m) => {
        done(`Receive ${m} instead of error`)
      })
      .catch((e) => {
        expect(e instanceof Error)
        done()
      })
  })

  it('should reject non fqdn names with port', (done) => {
    matrixResolve('{}:234')
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
        expect(await matrixResolve('matrix.org')).toBe('https://1.2.3.5:678/')
      })

      it('should accept IP address without port', async () => {
        const wellKnown: WellKnownMatrixServer = {
          'm.server': '1.2.3.5'
        }
        ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
          json: jest.fn().mockResolvedValue(wellKnown)
        })
        expect(await matrixResolve('matrix.org')).toBe('https://1.2.3.5:8448/')
      })

      it('should accept hostname with port', async () => {
        const wellKnown: WellKnownMatrixServer = {
          'm.server': 'matrix-federation.matrix.org:443'
        }
        ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
          json: jest.fn().mockResolvedValue(wellKnown)
        })
        expect(await matrixResolve('matrix.org')).toBe(
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
        expect(await matrixResolve('matrix.org')).toBe(
          'https://matrix-federation.matrix.org.cdn.cloudflare.net:8443/'
        )
      })

      it('should return name:8448 when SRV fields not available but host exists', async () => {
        expect(await matrixResolve('goodtech.info')).toBe(
          'https://goodtech.info:8448/'
        )
      })

      it('should fail when SRV fields not available and host does not exist', (done) => {
        matrixResolve('matrix.noexist')
          .then((res) => {
            done(`matrix.noexist should not have a value, get ${res}`)
          })
          .catch((e) => {
            expect(e instanceof Error)
            done()
          })
      })
    })
  })
})

describe('MatrixResolve', () => {
  it('should work without cache', async () => {
    const wellKnown: WellKnownMatrixServer = {
      'm.server': '1.2.3.5'
    }
    ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
      json: jest.fn().mockResolvedValue(wellKnown)
    })
    const m = new MatrixResolve()
    expect(await m.resolve('matrix.noexist')).toBe('https://1.2.3.5:8448/')
  })

  it('should work with cache', async () => {
    const wellKnown: WellKnownMatrixServer = {
      'm.server': '1.2.3.5'
    }
    ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
      json: jest.fn().mockResolvedValue(wellKnown)
    })
    const m = new MatrixResolve({
      cache: 'toad-cache'
    })
    await m.cacheReady
    expect(await m.resolve('matrix.noexist')).toBe('https://1.2.3.5:8448/')
    ;(fetch as jest.Mock<any, any, any>).mockResolvedValue({
      json: jest.fn().mockResolvedValue({})
    })
    expect(await m.resolve('matrix.noexist')).toBe('https://1.2.3.5:8448/')
  })
})
