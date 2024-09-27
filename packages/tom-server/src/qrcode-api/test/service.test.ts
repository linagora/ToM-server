import { type TwakeLogger } from '@twake/logger'
import QRCodeService from '../services'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import QRCode from 'qrcode'
import type { Config } from '../../types'

const testSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 37 37" shape-rendering="crispEdges"><path fill="#ffffff" d="M0 0h37v37H0z"/><path stroke="#000000" d="M4 4.5h7m3 0h1m1 0h1m2 0h1m2 0h2m2 0h7M4 5.5h1m5 0h1m1 0h5m2 0h2m2 0h2m1 0h1m5 0h1M4 6.5h1m1 0h3m1 0h1m3 0h1m9 0h1m1 0h1m1 0h3m1 0h1M4 7.5h1m1 0h3m1 0h1m3 0h1m1 0h1m1 0h2m2 0h2m2 0h1m1 0h3m1 0h1M4 8.5h1m1 0h3m1 0h1m1 0h4m3 0h1m2 0h2m2 0h1m1 0h3m1 0h1M4 9.5h1m5 0h1m4 0h1m1 0h3m3 0h2m1 0h1m5 0h1M4 10.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M15 11.5h3m1 0h4m1 0h1M4 12.5h1m1 0h1m1 0h1m1 0h1m2 0h1m2 0h1m1 0h1m2 0h1m1 0h1m4 0h1m2 0h1M4 13.5h1m1 0h4m2 0h1m3 0h1m3 0h2m4 0h1m2 0h1m2 0h1M4 14.5h2m2 0h1m1 0h2m1 0h3m1 0h1m8 0h3m1 0h3M4 15.5h2m2 0h1m5 0h1m4 0h4m1 0h2m2 0h1m2 0h1M5 16.5h1m1 0h1m1 0h2m1 0h1m1 0h1m4 0h1m1 0h1m1 0h4m2 0h1m1 0h2M11 17.5h1m3 0h3m3 0h2m2 0h2m2 0h1m2 0h1M4 18.5h2m2 0h9m1 0h1m1 0h3m2 0h1m1 0h3m1 0h2M5 19.5h3m5 0h1m1 0h1m1 0h2m1 0h6m1 0h1m1 0h1m1 0h1M4 20.5h3m1 0h3m1 0h1m2 0h1m2 0h4m1 0h4m2 0h1m1 0h2M6 21.5h3m2 0h1m1 0h4m1 0h1m1 0h3m1 0h3m2 0h2m1 0h1M4 22.5h1m1 0h2m1 0h3m1 0h1m1 0h3m3 0h2m2 0h2m1 0h1m2 0h2M5 23.5h4m2 0h5m3 0h4m1 0h1m2 0h3m1 0h1M4 24.5h1m1 0h1m1 0h4m1 0h2m5 0h1m2 0h6M12 25.5h1m2 0h3m2 0h1m1 0h3m3 0h1m1 0h3M4 26.5h7m2 0h1m2 0h1m1 0h1m2 0h1m1 0h2m1 0h1m1 0h2m1 0h2M4 27.5h1m5 0h1m3 0h2m1 0h2m2 0h2m1 0h1m3 0h2m1 0h2M4 28.5h1m1 0h3m1 0h1m1 0h2m1 0h1m2 0h4m2 0h5m2 0h2M4 29.5h1m1 0h3m1 0h1m5 0h1m1 0h1m1 0h3m1 0h2m2 0h1m1 0h3M4 30.5h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m5 0h1m2 0h3m2 0h1M4 31.5h1m5 0h1m2 0h3m1 0h2m1 0h2m1 0h2m1 0h1m4 0h1M4 32.5h7m1 0h2m1 0h1m1 0h1m1 0h3m1 0h2m2 0h2m2 0h2"/></svg>
`

afterEach(() => {
  jest.restoreAllMocks()
})

describe('the QRCode service', () => {
  const loggerMock = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }

  const configMock = {
    qr_code_url: 'https://example.com/'
  } as unknown as Config

  const qrCodeService = new QRCodeService(
    loggerMock as unknown as TwakeLogger,
    configMock
  )

  it('should generate a QRCode', async () => {
    const result = await qrCodeService.get('test')

    expect(result).not.toBeNull()

    const resultBuffer = Buffer.from(result as string)
    const testSvgBuffer = Buffer.from(testSvg)

    expect(resultBuffer).toEqual(testSvgBuffer)
  })

  it('should return null if something wrong happens', async () => {
    jest.spyOn(QRCode, 'toString').mockImplementation(() => {
      throw new Error('test')
    })

    const result = await qrCodeService.get('test')

    expect(result).toBeNull()
  })

  it('should return null if qrcode_url config is not set', async () => {
    const failingQrCodeService = new QRCodeService(
      loggerMock as unknown as TwakeLogger,
      {} as unknown as Config
    )

    const result = await failingQrCodeService.get('test')

    expect(result).toBeNull()
  })
})
