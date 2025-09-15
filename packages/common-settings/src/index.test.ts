/* eslint-disable @typescript-eslint/dot-notation */
import { CommonSettingsService } from '.'
import {
  QueueNotProvidedError,
  UserIdNotProvidedError,
  UserSettingsNotProvidedError,
  ConfigNotProvidedError,
  ExchangeNotProvidedError
} from './errors'

const mockBuild = jest.fn().mockResolvedValue(undefined)
const mockClose = jest.fn().mockResolvedValue(undefined)

jest.mock('@twake/amqp-connector', () => {
  const mockCtor = jest.fn().mockImplementation(() => ({
    withConfig: jest.fn().mockReturnThis(),
    withExchange: jest.fn().mockReturnThis(),
    withQueue: jest.fn().mockReturnThis(),
    onMessage: jest.fn().mockReturnThis(),
    build: mockBuild,
    close: mockClose
  }))
  return { AMQPConnector: mockCtor }
})

interface MockLogger {
  info: jest.Mock
  warn: jest.Mock
  error: jest.Mock
}
interface MockDb {
  get: jest.Mock
  insert: jest.Mock
  update: jest.Mock
}

const makeLogger = (): MockLogger => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
})

const makeDb = (): MockDb => ({
  get: jest.fn(),
  insert: jest.fn(),
  update: jest.fn()
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const makeConfig = (overrides: Partial<any> = {}) => ({
  rabbitmq: {
    host: 'localhost',
    port: 5672,
    username: 'guest',
    password: 'guest'
  },
  features: {
    common_settings: {
      enabled: true,
      exchange: 'settings.exchange',
      queue: 'settings',
      ...overrides
    }
  },
  synapse_admin_server: 'http://synapse.local',
  synapse_admin_secret: 'secret',
  ...overrides
})

beforeEach(() => {
  jest.clearAllMocks()
  ;(global as any).fetch = jest.fn()
})

describe('should handle errors', () => {
  it('should throw ConfigNotProvidedError if rabbitmq config is missing', () => {
    const config = { features: { common_setting: { queue: 'settings' } } }
    expect(
      () =>
        new CommonSettingsService(
          config as any,
          makeLogger() as any,
          makeDb() as any
        )
    ).toThrow(ConfigNotProvidedError)
  })

  it('should throw ExchangeNotProvidedError if exchange is missing', () => {
    const config = makeConfig({ exchange: undefined })
    expect(
      () =>
        new CommonSettingsService(
          config as any,
          makeLogger() as any,
          makeDb() as any
        )
    ).toThrow(ExchangeNotProvidedError)
  })

  it('should throw QueueNotProvidedError if queue is missing', () => {
    const config = makeConfig({ queue: undefined })
    expect(
      () =>
        new CommonSettingsService(
          config as any,
          makeLogger() as any,
          makeDb() as any
        )
    ).toThrow(QueueNotProvidedError)
  })

  it('should throws UserIdNotProvidedError if _updateUserSettings called with empty userId', async () => {
    const service = new CommonSettingsService(
      makeConfig() as any,
      makeLogger() as any,
      makeDb() as any
    )
    await expect(
      service['_updateUserSettings']('', {
        payload: { avatar: 'avtar.png' },
        version: 1
      } as any)
    ).rejects.toThrow(UserIdNotProvidedError)
  })

  it('should throws UserSettingsNotProvidedError if _updateUserSettings called with missing payload', async () => {
    const service = new CommonSettingsService(
      makeConfig() as any,
      makeLogger() as any,
      makeDb() as any
    )
    await expect(
      service['_updateUserSettings']('user123', {
        payload: null,
        version: 1
      } as any)
    ).rejects.toThrow(UserSettingsNotProvidedError)
  })
})

describe('should handle the settings message', () => {
  let logger: MockLogger
  let db: MockDb
  let service: CommonSettingsService

  beforeEach(() => {
    logger = makeLogger()
    db = makeDb()
    service = new CommonSettingsService(
      makeConfig() as any,
      logger as any,
      db as any
    )
  })

  it.each([
    {
      created: true,
      oldSettings: null,
      expectedPayload: { displayName: 'Dwho', avatarUrl: 'avatar.png' },
      description: 'settings just created'
    },
    {
      created: false,
      oldSettings: { display_name: 'Rtyler', avatar: 'avatar.png' },
      expectedPayload: { displayName: 'Dwho' },
      description: 'old settings with different display name'
    },
    {
      created: false,
      oldSettings: { display_name: 'Dwho', avatar: 'old.png' },
      expectedPayload: { avatarUrl: 'avatar.png' },
      description: 'old settings with different avatar'
    },
    {
      created: false,
      oldSettings: { display_name: 'Rtyler', avatar: 'old.png' },
      expectedPayload: { displayName: 'Dwho', avatarUrl: 'avatar.png' },
      description: 'old settings with both changed'
    }
  ])(
    'should update user information correctly if $description',
    async ({ created, oldSettings, expectedPayload }) => {
      const fakeMsg = {
        content: Buffer.from(
          JSON.stringify({
            payload: {
              matrix_id: 'user123',
              display_name: 'Dwho',
              avatar: 'avatar.png'
            },
            version: 1
          })
        )
      }

      jest.spyOn(service as any, '_getOrCreateUserSettings').mockResolvedValue({
        userSettings:
          oldSettings != null ? { settings: JSON.stringify(oldSettings) } : {},
        created
      })

      const updateSpy = jest
        .spyOn(service as any, '_updateUserInformationWithRetry')
        .mockResolvedValue(undefined)

      jest
        .spyOn(service as any, '_updateUserSettings')
        .mockResolvedValue(undefined)

      await service['handleMessage'](fakeMsg)

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Received message'),
        expect.any(Object)
      )

      expect(updateSpy).toHaveBeenCalledWith('user123', expectedPayload)
    }
  )

  it('should skips invalid JSON', async () => {
    const fakeMsg = { content: Buffer.from('{invalid json}') }
    await service['handleMessage'](fakeMsg)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid JSON message received'),
      expect.any(Object),
      expect.any(String)
    )
  })

  it('should skips messages missing userId', async () => {
    const fakeMsg = {
      content: Buffer.from(
        JSON.stringify({ payload: { display_name: 'Dwho' }, version: 1 })
      )
    }
    await service['handleMessage'](fakeMsg)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid message payload: missing userId'),
      expect.any(Object)
    )
  })
})

describe('should handle the retries for the user information update', () => {
  let logger: MockLogger
  let db: MockDb
  let service: CommonSettingsService

  beforeEach(() => {
    logger = makeLogger()
    db = makeDb()
    service = new CommonSettingsService(
      makeConfig() as any,
      logger as any,
      db as any
    )
    ;(global as any).fetch = jest.fn().mockResolvedValue({ ok: true })
  })

  it('should succeeds first try', async () => {
    const spy = jest
      .spyOn(service as any, '_updateUserInformation')
      .mockResolvedValue(undefined)
    await service['_updateUserInformationWithRetry']('user123', {
      displayName: 'Dwho'
    })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('should fails once then succeeds', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const spy = jest
      .spyOn(service as any, '_updateUserInformation')
      .mockRejectedValueOnce(new Error('Temporary'))
      .mockResolvedValueOnce(undefined)
    await service['_updateUserInformationWithRetry']('user123', {
      displayName: 'Dwho'
    })
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Retry 1 for user user123 due to error'),
      expect.any(Object)
    )
  })

  it('should fails all retries → throws', async () => {
    jest
      .spyOn(service as any, '_updateUserInformation')
      .mockRejectedValue(new Error('Permanent'))
    await expect(
      service['_updateUserInformationWithRetry'](
        'user123',
        { displayName: 'Dwho' },
        2
      )
    ).rejects.toThrow('Permanent')
  })
})

describe('should handle the user information update', () => {
  let logger: MockLogger
  let db: MockDb

  beforeEach(() => {
    logger = makeLogger()
    db = makeDb()
  })

  it('should throw error if synapse_admin_server missing', async () => {
    const service = new CommonSettingsService(
      makeConfig({ synapse_admin_server: undefined }) as any,
      logger as any,
      db as any
    )
    await expect(
      service['_updateUserInformation']('user1', {} as any)
    ).rejects.toThrow('Synapse admin server URL or secret is not configured')
  })

  it('should throw error if synapse_admin_secret missing', async () => {
    const service = new CommonSettingsService(
      makeConfig({ synapse_admin_secret: undefined }) as any,
      logger as any,
      db as any
    )
    await expect(
      service['_updateUserInformation']('user1', {} as any)
    ).rejects.toThrow('Synapse admin server URL or secret is not configured')
  })

  it('should throw error if response not OK', async () => {
    const service = new CommonSettingsService(
      makeConfig() as any,
      logger as any,
      db as any
    )
    ;(global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Error',
      text: async () => 'failed'
    })
    await expect(
      service['_updateUserInformation']('user1', { displayName: 'Dwho' })
    ).rejects.toThrow('Failed to update display name: 500 Error - failed')
  })

  it('should resolves if response OK', async () => {
    const service = new CommonSettingsService(
      makeConfig() as any,
      logger as any,
      db as any
    )
    ;(global as any).fetch = jest.fn().mockResolvedValue({ ok: true })
    await expect(
      service['_updateUserInformation']('user1', { displayName: 'Dwho' })
    ).resolves.toBeUndefined()
  })
})

describe('should get or create user settings', () => {
  let logger: MockLogger
  let db: MockDb
  let service: CommonSettingsService

  beforeEach(() => {
    logger = makeLogger()
    db = makeDb()
    service = new CommonSettingsService(
      makeConfig() as any,
      logger as any,
      db as any
    )
  })

  it('should return existing settings', async () => {
    db.get.mockResolvedValue([{ id: 1, settings: '{}', version: 1 }])
    const result = await service['_getOrCreateUserSettings']('user1', {
      payload: { avatar: 'avatar.png' },
      version: 1
    } as any)
    expect(result.created).toBe(false)
  })

  it('should insert new settings', async () => {
    db.get.mockResolvedValue([])
    db.insert.mockResolvedValue({ id: 2, settings: '{}', version: 1 })
    const result = await service['_getOrCreateUserSettings']('user2', {
      payload: { avatar: 'avatar.png' },
      version: 1
    } as any)
    expect(result.created).toBe(true)
  })

  it('should throw an error if userId is empty', async () => {
    await expect(
      service['_getOrCreateUserSettings']('', {
        payload: {},
        version: 1
      } as any)
    ).rejects.toThrow('UserId is required')
  })

  it('should throw an error if settings payload is missing', async () => {
    await expect(
      service['_getOrCreateUserSettings']('user123', {
        version: 1
      } as any)
    ).rejects.toThrow('Settings payload is missing')
  })

  it('should log and rethrow error if db query fails', async () => {
    db.get.mockRejectedValue(new Error('DB failure'))
    await expect(
      service['_getOrCreateUserSettings']('user1', {
        payload: { avatar: 'avatar.png' },
        version: 1
      } as any)
    ).rejects.toThrow('DB failure')
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to get or create user settings'),
      expect.any(Object)
    )
  })
})

describe('should handle the user settings update', () => {
  let logger: MockLogger
  let db: MockDb
  let service: CommonSettingsService
  beforeEach(() => {
    logger = makeLogger()
    db = makeDb()
    service = new CommonSettingsService(
      makeConfig() as any,
      logger as any,
      db as any
    )
  })

  it('should update settings on the db', async () => {
    db.update.mockResolvedValue(undefined)
    await service['_updateUserSettings']('user1', {
      payload: { avatar: 'avatar.png' },
      version: 1
    } as any)
    expect(db.update).toHaveBeenCalledWith(
      'usersettings',
      { settings: '{"avatar":"avatar.png"}', version: 1 },
      'matrix_id',
      'user1'
    )
  })
})
