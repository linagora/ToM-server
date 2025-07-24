import { getLogger, type TwakeLogger } from '@twake/logger'
import ldapjs from 'ldapjs'
import defaultConfig from '../config.json'
import UserDBLDAP from './ldap'

const server = ldapjs.createServer()

const logger: TwakeLogger = getLogger()

beforeAll((done) => {
  // @ts-ignore
  server.search('ou=users, o=example', (req, res, next) => {
    const entries = [
      {
        dn: 'cn=dwho,ou=users,o=example',
        attributes: {
          objectClass: ['inetOrgPerson'],
          uid: 'dwho',
          sn: ['doctor'],
          givenName: 'Doctor',
          mail: 'dwho@example.com',
          age: 950
        }
      },
      {
        dn: 'cn=jdoe,ou=users,o=example',
        attributes: {
          objectClass: ['inetOrgPerson'],
          uid: 'jdoe',
          sn: ['doe'],
          givenName: 'John',
          mail: 'jdoe@example.com',
          age: 30
        }
      },
      {
        dn: 'cn=asmith,ou=users,o=example',
        attributes: {
          objectClass: ['inetOrgPerson'],
          uid: 'asmith',
          sn: ['smith'],
          givenName: 'Anna',
          mail: 'asmith@example.com',
          age: 25
        }
      }
    ]

    entries.forEach((entry) => {
      if (req.filter.matches(entry.attributes)) {
        res.send(entry)
      }
    })
    res.end()
  })

  server.listen(63389, 'localhost', () => {
    done()
  })
})

afterAll((done) => {
  logger.close()
  server.close(() => {
    done()
  })
})

describe('UserDBLDAP', () => {
  let userDB: UserDBLDAP

  const createUserDB = (
    ldapUri: string = 'ldap://localhost:63389',
    ldapBase: string = 'ou=users,o=example',
    ldapUser?: string,
    ldapPassword?: string
  ) => {
    return new UserDBLDAP(
      {
        ...defaultConfig,
        database_engine: 'sqlite',
        userdb_engine: 'ldap',
        ldap_uri: ldapUri,
        ldap_base: ldapBase,
        ldap_user: ldapUser,
        ldap_password: ldapPassword
      },
      logger
    )
  }

  it('should initialize and connect to LDAP successfully', async () => {
    userDB = createUserDB()
    await expect(userDB.ready).resolves.toBeUndefined()
  })

  it('should return results with default fields for a single filter', async () => {
    userDB = createUserDB()
    await userDB.ready
    const list = await userDB.get('', [], { uid: 'dwho' })
    expect(list.length).toBe(1)
    expect(list[0].uid).toBe('dwho')
    expect(list[0].sn).toBe('doctor')
    expect(list[0].dn).toBe('cn=dwho,ou=users,o=example')
    expect(list[0].objectClass).toBe('inetOrgPerson')
  })

  it('should return results with specified fields', async () => {
    userDB = createUserDB()
    await userDB.ready
    const list = await userDB.get('', ['uid', 'mail'], { uid: 'jdoe' })
    expect(list.length).toBe(1)
    expect(list[0]).toEqual({ uid: 'jdoe', mail: 'jdoe@example.com' })
    expect(list[0].sn).toBeUndefined()
  })

  it('should return results for multiple filter fields using OR logic', async () => {
    userDB = createUserDB()
    await userDB.ready
    const list = await userDB.get('', ['uid', 'sn'], {
      uid: 'dwho',
      sn: ['doe']
    })
    expect(list.length).toBe(2)
    const uids = list.map((entry) => entry.uid).sort()
    expect(uids).toEqual(['dwho', 'jdoe'])
    expect(
      list.some((entry) => entry.uid === 'dwho' && entry.sn === 'doctor')
    ).toBe(true)
    expect(
      list.some((entry) => entry.uid === 'jdoe' && entry.sn === 'doe')
    ).toBe(true)
  })

  it('should return an empty list if no match is found', async () => {
    userDB = createUserDB()
    await userDB.ready
    const list = await userDB.get('', [], { uid: 'nonexistent' })
    expect(list.length).toBe(0)
  })

  it('should display error message on connection error during ready state', async () => {
    userDB = createUserDB(
      'ldap://falsy:63389',
      'ou=users,o=example',
      'cn=admin',
      'root'
    )
    const loggerErrorSpy = jest.spyOn(logger, 'error')
    await userDB.ready
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to test ldap:')
    )
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('URI: ldap://falsy:63389')
    )
    loggerErrorSpy.mockRestore()
  })

  it('should provide match results with wildcard search', async () => {
    userDB = createUserDB()
    await userDB.ready
    const list = await userDB.match('', ['uid', 'sn'], ['uid', 'sn'], 'do')
    expect(list.length).toBe(2)
    const uids = list.map((entry) => entry.uid).sort()
    expect(uids).toEqual(['dwho', 'jdoe'])
  })

  it('should provide getAll results with all entries', async () => {
    userDB = createUserDB()
    await userDB.ready
    const list = await userDB.getAll('', ['uid', 'sn'])
    expect(list.length).toBe(3)
    const uids = list.map((entry) => entry.uid).sort()
    expect(uids).toEqual(['asmith', 'dwho', 'jdoe'])
  })

  it('should provide getAll results with order by a string field', async () => {
    userDB = createUserDB()
    await userDB.ready
    const list = await userDB.getAll('', ['uid', 'sn'], 'uid')
    expect(list.length).toBe(3)
    expect(list[0].uid).toBe('asmith')
    expect(list[1].uid).toBe('dwho')
    expect(list[2].uid).toBe('jdoe')
  })

  it('should provide getAll results with order by a numeric field', async () => {
    userDB = createUserDB()
    await userDB.ready
    const list = await userDB.getAll('', ['uid', 'age'], 'age')
    expect(list.length).toBe(3)
    expect(list[0].uid).toBe('asmith')
    expect(list[1].uid).toBe('jdoe')
    expect(list[2].uid).toBe('dwho')
  })

  it('should handle empty filterFields in get method', async () => {
    userDB = createUserDB()
    await userDB.ready
    const list = await userDB.get('', ['uid'])
    expect(list.length).toBe(3)
    const uids = list.map((entry) => entry.uid).sort()
    expect(uids).toEqual(['asmith', 'dwho', 'jdoe'])
  })

  it('should handle empty searchFields in match method gracefully (though usually not intended)', async () => {
    userDB = createUserDB()
    await userDB.ready
    const list = await userDB.match('', ['uid'], [], 'anyvalue')
    expect(list.length).toBe(0)
  })

  it('should handle close method without error', () => {
    userDB = createUserDB()
    expect(() => userDB.close()).not.toThrow()
  })
})
