import { CommonSettingsBridge } from './bridge'
import { SettingsRepository } from './settings-repository'
import { MatrixProfileUpdater } from './matrix-profile-updater'
import { Bridge, Logger, Intent } from 'matrix-appservice-bridge'
import { AMQPConnector } from '@twake/amqp-connector'
import { Database } from '@twake/db'
import type { ConsumeMessage, Channel } from 'amqplib'
import type { BridgeConfig, StoredUserSettings, SettingsPayload } from './types'
import { SynapseAdminRetryMode } from './types'

// Mock external dependencies
jest.mock('./settings-repository')
jest.mock('./matrix-profile-updater')
jest.mock('@twake/amqp-connector')
jest.mock('@twake/db')

describe('CommonSettingsBridge', () => {
  let bridge: CommonSettingsBridge
  let mockConfig: BridgeConfig
  let mockBridgeInstance: jest.Mocked<Bridge>
  let mockIntent: jest.Mocked<Intent>
  let mockDatabase: jest.Mocked<Database<any>>
  let mockConnector: jest.Mocked<AMQPConnector>
  let mockSettingsRepo: jest.Mocked<SettingsRepository>
  let mockProfileUpdater: jest.Mocked<MatrixProfileUpdater>
  let mockChannel: jest.Mocked<Channel>
  let mockAdminApis: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup config
    mockConfig = {
      homeserverUrl: 'https://matrix.example.com',
      domain: 'example.com',
      registrationPath: '/path/to/registration.yaml',
      database: {
        engine: 'pg',
        host: 'localhost',
        name: 'testdb',
        user: 'testuser',
        password: 'testpass'
      },
      rabbitmq: {
        host: 'localhost',
        port: 5672,
        username: 'guest',
        password: 'guest',
        vhost: '/',
        exchange: 'test-exchange',
        queue: 'test-queue',
        routingKey: 'test.routing.key',
        deadLetterExchange: 'test-dlx',
        deadLetterRoutingKey: 'test.dlx.routing.key'
      },
      synapse: {
        adminRetryMode: 'fallback'
      }
    }

    // Mock database
    mockDatabase = {
      ready: Promise.resolve(),
      get: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      close: jest.fn(),
      ensureColumns: jest.fn().mockResolvedValue(undefined)
    } as any
    ;(Database as jest.MockedClass<typeof Database>).mockImplementation(
      () => mockDatabase
    )

    // Mock AMQP connector
    mockConnector = {
      withConfig: jest.fn().mockReturnThis(),
      withExchange: jest.fn().mockReturnThis(),
      withQueue: jest.fn().mockReturnThis(),
      onMessage: jest.fn().mockReturnThis(),
      build: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    } as any
    ;(
      AMQPConnector as jest.MockedClass<typeof AMQPConnector>
    ).mockImplementation(() => mockConnector)

    // Mock admin APIs
    mockAdminApis = {
      isSelfAdmin: jest.fn().mockResolvedValue(true),
      upsertUser: jest.fn().mockResolvedValue(undefined)
    }

    // Mock Intent
    mockIntent = {
      ensureRegistered: jest.fn().mockResolvedValue(undefined),
      setDisplayName: jest.fn().mockResolvedValue(undefined),
      setAvatarUrl: jest.fn().mockResolvedValue(undefined),
      matrixClient: {
        adminApis: {
          synapse: mockAdminApis
        },
        uploadContentFromUrl: jest
          .fn()
          .mockResolvedValue('mxc://example.com/avatar123')
      }
    } as any

    // The Bridge mock is handled by the manual mock in __mocks__
    // Create an instance to access the shared mock methods
    const tempBridge = new Bridge({} as any)
    mockBridgeInstance = {
      run: tempBridge.run,
      getBot: tempBridge.getBot,
      getIntent: tempBridge.getIntent
    } as any

    // Get the shared mockIntent from the Bridge's getIntent mock
    mockIntent = mockBridgeInstance.getIntent() as any

    // Update mockAdminApis to reference the mockIntent's admin APIs
    mockAdminApis = mockIntent.matrixClient.adminApis.synapse

    // Mock SettingsRepository
    mockSettingsRepo = {
      getUserSettings: jest.fn(),
      saveSettings: jest.fn()
    } as any
    ;(
      SettingsRepository as jest.MockedClass<typeof SettingsRepository>
    ).mockImplementation(() => mockSettingsRepo)

    // Mock MatrixProfileUpdater
    mockProfileUpdater = {
      processChanges: jest.fn().mockResolvedValue(undefined),
      updateDisplayName: jest.fn().mockResolvedValue(undefined),
      updateAvatar: jest.fn().mockResolvedValue(undefined)
    } as any
    ;(
      MatrixProfileUpdater as jest.MockedClass<typeof MatrixProfileUpdater>
    ).mockImplementation(() => mockProfileUpdater)

    // Mock AMQP Channel
    mockChannel = {
      ack: jest.fn(),
      nack: jest.fn()
    } as any
  })

  describe('constructor', () => {
    it('should initialize bridge instance with config', () => {
      bridge = new CommonSettingsBridge(mockConfig)

      expect(bridge).toBeInstanceOf(CommonSettingsBridge)
      expect(Database).toHaveBeenCalledWith(
        expect.objectContaining({
          database_engine: 'pg',
          database_host: 'localhost',
          database_name: 'testdb',
          database_user: 'testuser',
          database_password: 'testpass'
        }),
        expect.any(Object),
        expect.objectContaining({
          usersettings: expect.any(String)
        })
      )
    })

    it('should initialize AMQP connector with config', () => {
      bridge = new CommonSettingsBridge(mockConfig)

      expect(AMQPConnector).toHaveBeenCalled()
      expect(mockConnector.withConfig).toHaveBeenCalledWith(mockConfig.rabbitmq)
      expect(mockConnector.withExchange).toHaveBeenCalledWith('test-exchange', {
        durable: true
      })
      expect(mockConnector.withQueue).toHaveBeenCalledWith(
        'test-queue',
        {
          durable: true,
          deadLetterExchange: 'test-dlx',
          deadLetterRoutingKey: 'test.dlx.routing.key'
        },
        'test.routing.key'
      )
      expect(mockConnector.onMessage).toHaveBeenCalledWith(expect.any(Function))
    })
  })

  describe('start()', () => {
    beforeEach(() => {
      bridge = new CommonSettingsBridge(mockConfig)
    })

    it('should initialize Matrix bridge', async () => {
      await bridge.start()

      expect(mockBridgeInstance.run).toHaveBeenCalledWith(0)
    })

    it('should ensure bot is registered', async () => {
      await bridge.start()

      expect(mockBridgeInstance.getBot).toHaveBeenCalled()
      expect(mockBridgeInstance.getIntent).toHaveBeenCalledWith(
        '@bot:example.com'
      )
      expect(mockIntent.ensureRegistered).toHaveBeenCalled()
    })

    it('should check admin privileges', async () => {
      await bridge.start()

      expect(mockAdminApis.isSelfAdmin).toHaveBeenCalled()
    })

    it('should wait for database to be ready', async () => {
      const readyPromise = Promise.resolve()
      mockDatabase.ready = readyPromise

      await bridge.start()

      await expect(readyPromise).resolves.toBeUndefined()
    })

    it('should initialize settings repository', async () => {
      await bridge.start()

      expect(SettingsRepository).toHaveBeenCalledWith(
        mockDatabase,
        expect.any(Object)
      )
    })

    it('should initialize profile updater with correct retry mode', async () => {
      await bridge.start()

      expect(MatrixProfileUpdater).toHaveBeenCalledWith(
        expect.objectContaining({
          getIntent: expect.any(Function),
          adminUpsertUser: expect.any(Function)
        }),
        SynapseAdminRetryMode.FALLBACK,
        expect.any(Object),
        expect.objectContaining({
          maxSizeBytes: expect.any(Number),
          fetchTimeoutMs: expect.any(Number)
        })
      )
    })

    it('should build AMQP connector', async () => {
      await bridge.start()

      expect(mockConnector.build).toHaveBeenCalled()
    })

    it('should handle startup errors', async () => {
      const error = new Error('Startup failed')
      mockBridgeInstance.run.mockRejectedValueOnce(error)

      const newBridge = new CommonSettingsBridge(mockConfig)
      await expect(newBridge.start()).rejects.toThrow('Startup failed')
    })
  })

  describe('stop()', () => {
    beforeEach(async () => {
      bridge = new CommonSettingsBridge(mockConfig)
      await bridge.start()
    })

    it('should close AMQP connector', async () => {
      await bridge.stop()

      expect(mockConnector.close).toHaveBeenCalled()
    })

    it('should close database connection', async () => {
      await bridge.stop()

      expect(mockDatabase.close).toHaveBeenCalled()
    })

    it('should handle shutdown errors', async () => {
      const error = new Error('Shutdown failed')
      mockConnector.close.mockRejectedValue(error)

      await expect(bridge.stop()).rejects.toThrow('Shutdown failed')
    })
  })

  describe('#handleMessage orchestration', () => {
    let handleMessageFn: (
      msg: ConsumeMessage,
      channel: Channel
    ) => Promise<void>
    let mockMessage: ConsumeMessage
    let mockUserSettings: StoredUserSettings | null
    let mockPayload: SettingsPayload

    beforeEach(async () => {
      bridge = new CommonSettingsBridge(mockConfig)

      // Capture the message handler
      const onMessageCall = (mockConnector.onMessage as jest.Mock).mock.calls[0]
      handleMessageFn = onMessageCall[0]

      await bridge.start()

      // Setup test data
      mockPayload = {
        matrix_id: '@user:example.com',
        display_name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
        email: 'john@example.com',
        phone: '+1234567890',
        language: 'en',
        timezone: 'UTC',
        last_name: 'Doe',
        first_name: 'John'
      }
    })

    it('should throw error if JSON parse fails', async () => {
      mockMessage = {
        content: Buffer.from('invalid json {{{')
      } as ConsumeMessage

      await expect(handleMessageFn(mockMessage, mockChannel)).rejects.toThrow(
        'Failed to parse AMQP message payload'
      )
    })

    it('should throw error if message is missing request_id', async () => {
      mockMessage = {
        content: Buffer.from(
          JSON.stringify({
            source: 'test-app',
            timestamp: 1640995200000,
            version: 1,
            payload: mockPayload
          })
        )
      } as ConsumeMessage

      await expect(handleMessageFn(mockMessage, mockChannel)).rejects.toThrow(
        'Message missing required request_id field'
      )
    })

    it('should throw error if message is missing matrix_id in payload', async () => {
      mockMessage = {
        content: Buffer.from(
          JSON.stringify({
            source: 'test-app',
            request_id: 'req-123',
            timestamp: 1640995200000,
            version: 1,
            payload: { display_name: 'Test' }
          })
        )
      } as ConsumeMessage

      await expect(handleMessageFn(mockMessage, mockChannel)).rejects.toThrow(
        'User ID (matrix_id) not provided in message payload'
      )
    })

    it('should get user settings from repository', async () => {
      mockUserSettings = null
      mockSettingsRepo.getUserSettings.mockResolvedValue(mockUserSettings)

      mockMessage = {
        content: Buffer.from(
          JSON.stringify({
            source: 'test-app',
            request_id: 'req-123',
            timestamp: 1640995200000,
            version: 2,
            payload: mockPayload
          })
        )
      } as ConsumeMessage

      await handleMessageFn(mockMessage, mockChannel)

      expect(mockSettingsRepo.getUserSettings).toHaveBeenCalledWith(
        '@user:example.com'
      )
    })

    it('should discard duplicate messages (same request_id)', async () => {
      mockUserSettings = {
        nickname: '@user:example.com',
        payload: mockPayload,
        version: 1,
        timestamp: 1640991600000,
        request_id: 'req-123' // Same as incoming
      }
      mockSettingsRepo.getUserSettings.mockResolvedValue(mockUserSettings)

      mockMessage = {
        content: Buffer.from(
          JSON.stringify({
            source: 'test-app',
            request_id: 'req-123',
            timestamp: 1640995200000,
            version: 2,
            payload: mockPayload
          })
        )
      } as ConsumeMessage

      await handleMessageFn(mockMessage, mockChannel)

      expect(mockProfileUpdater.processChanges).not.toHaveBeenCalled()
      expect(mockSettingsRepo.saveSettings).not.toHaveBeenCalled()
    })

    it('should discard stale updates (lower version)', async () => {
      mockUserSettings = {
        nickname: '@user:example.com',
        payload: mockPayload,
        version: 5, // Higher than incoming
        timestamp: 1640998800000,
        request_id: 'req-999'
      }
      mockSettingsRepo.getUserSettings.mockResolvedValue(mockUserSettings)

      mockMessage = {
        content: Buffer.from(
          JSON.stringify({
            source: 'test-app',
            request_id: 'req-123',
            timestamp: 1640995200000,
            version: 2, // Lower than stored
            payload: mockPayload
          })
        )
      } as ConsumeMessage

      await handleMessageFn(mockMessage, mockChannel)

      expect(mockProfileUpdater.processChanges).not.toHaveBeenCalled()
      expect(mockSettingsRepo.saveSettings).not.toHaveBeenCalled()
    })

    it('should process changes for new user', async () => {
      mockUserSettings = null
      mockSettingsRepo.getUserSettings.mockResolvedValue(mockUserSettings)

      mockMessage = {
        content: Buffer.from(
          JSON.stringify({
            source: 'test-app',
            request_id: 'req-123',
            timestamp: 1640995200000,
            version: 2,
            payload: mockPayload
          })
        )
      } as ConsumeMessage

      await handleMessageFn(mockMessage, mockChannel)

      expect(mockProfileUpdater.processChanges).toHaveBeenCalledWith(
        '@user:example.com',
        null,
        mockPayload
      )
    })

    it('should process changes for existing user with higher version', async () => {
      const oldPayload: SettingsPayload = {
        matrix_id: '@user:example.com',
        display_name: 'Old Name',
        avatar: 'https://example.com/old-avatar.jpg',
        email: 'old@example.com',
        phone: '+9876543210',
        language: 'en',
        timezone: 'UTC',
        last_name: 'Doe',
        first_name: 'John'
      }
      mockUserSettings = {
        nickname: '@user:example.com',
        payload: oldPayload,
        version: 1,
        timestamp: 1640991600000,
        request_id: 'req-old'
      }
      mockSettingsRepo.getUserSettings.mockResolvedValue(mockUserSettings)

      mockMessage = {
        content: Buffer.from(
          JSON.stringify({
            source: 'test-app',
            request_id: 'req-123',
            timestamp: 1640995200000,
            version: 2,
            payload: mockPayload
          })
        )
      } as ConsumeMessage

      await handleMessageFn(mockMessage, mockChannel)

      expect(mockProfileUpdater.processChanges).toHaveBeenCalledWith(
        '@user:example.com',
        oldPayload,
        mockPayload
      )
    })

    it('should save settings for new user', async () => {
      mockUserSettings = null
      mockSettingsRepo.getUserSettings.mockResolvedValue(mockUserSettings)

      mockMessage = {
        content: Buffer.from(
          JSON.stringify({
            source: 'test-app',
            request_id: 'req-123',
            timestamp: 1640995200000,
            version: 2,
            payload: mockPayload
          })
        )
      } as ConsumeMessage

      await handleMessageFn(mockMessage, mockChannel)

      expect(mockSettingsRepo.saveSettings).toHaveBeenCalledWith(
        '@user:example.com',
        mockPayload,
        2,
        1640995200000,
        'req-123',
        true
      )
    })

    it('should save settings for existing user', async () => {
      mockUserSettings = {
        nickname: '@user:example.com',
        payload: mockPayload,
        version: 1,
        timestamp: 1640991600000,
        request_id: 'req-old'
      }
      mockSettingsRepo.getUserSettings.mockResolvedValue(mockUserSettings)

      mockMessage = {
        content: Buffer.from(
          JSON.stringify({
            source: 'test-app',
            request_id: 'req-123',
            timestamp: 1640995200000,
            version: 2,
            payload: mockPayload
          })
        )
      } as ConsumeMessage

      await handleMessageFn(mockMessage, mockChannel)

      expect(mockSettingsRepo.saveSettings).toHaveBeenCalledWith(
        '@user:example.com',
        mockPayload,
        2,
        1640995200000,
        'req-123',
        false
      )
    })

    it('should execute orchestration steps in correct order', async () => {
      mockUserSettings = {
        nickname: '@user:example.com',
        payload: {
          matrix_id: '@user:example.com',
          display_name: 'Old Name',
          avatar: 'https://example.com/old.jpg',
          email: 'old@example.com',
          phone: '+9999999999',
          language: 'en',
          timezone: 'UTC',
          last_name: 'Doe',
          first_name: 'John'
        },
        version: 1,
        timestamp: 1640991600000,
        request_id: 'req-old'
      }
      mockSettingsRepo.getUserSettings.mockResolvedValue(mockUserSettings)

      mockMessage = {
        content: Buffer.from(
          JSON.stringify({
            source: 'test-app',
            request_id: 'req-123',
            timestamp: 1640995200000,
            version: 2,
            payload: mockPayload
          })
        )
      } as ConsumeMessage

      await handleMessageFn(mockMessage, mockChannel)

      // Verify orchestration order: getUserSettings -> processChanges -> saveSettings
      const getSettingsOrder =
        mockSettingsRepo.getUserSettings.mock.invocationCallOrder[0]
      const processChangesOrder =
        mockProfileUpdater.processChanges.mock.invocationCallOrder[0]
      const saveSettingsOrder =
        mockSettingsRepo.saveSettings.mock.invocationCallOrder[0]

      expect(getSettingsOrder).toBeDefined()
      expect(processChangesOrder).toBeDefined()
      expect(saveSettingsOrder).toBeDefined()

      expect(getSettingsOrder).toBeLessThan(processChangesOrder)
      expect(processChangesOrder).toBeLessThan(saveSettingsOrder)
    })
  })
})
