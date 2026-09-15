import { resolve } from 'path'
import { beforeEach, describe, expect, it, mock, type Mock } from 'bun:test'
import autocompletion from '../autocompletion'
import { jsonContent, validateParameters } from '../../../../utils'
import _search from '../_search'

mock.module(
  resolve(import.meta.dir, '../../../../utils/index'),
  () => ({
    jsonContent: mock((req, res, logger, callback) => callback(req.body)),
    validateParameters: mock((res, schema, obj, logger, callback) =>
      callback(obj)
    )
  })
)

mock.module('../_search', () => ({ default: mock(() => mock()) }))

// Mock service instances
const createMockServices = () => ({
  addressbookService: {
    list: mock().mockResolvedValue({ contacts: [] })
  } as any,
  userInfoService: {
    get: mock().mockResolvedValue(null)
  } as any
})

describe('autocompletion handler', () => {
  const logger = {
    debug: mock(),
    info: mock(),
    warn: mock(),
    error: mock()
  }

  const idServer = {
    authenticate: mock(),
    conf: { server_name: 'server' }
  }

  const resMock = {} as any

  beforeEach(() => {
    mock.clearAllMocks()
  })

  it('should call search with owner from token.sub', async () => {
    const mockSearch = mock()
    ;(_search as Mock<(...args: any[]) => any>).mockResolvedValue(mockSearch)

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
    const mockSearch = mock()
    ;(_search as Mock<(...args: any[]) => any>).mockResolvedValue(mockSearch)

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
