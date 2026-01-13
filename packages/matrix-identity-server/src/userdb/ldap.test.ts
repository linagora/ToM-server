import { getLogger, type TwakeLogger } from '@twake-chat/logger'
import ldapjs, { type Server } from 'ldapjs'
import defaultConfig from '../config.json' with { type: "json" }
import UserDBLDAP from './ldap.ts'

// Test data constants
const LDAP_PORT = 63389
const LDAP_HOST = 'localhost'
const LDAP_BASE = 'ou=users,o=example'
const LDAP_URI = `ldap://${LDAP_HOST}:${LDAP_PORT}`

const TEST_USERS = [
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
  },
  {
    dn: 'cn=lskywalker,ou=users,o=example',
    attributes: {
      objectClass: ['inetOrgPerson'],
      uid: 'lskywalker',
      sn: ['skywalker'],
      givenName: 'Luke',
      mail: 'lskywalker@example.com',
      age: 23
    }
  }
]

describe('UserDBLDAP', () => {
  let server: Server
  let logger: TwakeLogger
  let userDB: UserDBLDAP

  // Helper function to create UserDB instance with default/custom config
  const createUserDB = (overrides?: {
    ldapUri?: string
    ldapBase?: string
    ldapUser?: string
    ldapPassword?: string
  }): UserDBLDAP => {
    return new UserDBLDAP(
      {
        ...defaultConfig,
        database_engine: 'sqlite',
        userdb_engine: 'ldap',
        ldap_uri: overrides?.ldapUri ?? LDAP_URI,
        ldap_base: overrides?.ldapBase ?? LDAP_BASE,
        ldap_user: overrides?.ldapUser,
        ldap_password: overrides?.ldapPassword
      },
      logger
    )
  }

  beforeAll((done) => {
    logger = getLogger()
    server = ldapjs.createServer()

    // Setup LDAP search handler
    // @ts-expect-error - ldapjs types are incomplete
    server.search(LDAP_BASE, (req, res, next) => {
      TEST_USERS.forEach((entry) => {
        if (req.filter.matches(entry.attributes)) {
          res.send(entry)
        }
      })
      res.end()
    })

    server.listen(LDAP_PORT, LDAP_HOST, () => {
      done()
    })
  })

  afterAll((done) => {
    logger.close()
    server.close(() => {
      done()
    })
  })

  describe('initialization and connection', () => {
    it('should initialize and connect to LDAP successfully', async () => {
      userDB = createUserDB()
      await expect(userDB.ready).resolves.toBeUndefined()
    })

    it('should log error on connection failure but still resolve ready promise', async () => {
      const loggerErrorSpy = jest.spyOn(logger, 'error')

      userDB = createUserDB({
        ldapUri: 'ldap://nonexistent-host:63389',
        ldapUser: 'cn=admin',
        ldapPassword: 'root'
      })

      await expect(userDB.ready).resolves.toBeUndefined()

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to bind to LDAP server:')
      )
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('URI: ldap://nonexistent-host:63389')
      )

      loggerErrorSpy.mockRestore()
    })

    it('should handle close method without errors', () => {
      userDB = createUserDB()
      expect(() => userDB.close()).not.toThrow()
    })
  })

  describe('get() method', () => {
    beforeEach(async () => {
      userDB = createUserDB()
      await userDB.ready
    })

    it('should return results with default fields for exact match', async () => {
      const results = await userDB.get('', [], { uid: 'dwho', sn: ['doctor'] })

      expect(results).toHaveLength(1)
      expect(results[0].dn).toBe('cn=dwho,ou=users,o=example')
    })

    it('should return only requested fields', async () => {
      const results = await userDB.get('', ['uid'], { uid: 'dwho' })

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual({ uid: 'dwho' })
    })

    it('should return empty array when no matches found', async () => {
      const results = await userDB.get('', [], { uid: 'nonexistent' })

      expect(results).toHaveLength(0)
    })

    it('should return all entries when no filter provided', async () => {
      const results = await userDB.get('', ['uid'])

      expect(results).toHaveLength(4)
      const uids = results.map((entry) => entry.uid).sort()
      expect(uids).toEqual(['asmith', 'dwho', 'jdoe', 'lskywalker'])
    })

    it('should handle empty filter fields object', async () => {
      const results = await userDB.get('', ['uid'], {})

      expect(results).toHaveLength(4)
    })

    it('should handle array values with OR logic', async () => {
      const results = await userDB.get('', ['uid', 'mail'], {
        mail: ['*skywalker@example.com', 'dwho@example.com']
      })

      expect(results).toHaveLength(2)
      const mails = results.map((user) => user.mail).sort()
      expect(mails).toEqual(['dwho@example.com', 'lskywalker@example.com'])
    })

    it('should handle multiple filter criteria with AND logic', async () => {
      const results = await userDB.get('', ['uid', 'givenName'], {
        uid: 'dwho',
        givenName: 'Doctor'
      })

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual({ uid: 'dwho', givenName: 'Doctor' })
    })

    it('should support wildcard patterns in filter values', async () => {
      const results = await userDB.get('', ['uid', 'mail'], {
        mail: 'l*walker@example.com'
      })

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual({
        uid: 'lskywalker',
        mail: 'lskywalker@example.com'
      })
    })

    it('should return empty array for non-matching complex filter', async () => {
      const results = await userDB.get('', ['uid'], {
        uid: 'nonexistent',
        mail: '*@example.org'
      })

      expect(results).toHaveLength(0)
    })
  })

  describe('match() method', () => {
    beforeEach(async () => {
      userDB = createUserDB()
      await userDB.ready
    })

    it('should find entries matching wildcard search pattern', async () => {
      const results = await userDB.match('', ['uid'], ['uid'], 'wh')

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual({ uid: 'dwho' })
    })

    it('should search across multiple fields', async () => {
      const results = await userDB.match(
        '',
        ['uid', 'givenName'],
        ['uid', 'givenName'],
        'sky'
      )

      expect(results.length).toBeGreaterThan(0)
      const hasMatch = results.some(
        (r) => r.uid === 'lskywalker' || r.givenName === 'Luke'
      )
      expect(hasMatch).toBe(true)
    })

    it('should return empty array when no search fields provided', async () => {
      const results = await userDB.match('', ['uid'], [], 'anyvalue')

      expect(results).toHaveLength(0)
    })

    it('should handle empty search value', async () => {
      const results = await userDB.match('', ['uid'], ['uid'], '')

      expect(results).toHaveLength(4)
    })
  })

  describe('getAll() method', () => {
    beforeEach(async () => {
      userDB = createUserDB()
      await userDB.ready
    })

    it('should return all entries with requested fields', async () => {
      const results = await userDB.getAll('', ['uid'])

      expect(results).toHaveLength(4)
      const uids = results.map((entry) => entry.uid).sort()
      expect(uids).toEqual(['asmith', 'dwho', 'jdoe', 'lskywalker'])
    })

    it('should sort results by string field when order specified', async () => {
      const results = await userDB.getAll('', ['uid'], 'uid')

      expect(results).toHaveLength(4)
      expect(results[0].uid).toBe('asmith')
      expect(results[1].uid).toBe('dwho')
      expect(results[2].uid).toBe('jdoe')
      expect(results[3].uid).toBe('lskywalker')
    })

    it('should sort results by numeric field when order specified', async () => {
      const results = await userDB.getAll('', ['uid', 'age'], 'age')

      expect(results).toHaveLength(4)
      expect(results[0].uid).toBe('lskywalker') // age 23
      expect(results[1].uid).toBe('asmith') // age 25
      expect(results[2].uid).toBe('jdoe') // age 30
      expect(results[3].uid).toBe('dwho') // age 950
    })

    it('should return all fields when fields array contains all attributes', async () => {
      const results = await userDB.getAll('', [
        'uid',
        'givenName',
        'mail',
        'age'
      ])

      expect(results).toHaveLength(4)
      results.forEach((entry) => {
        expect(entry).toHaveProperty('uid')
        expect(entry).toHaveProperty('givenName')
        expect(entry).toHaveProperty('mail')
        expect(entry).toHaveProperty('age')
      })
    })
  })

  describe('edge cases and error handling', () => {
    beforeEach(async () => {
      userDB = createUserDB()
      await userDB.ready
    })

    it('should handle filter with null values gracefully', async () => {
      const results = await userDB.get('', ['uid'], {
        uid: 'dwho',
        // @ts-expect-error - Testing null handling
        nonexistent: null
      })

      expect(results).toHaveLength(1)
      expect(results[0].uid).toBe('dwho')
    })

    it('should handle filter with undefined values gracefully', async () => {
      const filterFields = {
        uid: 'dwho',
        nonexistent: undefined
      }
      const results = await userDB.get(
        '',
        ['uid'],
        filterFields as unknown as Record<string, string | number | string[]>
      )

      expect(results).toHaveLength(1)
      expect(results[0].uid).toBe('dwho')
    })

    it('should handle filter with empty array values gracefully', async () => {
      const results = await userDB.get('', ['uid'], {
        uid: 'dwho',
        mail: []
      })

      expect(results).toHaveLength(1)
      expect(results[0].uid).toBe('dwho')
    })

    it('should return empty array for completely non-matching filter', async () => {
      const results = await userDB.get('', ['uid'], {
        uid: 'zzz_nonexistent'
      })

      expect(results).toHaveLength(0)
    })
  })
})
