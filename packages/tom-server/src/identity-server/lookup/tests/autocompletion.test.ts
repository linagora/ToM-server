import autocompletion from '../autocompletion'
import { jsonContent, validateParameters } from '@twake/utils'
import _search from '../_search'

jest.mock('@twake/utils', () => ({
  jsonContent: jest.fn((req, res, logger, callback) => callback(req.body)),
  validateParameters: jest.fn((res, schema, obj, logger, callback) =>
    callback(obj)
  )
}))

jest.mock('../_search', () => jest.fn(() => jest.fn()))

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

    const handler = await autocompletion(idServer as any, logger as any)

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

    const handler = await autocompletion(idServer as any, logger as any)

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
