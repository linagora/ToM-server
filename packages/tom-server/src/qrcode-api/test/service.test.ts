import { type TwakeLogger } from '@twake/logger'
import QRCodeService from '../services'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import QRCode from 'qrcode'

const testSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29" shape-rendering="crispEdges"><path fill="#ffffff" d="M0 0h29v29H0z"/><path stroke="#000000" d="M4 4.5h7m3 0h1m3 0h7M4 5.5h1m5 0h1m1 0h1m1 0h1m1 0h1m1 0h1m5 0h1M4 6.5h1m1 0h3m1 0h1m4 0h1m2 0h1m1 0h3m1 0h1M4 7.5h1m1 0h3m1 0h1m2 0h2m3 0h1m1 0h3m1 0h1M4 8.5h1m1 0h3m1 0h1m1 0h2m1 0h2m1 0h1m1 0h3m1 0h1M4 9.5h1m5 0h1m2 0h1m1 0h1m2 0h1m5 0h1M4 10.5h7m1 0h1m1 0h1m1 0h1m1 0h7M13 11.5h2M4 12.5h1m1 0h1m1 0h1m1 0h1m3 0h1m1 0h1m3 0h1m2 0h1M6 13.5h4m1 0h1m2 0h2m1 0h1m1 0h1m3 0h2M4 14.5h1m1 0h1m3 0h6m1 0h3m1 0h4M7 15.5h3m2 0h6m1 0h2m2 0h1M4 16.5h1m1 0h1m1 0h1m1 0h1m2 0h3m1 0h3m1 0h1m1 0h2M12 17.5h1m5 0h1m2 0h1m2 0h1M4 18.5h7m2 0h1m2 0h1m3 0h2m1 0h2M4 19.5h1m5 0h1m3 0h1m3 0h1m4 0h1M4 20.5h1m1 0h3m1 0h1m1 0h3m1 0h1m1 0h1m1 0h2m1 0h2M4 21.5h1m1 0h3m1 0h1m3 0h2m1 0h1m1 0h1m3 0h1M4 22.5h1m1 0h3m1 0h1m1 0h4m1 0h3m2 0h1m1 0h1M4 23.5h1m5 0h1m3 0h4m1 0h3m1 0h1M4 24.5h7m1 0h4m1 0h3m2 0h3"/></svg>
`

afterEach(() => {
  jest.restoreAllMocks()
})

describe.only('the QRCode service', () => {
  const loggerMock = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
  const qrCodeService = new QRCodeService(loggerMock as unknown as TwakeLogger)

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
})
