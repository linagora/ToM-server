import { getLogger } from '@twake/logger'
import { type MatrixDB, UserDB } from '@twake/matrix-identity-server'
import { type NextFunction, type Response } from 'express'
import ldap from 'ldapjs'
import type { Config, TwakeDB } from '../../types'
import UserInfoService from '../services'
import {
  ProfileField,
  ProfileVisibility,
  type UserProfileSettingsPayloadT
} from '../types'

const server = ldap.createServer()

interface LDAPRequest extends ldap.SearchRequest {
  filter: ldap.Filter
  dn: string
}

const config = {
  userdb_engine: 'ldap',
  ldap_uri: 'ldap://localhost:63389',
  ldap_base: 'ou=users,o=example',
  additional_features: true,
  features: { common_settings: { enabled: false } } as any
}

const logger = getLogger()

const twakeDBMock = {
  get: jest.fn().mockImplementation(async (table, _fields, query) => {
    if (table === 'usersettings' && query.matrix_id != null) {
      return [
        {
          matrix_id: query.matrix_id,
          settings: {
            language: 'fr',
            timezone: 'Europe/Paris'
          }
        }
      ]
    }
    return []
  }),
  insert: jest.fn().mockImplementation(async (table, values) => {
    if (table === 'profileSettings') {
      return [{ ...values }]
    }
  }),
  update: jest.fn()
}

const matrixDBMock: Partial<MatrixDB> = {
  get: jest
    .fn()
    .mockResolvedValue([{ displayname: 'Dr Who', avatar_url: 'avatar_url' }])
} as unknown as Partial<MatrixDB>

let userDb: UserDB
let service: UserInfoService

beforeAll((done) => {
  server.search(
    'ou=users, o=example',
    (req: LDAPRequest, res: Response, _next: NextFunction) => {
      const obj = {
        dn: req.dn.toString(),
        attributes: {
          objectClass: ['inetOrgPerson'],
          uid: 'dwho',
          cn: 'David Who',
          sn: 'Who',
          givenName: 'David'
        }
      }

      if (req.filter.matches(obj.attributes)) {
        res.send(obj)
      }

      res.end()
    }
  )

  server.listen(63389, 'localhost', async () => {
    userDb = new UserDB(config as unknown as Config, logger)
    await userDb.ready
    service = new UserInfoService(
      userDb,
      twakeDBMock as unknown as TwakeDB,
      matrixDBMock as unknown as MatrixDB,
      config as unknown as Config,
      logger
    )
    done()
  })
})

afterAll((done) => {
  logger.close()
  server.close(done)
})

describe('user info service', () => {
  it('should return the user info', async () => {
    const user = await service.get('@dwho:docker.localhost')

    expect(user).not.toBeNull()
    expect(user).toHaveProperty('display_name', 'Dr Who')
    expect(user).toHaveProperty('givenName', 'David')
    expect(user).toHaveProperty('uid', '@dwho:docker.localhost')
    expect(user).toHaveProperty('sn', 'Who')
  })

  it('should return the user info when common settings is enabled', async () => {
    const configWithCommon = {
      ...config,
      features: { common_settings: { enabled: true } }
    } as unknown as Config

    const userDbWithCommon = new UserDB(configWithCommon, logger)
    await userDbWithCommon.ready

    const serviceWithCommon = new UserInfoService(
      userDbWithCommon,
      twakeDBMock as unknown as TwakeDB,
      matrixDBMock as unknown as MatrixDB,
      configWithCommon,
      logger
    )

    const user = await serviceWithCommon.get('@dwho:docker.localhost')

    expect(user).not.toBeNull()
    expect(user).toHaveProperty('display_name', 'Dr Who')
    expect(user).toHaveProperty('givenName', 'David')
    expect(user).toHaveProperty('uid', '@dwho:docker.localhost')
    expect(user).toHaveProperty('sn', 'Who')
    expect(user).toHaveProperty('language', 'fr')
    expect(user).toHaveProperty('timezone', 'Europe/Paris')
  })

  it('should return null if matrix id is invalid', async () => {
    const cases = [
      'dwho', // no '@' and no ':'
      '@dwho', // missing domain
      'dwho:matrix.org', // missing '@'
      '' // empty string
    ]

    for (const invalidId of cases) {
      const user = await service.get(invalidId)
      expect(user).toBeNull()
    }
  })

  it('should return null if matrix user not found', async () => {
    ;(matrixDBMock.get as jest.Mock).mockResolvedValueOnce([])

    const user = await service.get('@notfound:docker.localhost')
    expect(user).toBeNull()
  })

  it('should create new profile visibility settings if none exist', async () => {
    const userId = '@dwho:matrix.org'
    twakeDBMock.get.mockResolvedValueOnce([])

    const payload: UserProfileSettingsPayloadT = {
      visibility: ProfileVisibility.Contacts,
      visible_fields: [ProfileField.Email]
    }

    const result = await service.updateVisibility(userId, payload)
    expect(result).toBeTruthy()
    expect(result).toMatchObject([
      {
        matrix_id: userId,
        visibility: ProfileVisibility.Contacts,
        visible_fields: [ProfileField.Email]
      }
    ])
    // verify DB insert called with correct full object
    expect(twakeDBMock.insert).toHaveBeenCalledWith('profileSettings', {
      matrix_id: userId,
      ...payload
    })
  })

  it('should update existing profile visibility settings if they exist', async () => {
    const userId = '@dwho:matrix.org'

    twakeDBMock.get.mockResolvedValueOnce([
      {
        matrix_id: userId,
        visibility: ProfileVisibility.Private,
        visible_fields: [ProfileField.Phone]
      }
    ])

    const payload: UserProfileSettingsPayloadT = {
      visibility: ProfileVisibility.Public,
      visible_fields: [ProfileField.Email, ProfileField.Phone]
    }

    const result = await service.updateVisibility(userId, payload)

    expect(result).toBeUndefined()
    expect(twakeDBMock.update).toHaveBeenCalledWith(
      'profileSettings',
      payload,
      'matrix_id',
      userId
    )
  })

  it('returns directory info when matrix profile is missing but additional_features is ON', async () => {
    ;(matrixDBMock.get as jest.Mock).mockResolvedValueOnce([])
    const user = await service.get('@dwho:docker.localhost')

    expect(user).not.toBeNull()
    expect(user).toHaveProperty('display_name', 'David Who')
    expect(user).toHaveProperty('sn', 'Who')
    expect(user).toHaveProperty('givenName', 'David')
    // The LDAP mock does **not** contain a `mail` attribute, therefore the service must not add a `mails` field.
    expect(user).not.toHaveProperty('mails')
  })

  it('returns null when matrix profile missing AND additional_features is OFF', async () => {
    ;(matrixDBMock.get as jest.Mock).mockResolvedValueOnce([])

    const cfg = {
      ...config,
      additional_features: false,
      features: { common_settings: { enabled: false } }
    } as unknown as Config

    const svc = new UserInfoService(
      userDb,
      twakeDBMock as unknown as TwakeDB,
      matrixDBMock as unknown as MatrixDB,
      cfg,
      logger
    )

    const user = await svc.get('@dwho:docker.localhost')
    expect(user).toBeNull()
  })

  it('does NOT expose language / timezone when common_settings feature flag is OFF', async () => {
    const cfg = {
      ...config,
      additional_features: true,
      features: { common_settings: { enabled: false } }
    } as unknown as Config

    const svc = new UserInfoService(
      userDb,
      twakeDBMock as unknown as TwakeDB,
      matrixDBMock as unknown as MatrixDB,
      cfg,
      logger
    )

    const user = await svc.get('@dwho:docker.localhost')
    expect(user).not.toBeNull()
    expect(user).not.toHaveProperty('language')
    expect(user).not.toHaveProperty('timezone')
  })

  it('still returns language / timezone when common_settings feature flag is ON', async () => {
    const cfg = {
      ...config,
      additional_features: true,
      features: { common_settings: { enabled: true } }
    } as unknown as Config

    const svc = new UserInfoService(
      userDb,
      twakeDBMock as unknown as TwakeDB,
      matrixDBMock as unknown as MatrixDB,
      cfg,
      logger
    )

    const user = await svc.get('@dwho:docker.localhost')
    expect(user).not.toBeNull()
    expect(user).toHaveProperty('language', 'fr')
    expect(user).toHaveProperty('timezone', 'Europe/Paris')
  })

  it('propagates avatar_url as avatar when present', async () => {
    ;(matrixDBMock.get as jest.Mock).mockResolvedValueOnce([
      { displayname: 'Dr Who', avatar_url: 'http://example.com/avatar.png' }
    ])
    const user = await service.get('@dwho:docker.localhost')
    expect(user).toHaveProperty('avatar', 'http://example.com/avatar.png')
  })

  it('does not expose avatar when avatar_url is missing', async () => {
    ;(matrixDBMock.get as jest.Mock).mockResolvedValueOnce([
      { displayname: 'Dr Who' }
    ])
    const user = await service.get('@dwho:docker.localhost')
    expect(user).not.toHaveProperty('avatar')
  })

  it('uses LDAP cn as display_name when Matrix displayname is missing', async () => {
    ;(matrixDBMock.get as jest.Mock).mockResolvedValueOnce([
      { avatar_url: 'avatar_url' }
    ])
    const user = await service.get('@dwho:docker.localhost')
    expect(user).toHaveProperty('display_name', 'David Who')
  })

  it('returns null when only uid is present in the result', async () => {
    ;(matrixDBMock.get as jest.Mock).mockResolvedValueOnce([{}])
    ;(userDb.db.get as jest.Mock).mockResolvedValueOnce([])
    const user = await service.get('@dwho:docker.localhost')
    expect(user).toBeNull()
  })

  it('re‑throws a wrapped error when an internal query fails', async () => {
    const brokenMatrix = {
      get: jest.fn().mockRejectedValue(new Error('boom'))
    } as unknown as MatrixDB
    const svc = new UserInfoService(
      userDb,
      twakeDBMock as unknown as TwakeDB,
      brokenMatrix,
      config as unknown as Config,
      logger
    )
    await expect(svc.get('@dwho:docker.localhost')).rejects.toMatchObject({
      message: expect.stringContaining('Error getting user info'),
      cause: expect.any(Error)
    })
  })

  it('honors the env var FEATURE_COMMON_SETTINGS_ENABLED', async () => {
    process.env.FEATURE_COMMON_SETTINGS_ENABLED = 'true'
    const cfg = {
      ...config,
      features: { common_settings: { enabled: false } } as any
    }
    const svc = new UserInfoService(
      userDb,
      twakeDBMock as unknown as TwakeDB,
      matrixDBMock as unknown as MatrixDB,
      cfg as unknown as Config,
      logger
    )
    const user = await svc.get('@dwho:docker.localhost')
    expect(user).toHaveProperty('language', 'fr')
    expect(user).toHaveProperty('timezone', 'Europe/Paris')
    delete process.env.FEATURE_COMMON_SETTINGS_ENABLED
  })

  it('honors the env var ADDITIONAL_FEATURES', async () => {
    process.env.ADDITIONAL_FEATURES = 'true'
    const cfg = { ...config, additional_features: false }
    const svc = new UserInfoService(
      userDb,
      twakeDBMock as unknown as TwakeDB,
      matrixDBMock as unknown as MatrixDB,
      cfg as unknown as Config,
      logger
    )
    ;(matrixDBMock.get as jest.Mock).mockResolvedValueOnce([])
    const user = await svc.get('@dwho:docker.localhost')
    expect(user).toHaveProperty('sn')
    delete process.env.ADDITIONAL_FEATURES
  })

  it('uses the first LDAP entry when multiple rows are returned', async () => {
    const ldapMock = {
      db: {
        get: jest.fn().mockResolvedValueOnce([
          { cn: 'First', sn: 'One', givenName: 'Alpha' },
          { cn: 'Second', sn: 'Two', givenName: 'Beta' }
        ])
      }
    }
    const svc = new UserInfoService(
      ldapMock as unknown as UserDB,
      twakeDBMock as unknown as TwakeDB,
      matrixDBMock as unknown as MatrixDB,
      config as unknown as Config,
      logger
    )
    const user = await svc.get('@dwho:docker.localhost')
    expect(user?.sn).toBe('One')
    expect(user?.givenName).toBe('Alpha')
  })

  it('passes the exact matrix id to the usersettings query', async () => {
    const spy = jest.spyOn(twakeDBMock, 'get')
    await service.get('@dwho:docker.localhost')
    expect(spy).toHaveBeenCalledWith('usersettings', ['*'], {
      matrix_id: '@dwho:docker.localhost'
    })
  })
})
