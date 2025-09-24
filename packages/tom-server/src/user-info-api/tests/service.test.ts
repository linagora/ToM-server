import { getLogger } from '@twake/logger'
import { type MatrixDB, UserDB } from '@twake/matrix-identity-server'
import { type NextFunction, type Response } from 'express'
import ldap from 'ldapjs'
import type { Config, TwakeDB } from '../../types'
import UserInfoService from '../services'

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
  })
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
      config as unknown as Config
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
    expect(user).toHaveProperty('uid', 'dwho')
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
      configWithCommon
    )

    const user = await serviceWithCommon.get('@dwho:docker.localhost')

    expect(user).not.toBeNull()
    expect(user).toHaveProperty('display_name', 'Dr Who')
    expect(user).toHaveProperty('givenName', 'David')
    expect(user).toHaveProperty('uid', 'dwho')
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
})
