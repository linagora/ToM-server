import autocompletion from '../autocompletion.ts'
import { jsonContent, validateParameters } from '@twake-chat/utils'
import _search from '../_search.ts'

jest.mock('@twake-chat/utils', () => ({
  jsonContent: jest.fn((req, res, logger, callback) => callback(req.body)),
  validateParameters: jest.fn((res, schema, obj, logger, callback) =>
    callback(obj)
  )
}))

jest.mock('../_search', () => jest.fn(() => jest.fn()))

// Mock service instances
const createMockServices = () => ({
  addressbookService: {
    list: jest.fn().mockResolvedValue({ contacts: [] })
  } as any,
  userInfoService: {
    get: jest.fn().mockResolvedValue(null)
  } as any
})

describe('autocompletion handler', () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }

  const idServer = {
    authenticate: jest.fn(),
    conf: { server_name: 'server' }
  }

  const resMock = {} as any

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should call search with owner from token.sub', async () => {
    const mockSearch = jest.fn()
    ;(_search as jest.Mock).mockResolvedValue(mockSearch)

    const { addressbookService, userInfoService } = createMockServices()
    const handler = await autocompletion(
      idServer as any,
      logger as any,
      addressbookService,
      userInfoService
    )

    idServer.authenticate.mockImplementation((req, res, cb) => {
      cb({ sub: '@drwho:server' }, 'id')
    })

    const reqMock = {
      body: { val: 'doctor', scope: ['uid'] }
    }

    await handler(reqMock as any, resMock)

    expect(idServer.authenticate).toHaveBeenCalled()
    expect(jsonContent).toHaveBeenCalled()
    expect(validateParameters).toHaveBeenCalled()

    expect(mockSearch).toHaveBeenCalledWith(resMock, {
      val: 'doctor',
      scope: ['uid'],
      owner: '@drwho:server'
    })
  })

  it('should fallback to default owner when token.sub is missing', async () => {
    const mockSearch = jest.fn()
    ;(_search as jest.Mock).mockResolvedValue(mockSearch)

    const { addressbookService, userInfoService } = createMockServices()
    const handler = await autocompletion(
      idServer as any,
      logger as any,
      addressbookService,
      userInfoService
    )

    idServer.authenticate.mockImplementation((req, res, cb) => {
      cb({}, 'id') // no sub
    })

    const reqMock = {
      body: { val: 'tardis', scope: ['uid'] }
    }

    await handler(reqMock as any, resMock)

    expect(mockSearch).toHaveBeenCalledWith(resMock, {
      val: 'tardis',
      scope: ['uid'],
      owner: '@default:server'
    })
  })
})
