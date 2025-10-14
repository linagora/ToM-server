import { getLogger } from '@twake/logger'
import { type MatrixDB, UserDB } from '@twake/matrix-identity-server'
import { type NextFunction, type Response } from 'express'
import ldap from 'ldapjs'
import type { Config, TwakeDB } from '../../types'
import UserInfoService from '../services'
import type { UserProfileSettingsPayloadT } from '../types'

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
      visibility: 'contacts',
      visible_fields: ['email']
    }

    const result = await service.updateVisibility(userId, payload)
    expect(result).toBeTruthy()
    expect(result).toMatchObject([
      {
        matrix_id: userId,
        visibility: 'contacts',
        visible_fields: ['email']
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
        visibility: 'private',
        visible_fields: ['phone']
      }
    ])

    const payload: UserProfileSettingsPayloadT = {
      visibility: 'public',
      visible_fields: ['email', 'phone']
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
})
