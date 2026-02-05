/* eslint-disable @typescript-eslint/promise-function-async */
import type { ConsumeMessage, Channel } from 'amqplib'
import { type BridgeConfig } from './types'
import { UserIdNotProvidedError, MessageParseError } from './errors'

// Must provide factory functions for mocks used at module load time
jest.mock('matrix-appservice-bridge', () => {
  const mockLoggerInstance = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
  const MockLogger = jest.fn(() => mockLoggerInstance)
  ;(MockLogger as any).configure = jest.fn()

  return {
    Bridge: jest.fn(),
    Cli: jest.fn().mockImplementation(() => ({
      run: jest.fn()
    })),
    AppServiceRegistration: {
      generateToken: jest.fn().mockReturnValue('mock-token')
    },
    Logger: MockLogger
  }
})

jest.mock('@twake/amqp-connector', () => ({
  AMQPConnector: jest.fn()
}))

jest.mock('@twake/db', () => ({
  Database: jest.fn()
}))

const mockUploadContentFromUrl = jest.fn(() =>
  Promise.resolve('mxc://example.com/uploaded123')
)
const mockUploadContent = jest.fn(() =>
  Promise.resolve('mxc://example.com/uploaded123')
)
const mockSetDisplayName = jest.fn(() => Promise.resolve())
const mockSetAvatarUrl = jest.fn(() => Promise.resolve())
const mockEnsureRegistered = jest.fn(() => Promise.resolve())
const mockIsSelfAdmin = jest.fn(() => Promise.resolve(true))
const mockUpsertUser = jest.fn(() => Promise.resolve())

const mockIntent = {
  ensureRegistered: mockEnsureRegistered,
  setDisplayName: mockSetDisplayName,
  setAvatarUrl: mockSetAvatarUrl,
  matrixClient: {
    uploadContentFromUrl: mockUploadContentFromUrl,
    uploadContent: mockUploadContent,
    adminApis: {
      synapse: {
        isSelfAdmin: mockIsSelfAdmin,
        upsertUser: mockUpsertUser
      }
    }
  }
}

const mockRun = jest.fn(() => Promise.resolve())
const mockGetBot = jest.fn().mockReturnValue({
  getUserId: jest.fn().mockReturnValue('@bot:example.com')
})
const mockGetIntent = jest.fn().mockReturnValue(mockIntent)

const mockBridge = {
  run: mockRun,
  getBot: mockGetBot,
  getIntent: mockGetIntent
}

const mockDbGet = jest.fn().mockResolvedValue([] as unknown[])
const mockDbInsert = jest.fn(() => Promise.resolve())
const mockDbUpdate = jest.fn(() => Promise.resolve())
const mockDbClose = jest.fn()
const mockDbEnsureColumns = jest.fn(() => Promise.resolve())

const mockDb = {
  ready: Promise.resolve(),
  get: mockDbGet,
  insert: mockDbInsert,
  update: mockDbUpdate,
  close: mockDbClose,
  ensureColumns: mockDbEnsureColumns
}

const mockConnectorBuild = jest.fn(() => Promise.resolve())
const mockConnectorClose = jest.fn(() => Promise.resolve())
let messageHandler: (msg: ConsumeMessage, channel: Channel) => Promise<void>

const mockConnectorWithConfig = jest.fn()
const mockConnectorWithExchange = jest.fn()
const mockConnectorWithQueue = jest.fn()
const mockConnectorOnMessage = jest.fn()

const mockConnector = {
  withConfig: mockConnectorWithConfig,
  withExchange: mockConnectorWithExchange,
  withQueue: mockConnectorWithQueue,
  onMessage: mockConnectorOnMessage,
  build: mockConnectorBuild,
  close: mockConnectorClose
}

// Setup return this chaining
mockConnectorWithConfig.mockReturnValue(mockConnector)
mockConnectorWithExchange.mockReturnValue(mockConnector)
mockConnectorWithQueue.mockReturnValue(mockConnector)
mockConnectorOnMessage.mockImplementation((handler: any) => {
  messageHandler = handler
  return mockConnector
})

beforeAll(() => {
  const { Bridge } = jest.requireMock('matrix-appservice-bridge')
  Bridge.mockImplementation(() => mockBridge)

  const { AMQPConnector } = jest.requireMock('@twake/amqp-connector')
  AMQPConnector.mockImplementation(() => mockConnector)

  const { Database } = jest.requireMock('@twake/db')
  Database.mockImplementation(() => mockDb)
})

// Create a proper fetch mock for avatar downloads
const createMockFetchResponse = (
  options: { ok?: boolean; status?: number; statusText?: string } = {}
) => ({
  ok: options.ok ?? true,
  status: options.status ?? 200,
  statusText: options.statusText ?? 'OK',
  headers: {
    get: (name: string) => {
      if (name === 'content-length') return '1000'
      if (name === 'content-type') return 'image/png'
      return null
    }
  },
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000))
})

beforeEach(() => {
  jest.clearAllMocks()
  mockDbGet.mockResolvedValue([] as unknown[])
  mockUploadContentFromUrl.mockResolvedValue('mxc://example.com/uploaded123')
  mockUploadContent.mockResolvedValue('mxc://example.com/uploaded123')
  // Mock global fetch for avatar downloads
  global.fetch = jest.fn(() =>
    Promise.resolve(createMockFetchResponse())
  ) as any
  // Re-setup chaining after clearAllMocks
  mockConnectorWithConfig.mockReturnValue(mockConnector)
  mockConnectorWithExchange.mockReturnValue(mockConnector)
  mockConnectorWithQueue.mockReturnValue(mockConnector)
  mockConnectorOnMessage.mockImplementation((handler: any) => {
    messageHandler = handler
    return mockConnector
  })
})

const createTestConfig = (
  adminRetryMode: 'disabled' | 'fallback' | 'exclusive' = 'disabled'
): BridgeConfig => ({
  homeserverUrl: 'https://matrix.example.com',
  domain: 'example.com',
  registrationPath: '/path/to/registration.yaml',
  synapse: {
    adminRetryMode
  },
  rabbitmq: {
    host: 'localhost',
    port: 5672,
    vhost: '/',
    username: 'guest',
    password: 'guest',
    tls: false,
    exchange: 'common-settings',
    queue: 'settings-updates',
    routingKey: 'settings.update',
    deadLetterExchange: 'common-settings-dlx',
    deadLetterRoutingKey: 'settings.dead'
  },
  database: {
    engine: 'sqlite',
    name: ':memory:'
  }
})

const createTestMessage = (overrides: Record<string, any> = {}) => ({
  source: 'test-service',
  nickname: 'test-user',
  request_id: '12345',
  timestamp: Date.now(),
  version: 1,
  payload: {
    matrix_id: '@user:example.com',
    display_name: 'Test User',
    avatar: 'mxc://example.com/avatar123',
    email: 'test@example.com',
    phone: '+1234567890',
    language: 'en',
    timezone: 'UTC',
    first_name: 'Test',
    last_name: 'User',
    ...overrides.payload
  },
  ...overrides
})

const createMockConsumeMessage = (content: string): ConsumeMessage =>
  ({
    content: Buffer.from(content),
    fields: {},
    properties: {}
  } as ConsumeMessage)

const mockChannel = {} as Channel

describe('CommonSettingsBridge - Message Parsing', () => {
  it('should parse valid JSON message', async () => {
    const { CommonSettingsBridge } = await import('./index')
    const config = createTestConfig()
    const bridge = new (CommonSettingsBridge as any)(config)

    await bridge.start()

    const testMessage = createTestMessage()
    const msg = createMockConsumeMessage(JSON.stringify(testMessage))

    await messageHandler(msg, mockChannel)

    expect(mockDbInsert).toHaveBeenCalledWith(
      'usersettings',
      expect.objectContaining({
        matrix_id: '@user:example.com'
      })
    )
  })

  it('should throw MessageParseError for invalid JSON', async () => {
    const { CommonSettingsBridge } = await import('./index')
    const config = createTestConfig()
    const bridge = new (CommonSettingsBridge as any)(config)

    await bridge.start()

    const msg = createMockConsumeMessage('invalid json {')

    await expect(messageHandler(msg, mockChannel)).rejects.toThrow(
      MessageParseError
    )
  })

  it('should throw UserIdNotProvidedError when matrix_id is missing', async () => {
    const { CommonSettingsBridge } = await import('./index')
    const config = createTestConfig()
    const bridge = new (CommonSettingsBridge as any)(config)

    await bridge.start()

    const testMessage = createTestMessage({
      payload: {
        display_name: 'Test User'
      }
    })
    const msg = createMockConsumeMessage(JSON.stringify(testMessage))

    await expect(messageHandler(msg, mockChannel)).rejects.toThrow(
      UserIdNotProvidedError
    )
  })
})

describe('CommonSettingsBridge - Avatar URL Resolution', () => {
  it('should use MXC URL directly when avatar starts with mxc://', async () => {
    const { CommonSettingsBridge } = await import('./index')
    const config = createTestConfig()
    const bridge = new (CommonSettingsBridge as any)(config)

    await bridge.start()

    const testMessage = createTestMessage({
      payload: {
        matrix_id: '@user:example.com',
        display_name: 'Test User',
        avatar: 'mxc://example.com/already-mxc'
      }
    })
    const msg = createMockConsumeMessage(JSON.stringify(testMessage))

    await messageHandler(msg, mockChannel)

    expect(mockUploadContentFromUrl).not.toHaveBeenCalled()
    expect(mockSetAvatarUrl).toHaveBeenCalledWith(
      'mxc://example.com/already-mxc'
    )
  })

  it('should download and upload HTTP avatar URL', async () => {
    const { CommonSettingsBridge } = await import('./index')
    const config = createTestConfig()
    const bridge = new (CommonSettingsBridge as any)(config)

    await bridge.start()

    const testMessage = createTestMessage({
      payload: {
        matrix_id: '@user:example.com',
        display_name: 'Test User',
        avatar: 'https://example.com/avatar.png'
      }
    })
    const msg = createMockConsumeMessage(JSON.stringify(testMessage))

    await messageHandler(msg, mockChannel)

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/avatar.png',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(mockUploadContent).toHaveBeenCalled()
    expect(mockSetAvatarUrl).toHaveBeenCalledWith(
      'mxc://example.com/uploaded123'
    )
  })

  it('should propagate upload errors', async () => {
    const { CommonSettingsBridge } = await import('./index')
    const config = createTestConfig()
    const bridge = new (CommonSettingsBridge as any)(config)

    mockUploadContent.mockRejectedValueOnce(new Error('Upload failed'))

    await bridge.start()

    const testMessage = createTestMessage({
      payload: {
        matrix_id: '@user:example.com',
        display_name: 'Test User',
        avatar: 'https://example.com/avatar.png'
      }
    })
    const msg = createMockConsumeMessage(JSON.stringify(testMessage))

    await expect(messageHandler(msg, mockChannel)).rejects.toThrow(
      'Upload failed'
    )
  })

  it('should use uploaded MXC URL with admin API in EXCLUSIVE mode', async () => {
    const { CommonSettingsBridge } = await import('./index')
    const config = createTestConfig('exclusive')
    const bridge = new (CommonSettingsBridge as any)(config)

    await bridge.start()

    const testMessage = createTestMessage({
      payload: {
        matrix_id: '@user:example.com',
        display_name: 'Test User',
        avatar: 'https://example.com/avatar.png'
      }
    })
    const msg = createMockConsumeMessage(JSON.stringify(testMessage))

    await messageHandler(msg, mockChannel)

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/avatar.png',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(mockUploadContent).toHaveBeenCalled()
    expect(mockUpsertUser).toHaveBeenCalledWith('@user:example.com', {
      avatar_url: 'mxc://example.com/uploaded123'
    })
    expect(mockSetAvatarUrl).not.toHaveBeenCalled()
  })
})

describe('CommonSettingsBridge - Matrix Updates', () => {
  it('should use admin API in EXCLUSIVE mode for display name', async () => {
    const { CommonSettingsBridge } = await import('./index')
    const config = createTestConfig('exclusive')
    const bridge = new (CommonSettingsBridge as any)(config)

    await bridge.start()

    const testMessage = createTestMessage()
    const msg = createMockConsumeMessage(JSON.stringify(testMessage))

    await messageHandler(msg, mockChannel)

    expect(mockUpsertUser).toHaveBeenCalledWith('@user:example.com', {
      displayname: 'Test User'
    })
    expect(mockSetDisplayName).not.toHaveBeenCalled()
  })

  it('should use intent API in DISABLED mode for display name', async () => {
    const { CommonSettingsBridge } = await import('./index')
    const config = createTestConfig('disabled')
    const bridge = new (CommonSettingsBridge as any)(config)

    await bridge.start()

    const testMessage = createTestMessage()
    const msg = createMockConsumeMessage(JSON.stringify(testMessage))

    await messageHandler(msg, mockChannel)

    expect(mockSetDisplayName).toHaveBeenCalledWith('Test User')
  })

  it('should fallback to admin API on M_FORBIDDEN in FALLBACK mode', async () => {
    const { CommonSettingsBridge } = await import('./index')
    const config = createTestConfig('fallback')
    const bridge = new (CommonSettingsBridge as any)(config)

    mockSetDisplayName.mockRejectedValueOnce({
      errcode: 'M_FORBIDDEN',
      message: 'Forbidden'
    })

    await bridge.start()

    const testMessage = createTestMessage()
    const msg = createMockConsumeMessage(JSON.stringify(testMessage))

    await messageHandler(msg, mockChannel)

    expect(mockSetDisplayName).toHaveBeenCalledWith('Test User')
    expect(mockUpsertUser).toHaveBeenCalledWith('@user:example.com', {
      displayname: 'Test User'
    })
  })
})

describe('CommonSettingsBridge - Change Detection', () => {
  it('should not update display name when unchanged', async () => {
    const { CommonSettingsBridge } = await import('./index')
    const config = createTestConfig()
    const bridge = new (CommonSettingsBridge as any)(config)

    const existingSettings = {
      matrix_id: '@user:example.com',
      settings: JSON.stringify({
        display_name: 'Test User',
        avatar: 'mxc://example.com/avatar123'
      }),
      version: 1,
      timestamp: Date.now() - 1000,
      request_id: 'old-request'
    }

    mockDbGet.mockResolvedValue([existingSettings] as unknown[])

    await bridge.start()

    const testMessage = createTestMessage()
    const msg = createMockConsumeMessage(JSON.stringify(testMessage))

    await messageHandler(msg, mockChannel)

    expect(mockSetDisplayName).not.toHaveBeenCalled()
    expect(mockSetAvatarUrl).not.toHaveBeenCalled()
  })

  it('should update display name when changed', async () => {
    const { CommonSettingsBridge } = await import('./index')
    const config = createTestConfig()
    const bridge = new (CommonSettingsBridge as any)(config)

    const existingSettings = {
      matrix_id: '@user:example.com',
      settings: JSON.stringify({
        display_name: 'Old Name',
        avatar: 'mxc://example.com/avatar123'
      }),
      version: 1,
      timestamp: Date.now() - 1000,
      request_id: 'old-request'
    }

    mockDbGet.mockResolvedValue([existingSettings] as unknown[])

    await bridge.start()

    const testMessage = createTestMessage({
      payload: {
        matrix_id: '@user:example.com',
        display_name: 'New Name',
        avatar: 'mxc://example.com/avatar123'
      }
    })
    const msg = createMockConsumeMessage(JSON.stringify(testMessage))

    await messageHandler(msg, mockChannel)

    expect(mockSetDisplayName).toHaveBeenCalledWith('New Name')
    expect(mockSetAvatarUrl).not.toHaveBeenCalled()
  })
})

describe('CommonSettingsBridge - Lifecycle', () => {
  it('should start successfully', async () => {
    const { CommonSettingsBridge } = await import('./index')
    const config = createTestConfig()
    const bridge = new (CommonSettingsBridge as any)(config)

    await bridge.start()

    expect(mockRun).toHaveBeenCalledWith(0)
    expect(mockEnsureRegistered).toHaveBeenCalled()
    expect(mockConnectorBuild).toHaveBeenCalled()
  })

  it('should stop successfully', async () => {
    const { CommonSettingsBridge } = await import('./index')
    const config = createTestConfig()
    const bridge = new (CommonSettingsBridge as any)(config)

    await bridge.start()
    await bridge.stop()

    expect(mockConnectorClose).toHaveBeenCalled()
    expect(mockDbClose).toHaveBeenCalled()
  })

  it('should check admin privileges on start', async () => {
    const { CommonSettingsBridge } = await import('./index')
    const config = createTestConfig()
    const bridge = new (CommonSettingsBridge as any)(config)

    await bridge.start()

    expect(mockIsSelfAdmin).toHaveBeenCalled()
  })
})
