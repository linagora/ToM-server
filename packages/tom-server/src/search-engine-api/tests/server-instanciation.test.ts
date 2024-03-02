import { Router } from 'express'
import TwakeServer from '../..'
import defaultConfDesc from '../../config.json'
import { type Config } from '../../types'
import defaultConfig from '../__testData__/config.json'

const mockExists = jest.fn().mockResolvedValue({ statusCode: 200, body: true })
let testServer: TwakeServer

jest.mock('@opensearch-project/opensearch', () => ({
  Client: jest.fn().mockImplementation(() => ({
    indices: {
      exists: mockExists
    },
    close: jest.fn()
  }))
}))

jest.mock('@twake/matrix-identity-server', () => ({
  default: jest.fn().mockImplementation(() => ({
    ready: Promise.resolve(true),
    db: {},
    userDB: {},
    api: { get: {}, post: {} },
    cleanJobs: jest.fn().mockImplementation(() => testServer.logger.close())
  })),
  MatrixDB: jest.fn().mockImplementation(() => ({
    ready: Promise.resolve(true),
    close: jest.fn(),
    get: jest.fn().mockResolvedValue([]),
    getAll: jest.fn().mockResolvedValue([])
  })),
  Utils: {
    hostnameRe:
      /^((([a-zA-Z0-9][-a-zA-Z0-9]*)?[a-zA-Z0-9])[.])*([a-zA-Z][-a-zA-Z0-9]*[a-zA-Z0-9]|[a-zA-Z])(:(\d+))?$/
  }
}))

jest.mock('../../identity-server/index.ts', () => {
  return function () {
    return {
      ready: Promise.resolve(true),
      db: {},
      userDB: {},
      api: { get: {}, post: {} },
      cleanJobs: jest.fn().mockImplementation(() => testServer.logger.close())
    }
  }
})

jest.mock('../../application-server/index.ts', () => {
  return function () {
    return {
      router: {
        routes: Router()
      }
    }
  }
})

jest.mock('../../db/index.ts', () => jest.fn())

describe('Search engine API - Opensearch configuration', () => {
  afterEach(() => {
    if (testServer != null) testServer.cleanJobs()
  })

  it('should throw error if opensearch_user is defined and is not a string', async () => {
    await expect(async () => {
      testServer = new TwakeServer({
        ...defaultConfig,
        opensearch_user: 123
      } as unknown as Config)
      await testServer.ready
    }).rejects.toThrow(
      Error('Unable to initialize server', {
        cause: new Error('opensearch_user must be a string')
      })
    )
  })

  it('should throw error if opensearch_password is defined and is not a string', async () => {
    await expect(async () => {
      testServer = new TwakeServer({
        ...defaultConfig,
        opensearch_password: 123
      } as unknown as Config)
      await testServer.ready
    }).rejects.toThrow(
      Error('Unable to initialize server', {
        cause: new Error('opensearch_password must be a string')
      })
    )
  })

  it('should throw error if opensearch_password is defined and opensearch_user is not', async () => {
    await expect(async () => {
      const { opensearch_user: unusedVar, ...testConfig } =
        defaultConfig as Config
      const { opensearch_user: unusedVar2, ...testConfDesc } = defaultConfDesc
      testServer = new TwakeServer(testConfig, testConfDesc)
      await testServer.ready
    }).rejects.toThrow(
      Error('Unable to initialize server', {
        cause: new Error('opensearch_user is missing')
      })
    )
  })

  it('should throw error if opensearch_user is defined and opensearch_password is not', async () => {
    await expect(async () => {
      const { opensearch_password: unusedVar, ...testConfig } =
        defaultConfig as Config
      const { opensearch_password: unusedVar2, ...testConfDesc } =
        defaultConfDesc
      testServer = new TwakeServer(testConfig, testConfDesc)
      await testServer.ready
    }).rejects.toThrow(
      Error('Unable to initialize server', {
        cause: new Error('opensearch_password is missing')
      })
    )
  })

  it('should throw error if opensearch_host not is defined', async () => {
    await expect(async () => {
      const { opensearch_host: unusedVar, ...testConfig } =
        defaultConfig as Config
      const { opensearch_host: unusedVar2, ...testConfDesc } = defaultConfDesc
      testServer = new TwakeServer(testConfig, testConfDesc)
      await testServer.ready
    }).rejects.toThrow(
      Error('Unable to initialize server', {
        cause: new Error('opensearch_host is required when using OpenSearch')
      })
    )
  })

  it('should throw error if opensearch_host is not a string', async () => {
    await expect(async () => {
      testServer = new TwakeServer({
        ...defaultConfig,
        opensearch_host: 123
      } as unknown as Config)
      await testServer.ready
    }).rejects.toThrow(
      Error('Unable to initialize server', {
        cause: new Error('opensearch_host must be a string')
      })
    )
  })

  it('should throw error if opensearch_host does not match hostname regular expression', async () => {
    await expect(async () => {
      testServer = new TwakeServer({
        ...(defaultConfig as Config),
        opensearch_host: 'falsy_host'
      })
      await testServer.ready
    }).rejects.toThrow(
      Error('Unable to initialize server', {
        cause: new Error('opensearch_host is invalid')
      })
    )
  })

  it('should throw error if opensearch_ssl is defined and is not a boolean', async () => {
    await expect(async () => {
      testServer = new TwakeServer({
        ...defaultConfig,
        opensearch_ssl: 123
      } as unknown as Config)
      await testServer.ready
    }).rejects.toThrow(
      Error('Unable to initialize server', {
        cause: new Error('opensearch_ssl must be a boolean')
      })
    )
  })

  it('should throw error if opensearch_ca_cert_path is defined and is not a string', async () => {
    await expect(async () => {
      testServer = new TwakeServer({
        ...defaultConfig,
        opensearch_ca_cert_path: 123
      } as unknown as Config)
      await testServer.ready
    }).rejects.toThrow(
      Error('Unable to initialize server', {
        cause: new Error('opensearch_ca_cert_path must be a string')
      })
    )
  })

  it('should throw error if opensearch_max_retries is defined and is not a number', async () => {
    await expect(async () => {
      testServer = new TwakeServer({
        ...defaultConfig,
        opensearch_max_retries: 'falsy'
      } as unknown as Config)
      await testServer.ready
    }).rejects.toThrow(
      Error('Unable to initialize server', {
        cause: new Error('opensearch_max_retries must be a number')
      })
    )
  })

  it('should throw error if opensearch_number_of_shards is defined and is not a number', async () => {
    await expect(async () => {
      testServer = new TwakeServer({
        ...defaultConfig,
        opensearch_number_of_shards: 'falsy'
      } as unknown as Config)
      await testServer.ready
    }).rejects.toThrow(
      Error('Unable to initialize server', {
        cause: new Error('opensearch_number_of_shards must be a number')
      })
    )
  })

  it('should throw error if opensearch_number_of_replicas is defined and is not a number', async () => {
    await expect(async () => {
      testServer = new TwakeServer({
        ...defaultConfig,
        opensearch_number_of_replicas: 'falsy'
      } as unknown as Config)
      await testServer.ready
    }).rejects.toThrow(
      Error('Unable to initialize server', {
        cause: new Error('opensearch_number_of_replicas must be a number')
      })
    )
  })

  it('should throw error if opensearch_wait_for_active_shards is defined and is not a string', async () => {
    await expect(async () => {
      testServer = new TwakeServer({
        ...defaultConfig,
        opensearch_wait_for_active_shards: 123
      } as unknown as Config)
      await testServer.ready
    }).rejects.toThrow(
      Error('Unable to initialize server', {
        cause: new Error('opensearch_wait_for_active_shards must be a string')
      })
    )
  })

  it('should throw error if opensearch_wait_for_active_shards is defined and is not a string representing a number or equal to "all"', async () => {
    await expect(async () => {
      testServer = new TwakeServer({
        ...defaultConfig,
        opensearch_wait_for_active_shards: 'falsy'
      } as unknown as Config)
      await testServer.ready
    }).rejects.toThrow(
      Error('Unable to initialize server', {
        cause: new Error(
          'opensearch_wait_for_active_shards must be a string equal to a number or "all"'
        )
      })
    )
  })

  it('should log an error if opensearch API throws an error on create tom indexes', async () => {
    const error = new Error('An error occured in opensearch exists API')
    mockExists.mockRejectedValue(error)
    testServer = new TwakeServer(defaultConfig as Config)
    const loggerErrorSpyOn = jest.spyOn(testServer.logger, 'error')
    await expect(testServer.ready).rejects.toStrictEqual(
      new Error('Unable to initialize server', { cause: error })
    )
    mockExists.mockResolvedValue({ statusCode: 200, body: true })
    expect(loggerErrorSpyOn).toHaveBeenCalledTimes(1)
    expect(loggerErrorSpyOn).toHaveBeenCalledWith(
      `Unable to initialize server`,
      { error: error.message }
    )
  })

  it('should initialize server if config is correct', async () => {
    testServer = new TwakeServer(defaultConfig as Config)
    await expect(testServer.ready).resolves.toEqual(true)
  })
})
