import Service from '../services'
import type { TwakeLogger } from '@twake/logger'
import type { Config } from '../../../../types'

const is_direct_mask = {
  ban: 100,
  invite: 100,
  kick: 100,
  redact: 100,
  state_default: 100,
  users_default: 10,
  creator_becomes: 10,
  events: {
    'm.room.avatar': 10,
    'm.room.encryption': 10,
    'm.room.name': 100,
    'm.room.server_acl': 100,
    'm.room.tombstone': 10,
    'm.room.topic': 100
  }
}

const trusted_private_chat = {
  name: 'trusted_private_chat',
  default_visibility: 'private',
  allow_is_direct: true,
  users_default: 10,
  events_default: 10,
  invite: 10,
  state_default: 100,
  kick: 10,
  ban: 10,
  redact: 10,
  notifications: { room: 10 },
  events: {
    'm.reaction': 10,
    'm.room.redaction': 10,
    'm.room.pinned_events': 10,
    'org.matrix.msc3401.call': 10,
    'org.matrix.msc3401.call.member': 10,
    'm.room.name': 10,
    'm.room.topic': 10,
    'm.room.avatar': 10,
    'm.room.server_acl': 10,
    'm.room.tombstone': 10,
    'm.room.history_visibility': 10,
    'm.room.power_levels': 10,
    'm.room.encryption': 10
  },
  creator_becomes: 10
}

const private_chat = {
  name: 'private_chat',
  default_visibility: 'private',
  allow_is_direct: true,
  users_default: 10,
  events_default: 10,
  invite: 10,
  state_default: 90,
  kick: 50,
  ban: 50,
  redact: 50,
  notifications: { room: 10 },
  events: {
    'm.reaction': 10,
    'm.room.redaction': 10,
    'm.room.pinned_events': 10,
    'org.matrix.msc3401.call': 10,
    'org.matrix.msc3401.call.member': 10,
    'm.room.name': 80,
    'm.room.topic': 80,
    'm.room.avatar': 80,
    'm.room.server_acl': 80,
    'm.room.tombstone': 80,
    'm.room.history_visibility': 80,
    'm.room.power_levels': 80,
    'm.room.encryption': 90
  },
  creator_becomes: 90
}

const public_chat = {
  name: 'public_chat',
  default_visibility: 'public',
  allow_is_direct: false,
  users_default: 10,
  events_default: 10,
  invite: 0,
  state_default: 90,
  kick: 50,
  ban: 50,
  redact: 50,
  notifications: { room: 10 },
  events: {
    'm.reaction': 10,
    'm.room.redaction': 10,
    'm.room.pinned_events': 50,
    'org.matrix.msc3401.call': 50,
    'org.matrix.msc3401.call.member': 10,
    'm.room.name': 80,
    'm.room.topic': 80,
    'm.room.avatar': 80,
    'm.room.server_acl': 80,
    'm.room.tombstone': 80,
    'm.room.history_visibility': 80,
    'm.room.power_levels': 80,
    'm.room.encryption': 100
  },
  creator_becomes: 90
}

const private_channel = {
  name: 'private_channel',
  synapse_preset: 'private_chat',
  default_visibility: 'private',
  allow_is_direct: false,
  users_default: 10,
  events_default: 80,
  invite: 50,
  state_default: 90,
  kick: 50,
  ban: 50,
  redact: 80,
  notifications: { room: 80 },
  events: {
    'm.reaction': 10,
    'm.room.redaction': 80,
    'm.room.pinned_events': 50,
    'org.matrix.msc3401.call': 100,
    'org.matrix.msc3401.call.member': 100,
    'm.room.name': 80,
    'm.room.topic': 80,
    'm.room.avatar': 80,
    'm.room.server_acl': 80,
    'm.room.tombstone': 80,
    'm.room.history_visibility': 90,
    'm.room.power_levels': 50,
    'm.room.encryption': 90
  },
  creator_becomes: 90
}

const public_channel = {
  name: 'public_channel',
  synapse_preset: 'public_chat',
  default_visibility: 'public',
  allow_is_direct: false,
  users_default: 10,
  events_default: 80,
  invite: 0,
  state_default: 90,
  kick: 50,
  ban: 50,
  redact: 80,
  notifications: { room: 80 },
  events: {
    'm.reaction': 10,
    'm.room.redaction': 80,
    'm.room.pinned_events': 50,
    'org.matrix.msc3401.call': 100,
    'org.matrix.msc3401.call.member': 100,
    'm.room.name': 80,
    'm.room.topic': 80,
    'm.room.avatar': 80,
    'm.room.server_acl': 80,
    'm.room.tombstone': 80,
    'm.room.history_visibility': 100,
    'm.room.power_levels': 50,
    'm.room.encryption': 100
  },
  creator_becomes: 90
}

const loggerMock = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn()
}

const testConfig = {
  matrix_server: 'localhost',
  base_url: 'http://localhost',
  signup_url: 'https://signup.example.com/?app=chat',
  template_dir: './templates',
  matrix_admin_login: 'login',
  matrix_admin_password: 'password',
  matrix_internal_host: 'http://internal.server.com',
  features: {
    createroom_proxy: {
      on_failure: { max_retries: 3, nuke_room: true },
      default_preset: 'private_chat',
      encryption: 'allowed',
      is_direct_mask,
      presets: [
        trusted_private_chat,
        private_chat,
        public_chat,
        private_channel,
        public_channel
      ]
    }
  }
} as unknown as Config

const roomService = new Service(
  testConfig,
  loggerMock as unknown as TwakeLogger
)

describe('the RoomService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should call the synapse API to create a room with content override', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ room_id: 'room_id' }),
        clone: () => ({
          json: () => Promise.resolve({ room_id: 'room_id' }),
          text: () => Promise.resolve('')
        }),
        status: 200
      })
    ) as jest.Mock

    const {
      creator_becomes,
      default_visibility,
      allow_is_direct,
      name: _n1,
      ...config
    } = private_chat
    const ownerUser = '@user:server.com'
    const ownerUserLevel = 100
    roomService.create(
      { invite: [`${ownerUser}`] },
      'Bearer token',
      `${ownerUser}`
    )

    expect(global.fetch).toHaveBeenCalledWith(
      'http://internal.server.com/_matrix/client/v3/createRoom',
      {
        body: JSON.stringify({
          invite: ['@user:server.com'],
          preset: 'private_chat',
          visibility: 'private',
          is_direct: false,
          power_level_content_override: {
            ...config,
            users: {
              [ownerUser]: ownerUserLevel
            }
          }
        }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token'
        },
        method: 'POST'
      }
    )
  })

  it('should use appropriate power_level_content_override for public_chat', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ room_id: 'room_id' }),
        clone: () => ({
          json: () => Promise.resolve({ room_id: 'room_id' }),
          text: () => Promise.resolve('')
        }),
        status: 200
      })
    ) as jest.Mock

    const {
      creator_becomes,
      default_visibility,
      allow_is_direct,
      name: _n2,
      ...config
    } = public_chat
    const ownerUser = '@user:server.com'
    const ownerUserLevel = 100
    const invitedUser = '@user2:server.com'
    const invitedUserLevel = config.users_default
    roomService.create(
      {
        invite: [`${ownerUser}`, `${invitedUser}`],
        preset: 'public_chat'
      },
      'Bearer token',
      `${ownerUser}`
    )

    expect(global.fetch).toHaveBeenCalledWith(
      'http://internal.server.com/_matrix/client/v3/createRoom',
      {
        body: JSON.stringify({
          invite: ['@user:server.com', '@user2:server.com'],
          preset: 'public_chat',
          visibility: 'public',
          is_direct: false,
          power_level_content_override: {
            ...config,
            users: {
              [ownerUser]: ownerUserLevel,
              [invitedUser]: invitedUserLevel
            }
          }
        }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token'
        },
        method: 'POST'
      }
    )
  })

  it('should use trusted_private_chat own power levels (not shared with private_chat)', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ room_id: 'room_id' }),
        clone: () => ({
          json: () => Promise.resolve({ room_id: 'room_id' }),
          text: () => Promise.resolve('')
        }),
        status: 200
      })
    ) as jest.Mock

    const {
      creator_becomes,
      default_visibility,
      allow_is_direct,
      name: _n3,
      ...config
    } = trusted_private_chat
    const ownerUser = '@user:server.com'

    roomService.create(
      { preset: 'trusted_private_chat', invite: [ownerUser] },
      'Bearer token',
      ownerUser
    )

    expect(global.fetch).toHaveBeenCalledWith(
      'http://internal.server.com/_matrix/client/v3/createRoom',
      expect.objectContaining({
        body: JSON.stringify({
          preset: 'trusted_private_chat',
          invite: [ownerUser],
          visibility: 'private',
          is_direct: false,
          power_level_content_override: {
            ...config,
            users: { [ownerUser]: 100 }
          }
        })
      })
    )

    // trusted_private_chat has ban=10, private_chat has ban=50
    const callBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    )
    expect(callBody.power_level_content_override.ban).toBe(10)
    expect(callBody.power_level_content_override.state_default).toBe(100)
  })

  it('should apply is_direct mask over private_chat when is_direct=true', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ room_id: 'room_id' }),
        clone: () => ({
          json: () => Promise.resolve({ room_id: 'room_id' }),
          text: () => Promise.resolve('')
        }),
        status: 200
      })
    ) as jest.Mock

    const ownerUser = '@user:server.com'

    roomService.create(
      { preset: 'private_chat', is_direct: true, invite: [ownerUser] },
      'Bearer token',
      ownerUser
    )

    const callBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    )
    const pl = callBody.power_level_content_override

    // is_direct mask overrides
    expect(pl.ban).toBe(100)
    expect(pl.invite).toBe(100)
    expect(pl.kick).toBe(100)
    expect(pl.redact).toBe(100)
    expect(pl.state_default).toBe(100)
    expect(pl.users_default).toBe(10)
    expect(pl.events['m.room.name']).toBe(100)
    expect(pl.events['m.room.avatar']).toBe(10)

    // Keys absent from mask are preserved from private_chat
    expect(pl.events_default).toBe(private_chat.events_default)
    expect(pl.events['m.reaction']).toBe(private_chat.events['m.reaction'])
  })

  it('should force is_direct=false for public_chat even if client sends true', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ room_id: 'room_id' }),
        clone: () => ({
          json: () => Promise.resolve({ room_id: 'room_id' }),
          text: () => Promise.resolve('')
        }),
        status: 200
      })
    ) as jest.Mock

    const ownerUser = '@user:server.com'

    roomService.create(
      { preset: 'public_chat', is_direct: true, invite: [ownerUser] },
      'Bearer token',
      ownerUser
    )

    const callBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    )
    expect(callBody.is_direct).toBe(false)
    // public_chat power levels used (not is_direct overrides)
    expect(callBody.power_level_content_override.ban).toBe(public_chat.ban)
  })

  it('should force is_direct=false for private_channel', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ room_id: 'room_id' }),
        clone: () => ({
          json: () => Promise.resolve({ room_id: 'room_id' }),
          text: () => Promise.resolve('')
        }),
        status: 200
      })
    ) as jest.Mock

    const ownerUser = '@user:server.com'

    roomService.create(
      { preset: 'private_channel', is_direct: true, invite: [ownerUser] },
      'Bearer token',
      ownerUser
    )

    const callBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    )
    expect(callBody.is_direct).toBe(false)
    // Forwarded to Synapse as private_chat
    expect(callBody.preset).toBe('private_chat')
  })

  it('should return a 500 response if something went wrong', async () => {
    global.fetch = jest.fn(() =>
      Promise.reject({
        status: 500,
        json: () => Promise.reject({ error: 'error' })
      })
    ) as jest.Mock

    const response = await roomService.create(
      { invite: ['@user:server.com'] },
      'Bearer token',
      '@user:server.com'
    )

    expect(response.status).toEqual(500)
  })

  it('should not retry on HTTP 500 from Synapse', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        clone: () => ({ text: () => Promise.resolve('error') })
      })
    ) as jest.Mock

    const response = await roomService.create(
      { invite: ['@user:server.com'] },
      'Bearer token',
      '@user:server.com'
    )

    // Only one call — no retry on HTTP responses
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(1)
    expect(response.status).toBe(500)
  })

  it('should derive preset from visibility=public when no preset given', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ room_id: 'room_id' }),
        clone: () => ({
          json: () => Promise.resolve({ room_id: 'room_id' }),
          text: () => Promise.resolve('')
        }),
        status: 200
      })
    ) as jest.Mock

    const ownerUser = '@user:server.com'

    roomService.create(
      { visibility: 'public', invite: [ownerUser] },
      'Bearer token',
      ownerUser
    )

    const callBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    )
    expect(callBody.preset).toBe('public_chat')
    expect(callBody.visibility).toBe('public')
  })

  it('should use default_preset from config when no preset or visibility given', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ room_id: 'room_id' }),
        clone: () => ({
          json: () => Promise.resolve({ room_id: 'room_id' }),
          text: () => Promise.resolve('')
        }),
        status: 200
      })
    ) as jest.Mock

    const ownerUser = '@user:server.com'

    roomService.create({ invite: [ownerUser] }, 'Bearer token', ownerUser)

    const callBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    )
    // default_preset in testConfig is 'private_chat'
    expect(callBody.preset).toBe('private_chat')
    expect(callBody.visibility).toBe('private')
  })

  it('should inject m.room.encryption when encryption=enforced', async () => {
    const enforcedConfig = {
      ...testConfig,
      features: {
        ...testConfig.features,
        createroom_proxy: {
          ...testConfig.features.createroom_proxy,
          encryption: 'enforced'
        }
      }
    } as unknown as Config

    const Service = (await import('../services')).default
    const enforcedService = new Service(
      enforcedConfig,
      loggerMock as unknown as TwakeLogger
    )

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ room_id: 'room_id' }),
        clone: () => ({
          json: () => Promise.resolve({ room_id: 'room_id' }),
          text: () => Promise.resolve('')
        }),
        status: 200
      })
    ) as jest.Mock

    const ownerUser = '@user:server.com'
    enforcedService.create({ invite: [ownerUser] }, 'Bearer token', ownerUser)

    const callBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    )
    const encEvent = (callBody.initial_state ?? []).find(
      (e: { type: string }) => e.type === 'm.room.encryption'
    )
    expect(encEvent).toBeDefined()
    expect(encEvent.content.algorithm).toBe('m.megolm.v1.aes-sha2')
  })

  it('should not inject m.room.encryption twice when already in initial_state and encryption=enforced', async () => {
    const enforcedConfig = {
      ...testConfig,
      features: {
        ...testConfig.features,
        createroom_proxy: {
          ...testConfig.features.createroom_proxy,
          encryption: 'enforced'
        }
      }
    } as unknown as Config

    const Service = (await import('../services')).default
    const enforcedService = new Service(
      enforcedConfig,
      loggerMock as unknown as TwakeLogger
    )

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ room_id: 'room_id' }),
        clone: () => ({
          json: () => Promise.resolve({ room_id: 'room_id' }),
          text: () => Promise.resolve('')
        }),
        status: 200
      })
    ) as jest.Mock

    const ownerUser = '@user:server.com'
    enforcedService.create(
      {
        invite: [ownerUser],
        initial_state: [
          {
            type: 'm.room.encryption',
            state_key: '',
            content: { algorithm: 'm.megolm.v1.aes-sha2' }
          }
        ]
      },
      'Bearer token',
      ownerUser
    )

    const callBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    )
    const encEvents = (callBody.initial_state ?? []).filter(
      (e: { type: string }) => e.type === 'm.room.encryption'
    )
    expect(encEvents.length).toBe(1)
  })

  it('should strip m.room.encryption from initial_state when encryption=disabled', async () => {
    const disabledConfig = {
      ...testConfig,
      features: {
        ...testConfig.features,
        createroom_proxy: {
          ...testConfig.features.createroom_proxy,
          encryption: 'disabled'
        }
      }
    } as unknown as Config

    const Service = (await import('../services')).default
    const disabledService = new Service(
      disabledConfig,
      loggerMock as unknown as TwakeLogger
    )

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ room_id: 'room_id' }),
        clone: () => ({
          json: () => Promise.resolve({ room_id: 'room_id' }),
          text: () => Promise.resolve('')
        }),
        status: 200
      })
    ) as jest.Mock

    const ownerUser = '@user:server.com'
    disabledService.create(
      {
        invite: [ownerUser],
        initial_state: [
          {
            type: 'm.room.encryption',
            state_key: '',
            content: { algorithm: 'm.megolm.v1.aes-sha2' }
          },
          {
            type: 'm.room.name',
            state_key: '',
            content: { name: 'Test Room' }
          }
        ]
      },
      'Bearer token',
      ownerUser
    )

    const callBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    )
    const encEvent = (callBody.initial_state ?? []).find(
      (e: { type: string }) => e.type === 'm.room.encryption'
    )
    expect(encEvent).toBeUndefined()
    // Other events should be preserved
    const nameEvent = (callBody.initial_state ?? []).find(
      (e: { type: string }) => e.type === 'm.room.name'
    )
    expect(nameEvent).toBeDefined()
  })
})
