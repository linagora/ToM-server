import Service from '../services'
import { type TwakeLogger } from '@twake/logger'
import { type Config } from '../../../../types'

const direct_chat = {
  users_default: 0,
  events_default: 10,
  invite: 100,
  state_default: 100,
  kick: 100,
  ban: 100,
  redact: 100,
  notifications: {
    room: 100
  },
  events: {
    'm.reaction': 10,
    'm.room.redaction': 10,
    'm.room.pinned_events': 10,
    'org.matrix.msc3401.call': 10,
    'org.matrix.msc3401.call.member': 10,
    'm.room.name': 100,
    'm.room.topic': 100,
    'm.room.avatar': 100,
    'm.room.history_visibility': 100,
    'm.room.power_levels': 100,
    'm.room.encryption': 10
  }
}

const private_group_chat = {
  users_default: 10,
  events_default: 10,
  invite: 50,
  state_default: 100,
  kick: 50,
  ban: 50,
  redact: 50,
  notifications: {
    room: 10
  },
  events: {
    'm.reaction': 10,
    'm.room.redaction': 10,
    'm.room.pinned_events': 10,
    'org.matrix.msc3401.call': 10,
    'org.matrix.msc3401.call.member': 10,
    'm.room.name': 80,
    'm.room.topic': 80,
    'm.room.avatar': 80,
    'm.room.history_visibility': 80,
    'm.room.power_levels': 80,
    'm.room.encryption': 80
  }
}

const public_group_chat = {
  users_default: 10,
  events_default: 10,
  invite: 0,
  state_default: 100,
  kick: 50,
  ban: 50,
  redact: 50,
  notifications: {
    room: 10
  },
  events: {
    'm.reaction': 10,
    'm.room.redaction': 10,
    'm.room.pinned_events': 50,
    'org.matrix.msc3401.call': 50,
    'org.matrix.msc3401.call.member': 10,
    'm.room.name': 80,
    'm.room.topic': 80,
    'm.room.avatar': 80,
    'm.room.history_visibility': 80,
    'm.room.power_levels': 80,
    'm.room.encryption': 90
  }
}

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn()
}

const roomService = new Service(
  {
    matrix_server: 'localhost',
    base_url: 'http://localhost',
    signup_url: 'https://signup.example.com/?app=chat',
    template_dir: './templates',
    matrix_admin_login: 'login',
    matrix_admin_password: 'password',
    matrix_internal_host: 'http://internal.server.com',
    room_permissions: {
      direct_chat,
      private_group_chat,
      public_group_chat,
      private_channel: {
        users_default: 10,
        events_default: 80,
        invite: 50,
        state_default: 100,
        kick: 50,
        ban: 50,
        redact: 80,
        notifications: {
          room: 80
        },
        events: {
          'm.reaction': 10,
          'm.room.redaction': 80,
          'm.room.pinned_events': 50,
          'org.matrix.msc3401.call': 100,
          'org.matrix.msc3401.call.member': 100,
          'm.room.name': 80,
          'm.room.topic': 80,
          'm.room.avatar': 80,
          'm.room.history_visibility': 90,
          'm.room.power_levels': 50,
          'm.room.encryption': 90
        }
      },
      public_channel: {
        users_default: 10,
        events_default: 80,
        invite: 0,
        state_default: 100,
        kick: 50,
        ban: 50,
        redact: 80,
        notifications: {
          room: 80
        },
        events: {
          'm.reaction': 10,
          'm.room.redaction': 80,
          'm.room.pinned_events': 50,
          'org.matrix.msc3401.call': 100,
          'org.matrix.msc3401.call.member': 100,
          'm.room.name': 80,
          'm.room.topic': 80,
          'm.room.avatar': 80,
          'm.room.history_visibility': 100,
          'm.room.power_levels': 50,
          'm.room.encryption': 100
        }
      }
    }
  } as unknown as Config,
  loggerMock as unknown as TwakeLogger
)
describe('the RoomService', () => {
  it('should call the synapse API to create a room with content override', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ room_id: 'room_id' })
      })
    ) as jest.Mock

    roomService.create({ invite: ['@user:server.com'] }, 'Bearer token', '@user:server.com')

    expect(global.fetch).toHaveBeenCalledWith(
      'http://internal.server.com/_matrix/client/v3/createRoom',
      {
        body: JSON.stringify({
          invite: ['@user:server.com'],
          power_level_content_override: direct_chat
        }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token'
        },
        method: 'POST'
      }
    )
  })

  it('should use oppropriate power_level_content_override', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ room_id: 'room_id' })
      })
    ) as jest.Mock

    roomService.create(
      {
        invite: ['@user:server.com', '@user2:server.com'],
        preset: 'public_chat'
      },
      'Bearer token',
      '@user:server.com'
    )

    expect(global.fetch).toHaveBeenCalledWith(
      'http://internal.server.com/_matrix/client/v3/createRoom',
      {
        body: JSON.stringify({
          invite: ['@user:server.com', '@user2:server.com'],
          preset: 'public_chat',
          power_level_content_override: public_group_chat
        }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token'
        },
        method: 'POST'
      }
    )
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
})
