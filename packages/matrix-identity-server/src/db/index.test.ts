/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import { randomString } from '@twake/crypto'
import { getLogger, type TwakeLogger } from '@twake/logger'
import DefaultConfig from '../config.json'
import { type Config, type DbGetResult } from '../types'
import IdDb from './index'
import fs from 'fs'
import { assert } from 'console'

const baseConf: Config = {
  ...DefaultConfig,
  database_engine: 'sqlite',
  database_host: './testdb.db',
  userdb_engine: 'ldap'
}

if (process.env.TEST_PG === 'yes') {
  baseConf.database_engine = 'pg'
  baseConf.database_host = process.env.PG_HOST ?? 'localhost'
  baseConf.database_user = process.env.PG_USER ?? 'twake'
  baseConf.database_password = process.env.PG_PASSWORD ?? 'twake'
  baseConf.database_name = process.env.PG_DATABASE ?? 'test'
}

const logger: TwakeLogger = getLogger()

// Helper functions
async function setupIdDb(customConf?: Partial<Config>): Promise<IdDb> {
  const idDb = new IdDb({ ...baseConf, ...customConf }, logger)
  await idDb.ready
  return idDb
}

function cleanupIdDb(idDb: IdDb): void {
  clearTimeout(idDb.cleanJob)
  idDb.close()
}

async function insertTestTokens(idDb: IdDb): Promise<void> {
  await idDb.insert('accessTokens', { id: '1', data: '{}' })
  await idDb.insert('accessTokens', { id: '2', data: '{}' })
  await idDb.insert('accessTokens', { id: '3', data: '{wrong_data}' })
}

async function insertAccessTokens(
  idDb: IdDb,
  records: Array<{ id: string; data: string }>
): Promise<void> {
  for (const record of records) {
    await idDb.insert('accessTokens', record)
  }
}

describe('Id Server DB', () => {
  let idDb: IdDb
  afterEach(() => {
    process.env.TEST_PG === 'yes' || fs.unlinkSync('./testdb.db')
  })

  afterAll(() => {
    logger.close()
    // if (fs.existsSync('./testdb.db')) {
    //   fs.unlinkSync('./testdb.db')
    // }
  })

  it('should have SQLite database initialized', async () => {
    const idDb = await setupIdDb()

    const id = randomString(64)
    await idDb.insert('accessTokens', { id, data: '{}' })

    const rows = await idDb.get('accessTokens', ['id', 'data'], { id })
    expect(rows.length).toBe(1)
    expect(rows[0].id).toEqual(id)
    expect(rows[0].data).toEqual('{}')

    cleanupIdDb(idDb)
  })

  it('should provide one-time-token', async () => {
    const idDb = await setupIdDb()

    const token = await idDb.createOneTimeToken({ a: 1 })
    expect(token).toMatch(/^[a-zA-Z0-9]+$/)

    const data = await idDb.verifyOneTimeToken(token)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
    // @ts-ignore
    expect(data.a).toEqual(1)

    await expect(idDb.verifyOneTimeToken(token)).rejects.toThrow()

    cleanupIdDb(idDb)
  })

  it('should provide verification-token', async () => {
    const idDb = await setupIdDb()

    const token = await idDb.createInvitationToken('randomMailorPhone', {
      a: 1
    })
    expect(token).toMatch(/^[a-zA-Z0-9]+$/)

    const data = await idDb.verifyInvitationToken(token)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
    // @ts-ignore
    expect(data.a).toEqual(1)

    cleanupIdDb(idDb)
  })

  it('should provide match()', async () => {
    const idDb = await setupIdDb()

    const token = await idDb.createOneTimeToken({ a: 1 })
    expect(token).toMatch(/^[a-zA-Z0-9]+$/)

    const matchData = await idDb.match(
      'oneTimeTokens',
      ['id'],
      ['id'],
      token.substring(2, 28)
    )
    expect(matchData[0].id).toBe(token)

    const data = await idDb.verifyOneTimeToken(token)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
    // @ts-ignore
    expect(data.a).toEqual(1)

    cleanupIdDb(idDb)
  })

  it('should update', async () => {
    const idDb = await setupIdDb()

    const token = await idDb.createOneTimeToken({ a: 1 })
    await idDb.update('oneTimeTokens', { data: '{ "a": 2 }' }, 'id', token)

    const data = await idDb.verifyToken(token)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
    // @ts-ignore
    expect(data.a).toEqual(2)

    cleanupIdDb(idDb)
  })

  it('should return entry on update', async () => {
    const idDb = await setupIdDb()

    const token = await idDb.createOneTimeToken({ a: 1 })
    const rows = await idDb.update(
      'oneTimeTokens',
      { data: '{"a": 2}' },
      'id',
      token
    )

    expect(rows.length).toBe(1)
    expect(rows[0].data).toEqual('{"a": 2}')

    cleanupIdDb(idDb)
  })

  it('should update records matching both conditions', async () => {
    const idDb = await setupIdDb()

    await idDb.insert('userPolicies', {
      user_id: 'user1',
      policy_name: 'policy1',
      accepted: 1
    })

    const rows = await idDb.updateAnd(
      'userPolicies',
      { accepted: 2 },
      { field: 'user_id', value: 'user1' },
      { field: 'policy_name', value: 'policy1' }
    )

    expect(rows[0].accepted).toEqual(2)
    cleanupIdDb(idDb)
  })

  it('should return entry on updateAnd', async () => {
    const idDb = await setupIdDb()

    await idDb.insert('userPolicies', {
      user_id: 'user2',
      policy_name: 'policy2',
      accepted: 3
    })

    const rows = await idDb.updateAnd(
      'userPolicies',
      { accepted: 4 },
      { field: 'user_id', value: 'user2' },
      { field: 'policy_name', value: 'policy2' }
    )

    expect(rows.length).toBe(1)
    expect(rows[0].accepted).toEqual(4)
    cleanupIdDb(idDb)
  })

  it('should not update records if conditions do not match', async () => {
    const idDb = await setupIdDb()

    await idDb.insert('userPolicies', {
      user_id: 'user3',
      policy_name: 'policy3',
      accepted: 1
    })

    await idDb.updateAnd(
      'userPolicies',
      { accepted: 2 },
      { field: 'user_id', value: 'user3' },
      { field: 'policy_name', value: 'nonexistent' }
    )

    const rows = await idDb.get('userPolicies', ['*'], { user_id: 'user3' })
    expect(rows[0].accepted).toEqual(1)

    cleanupIdDb(idDb)
  })

  it('should return entry on insert', async () => {
    const idDb = await setupIdDb()

    const id = randomString(64)
    const rows = await idDb.insert('accessTokens', { id, data: '{}' })

    expect(rows.length).toBe(1)
    expect(rows[0].id).toEqual(id)
    expect(rows[0].data).toEqual('{}')

    cleanupIdDb(idDb)
  })

  it('should return count without value', async () => {
    const idDb = await setupIdDb()

    const initialValue = await idDb.getCount('oneTimeTokens', 'id')
    await idDb.createToken({ a: 1 })
    const val = await idDb.getCount('oneTimeTokens', 'id')

    expect(val).toBe(initialValue + 1)
    cleanupIdDb(idDb)
  })

  it('should return count with value', async () => {
    const idDb = await setupIdDb()

    const token = await idDb.createToken({ a: 1 })

    let val = await idDb.getCount('oneTimeTokens', 'id', token)
    expect(val).toBe(1)

    val = await idDb.getCount('oneTimeTokens', 'id', token + 'z')
    expect(val).toBe(0)

    val = await idDb.getCount('oneTimeTokens', 'id', [token, token + 'z'])
    expect(val).toBe(1)

    cleanupIdDb(idDb)
  })

  it('should delete lower than value', async () => {
    const idDb = await setupIdDb()

    const token = await idDb.createToken({ a: 1 }, 5)
    await idDb.deleteLowerThan('oneTimeTokens', 'expires', 6)

    const val = await idDb.getCount('oneTimeTokens', 'id', token + 'z')
    expect(val).toBe(0)

    cleanupIdDb(idDb)
  })

  it('should delete lines with specified filters', async () => {
    const idDb = await setupIdDb()

    const idsNumber = 8
    const ids: string[] = []
    const insertsPromises: Array<Promise<DbGetResult>> = []

    for (let index = 0; index < idsNumber; index++) {
      ids[index] = randomString(64)
      insertsPromises[index] = idDb.insert('accessTokens', {
        id: ids[index],
        data: `{${index % 2}}`
      })
    }

    await Promise.all(insertsPromises)
    await idDb.deleteWhere('accessTokens', {
      field: 'data',
      operator: '=',
      value: '{0}'
    })

    const rows = await idDb.getAll('accessTokens', ['id', 'data'])
    expect(rows.length).toBe(Math.floor(idsNumber / 2))
    expect(rows[0].data).toEqual('{1}')

    cleanupIdDb(idDb)
  })

  it('should delete records matching both conditions', async () => {
    const idDb = await setupIdDb()

    const idsNumber = 8
    const ids: string[] = []
    const insertsPromises: Array<Promise<DbGetResult>> = []
    for (let index = 0; index < idsNumber; index++) {
      ids[index] = randomString(64)
      insertsPromises[index] = idDb.insert('attempts', {
        email: `email${index}`,
        expires: index,
        attempt: index
      })
    }

    await Promise.all(insertsPromises)
    await idDb.deleteEqualAnd(
      'attempts',
      { field: 'email', value: 'email0' },
      { field: 'expires', value: '0' }
    )

    const rows = await idDb.getAll('attempts', ['email', 'expires', 'attempt'])
    expect(rows.length).toBe(idsNumber - 1)
    rows.forEach((row) => {
      expect(row.email).not.toEqual('email0')
      expect(row.attempt).not.toEqual('0')
      expect(row.expires).not.toEqual('0')
    })

    cleanupIdDb(idDb)
  })

  test('OneTimeToken timeout', async () => {
    const idDb = await setupIdDb({ database_vacuum_delay: 3 })

    const token = await idDb.createOneTimeToken({ a: 1 }, 1)

    await new Promise<void>((resolve) => {
      setTimeout(async () => {
        await expect(idDb.verifyOneTimeToken(token)).rejects.toThrow()
        cleanupIdDb(idDb)
        resolve()
      }, 6000)
    })
  })

  it('should provide ephemeral Keypair', async () => {
    const idDb = await setupIdDb()

    const _key = await idDb.createKeypair('shortTerm', 'curve25519')
    expect(_key.keyId).toMatch(/^(ed25519|curve25519):[A-Za-z0-9_-]+$/)

    cleanupIdDb(idDb)
  })

  it('should return entry when creating new keyPair ', async () => {
    const idDb = await setupIdDb()

    const _key = await idDb.createKeypair('shortTerm', 'curve25519')
    const rows = await idDb.get('shortTermKeypairs', ['keyID'], {})

    expect(rows.length).toBe(1)
    expect(rows[0].keyID).toEqual(_key.keyId)

    cleanupIdDb(idDb)
  })

  it('should delete a key from the shortKey pairs table', async () => {
    const idDb = await setupIdDb()

    const key1 = await idDb.createKeypair('shortTerm', 'ed25519')
    const key2 = await idDb.createKeypair('shortTerm', 'curve25519')
    await idDb.deleteKey(key1.keyId)

    const rows = await idDb.get('shortTermKeypairs', ['keyID'], {})
    expect(rows.length).toBe(1)
    expect(rows[0].keyID).toEqual(key2.keyId)

    cleanupIdDb(idDb)
  })

  it('should list invitation tokens', async () => {
    const idDb = await setupIdDb()

    await idDb.createInvitationToken('test@example.com', { test: 'a' })
    await idDb.createInvitationToken('+21652111333', { test: 'b' })
    await idDb.createInvitationToken('test@example.com', { test: 'c' })

    const tokens = await idDb.listInvitationTokens('test@example.com')
    assert(tokens)

    expect(tokens?.length).toBe(2)
    cleanupIdDb(idDb)
  })

  it('should return an empty array of no invitation tokens were found', async () => {
    const idDb = await setupIdDb()

    await idDb.createInvitationToken('test@example.com', { test: 'a' })

    const tokens = await idDb.listInvitationTokens('+21652111222')

    assert(tokens)

    expect(tokens?.length).toBe(0)
    cleanupIdDb(idDb)
  })

  describe('testing sql requests', () => {
    it('should create aliases if the fields contain periods', async () => {
      const idDb = await setupIdDb()

      await idDb.insert('accessTokens', { id: '1', data: '{}' })
      const rows = await idDb.get('accessTokens', ['accessTokens.id'], {
        id: '1'
      })

      expect(rows.length).toBe(1)
      expect(rows[0].accessTokens_id).toEqual('1')

      cleanupIdDb(idDb)
    })

    it('should get entry with corresponding higher than condition', async () => {
      const idDb = await setupIdDb()

      await insertTestTokens(idDb)
      const rows = await idDb.getHigherThan('accessTokens', ['id'], { id: '1' })

      expect(rows.length).toBe(2)
      expect(rows[0].id).toEqual('2')
      expect(rows[1].id).toEqual('3')

      cleanupIdDb(idDb)
    })

    it('should get entry with corresponding multiple conditions', async () => {
      const idDb = await setupIdDb()

      await insertTestTokens(idDb)
      const rows = await idDb.get('accessTokens', ['id'], { id: ['1', '2'] })

      expect(rows.length).toBe(2)
      expect(rows[0].id).toEqual('1')
      expect(rows[1].id).toEqual('2')

      cleanupIdDb(idDb)
    })

    it('should sort entry by order', async () => {
      const idDb = await setupIdDb()

      await idDb.insert('accessTokens', { id: '2', data: '{}' })
      await idDb.insert('accessTokens', { id: '1', data: '{}' })

      const rows = await idDb.get(
        'accessTokens',
        ['id'],
        { data: '{}' },
        'id DESC'
      )
      expect(rows.length).toBe(2)
      expect(rows[0].id).toEqual('2')
      expect(rows[1].id).toEqual('1')

      cleanupIdDb(idDb)
    })

    it('should get entry with corresponding join conditions', async () => {
      const idDb = await setupIdDb()

      await idDb.insert('accessTokens', { id: '1', data: '{}' })
      await idDb.insert('oneTimeTokens', { id: '1', expires: 0 })
      await idDb.insert('accessTokens', { id: '2', data: '{}' })
      await idDb.insert('oneTimeTokens', { id: '2', expires: 1 })

      const rows = await idDb.getJoin(
        ['accessTokens', 'oneTimeTokens'],
        ['accessTokens.id', 'oneTimeTokens.expires'],
        {
          'accessTokens.data': '{}',
          'oneTimeTokens.expires': 0
        },
        { 'accessTokens.id': 'oneTimeTokens.id' }
      )

      expect(rows.length).toBe(1)
      expect(rows[0].accessTokens_id).toEqual('1')
      expect(rows[0].oneTimeTokens_expires).toEqual(0)

      cleanupIdDb(idDb)
    })

    it('should get entry with corresponding equal or different conditions', async () => {
      const idDb = await setupIdDb()

      const id = randomString(64)
      await idDb.insert('accessTokens', { id, data: '{}' })
      await idDb.insert('accessTokens', {
        id: 'wrong_id_1',
        data: '{wrong_data}'
      })
      await idDb.insert('accessTokens', { id: 'wrong_id_2', data: '{}' })

      const rows = await idDb.getWhereEqualOrDifferent(
        'accessTokens',
        ['id', 'data'],
        { id },
        { data: '{}' }
      )

      expect(rows.length).toBe(2)
      expect(rows[0].id).toEqual(id)
      expect(rows[1].data).toEqual('{wrong_data}')

      cleanupIdDb(idDb)
    })

    it('should get entry with corresponding equal and higher conditions', async () => {
      const idDb = await setupIdDb()

      await insertTestTokens(idDb)

      const rows = await idDb.getWhereEqualAndHigher(
        'accessTokens',
        ['id', 'data'],
        { data: '{}' },
        { id: '1' }
      )

      expect(rows.length).toBe(1)
      expect(rows[0].id).toEqual('2')
      expect(rows[0].data).toEqual('{}')

      cleanupIdDb(idDb)
    })

    it('should not return a null row if the conditions are not matched', async () => {
      const idDb = await setupIdDb()

      await idDb.insert('accessTokens', { id: '1', data: '{}' })

      const rows = await idDb.getMaxWhereEqual(
        'accessTokens',
        'id',
        ['id', 'data'],
        { id: '2' }
      )

      expect(rows.length).toBe(0)
      cleanupIdDb(idDb)
    })

    it('should get max entry with corresponding equal condition', async () => {
      const idDb = await setupIdDb()

      await insertTestTokens(idDb)

      const rows = await idDb.getMaxWhereEqual(
        'accessTokens',
        'id',
        ['id', 'data'],
        { data: '{}' }
      )

      expect(rows.length).toBe(1)
      expect(rows[0].id).toEqual('2')

      cleanupIdDb(idDb)
    })

    it('should get max entry with corresponding lower condition and select all fields if not specified', async () => {
      const idDb = await setupIdDb()

      await insertTestTokens(idDb)

      const rows = await idDb.getMaxWhereEqual('accessTokens', 'id', [], {
        data: '{}'
      })

      expect(rows.length).toBe(1)
      expect(rows[0]).toHaveProperty('id')
      expect(rows[0]).toHaveProperty('data')
      expect(rows[0].id).toEqual('2')
      expect(rows[0].data).toEqual('{}')

      cleanupIdDb(idDb)
    })

    it('should get max entry with multiple corresponding equal conditions', async () => {
      const idDb = await setupIdDb()

      await idDb.insert('accessTokens', { id: '1', data: '{}' })
      await idDb.insert('accessTokens', { id: '2', data: '{...}' })
      await idDb.insert('accessTokens', { id: '3', data: '{wrong_data}' })

      const rows = await idDb.getMaxWhereEqual(
        'accessTokens',
        'id',
        ['id', 'data'],
        { data: ['{}', '{...}'] }
      )

      expect(rows.length).toBe(1)
      expect(rows[0].id).toEqual('2')

      cleanupIdDb(idDb)
    })

    it('should get max entry with corresponding equal and lower conditions', async () => {
      const idDb = await setupIdDb()

      await insertTestTokens(idDb)

      const rows = await idDb.getMaxWhereEqualAndLower(
        'accessTokens',
        'id',
        ['id', 'data'],
        { data: '{}' },
        { id: '4' }
      )

      expect(rows.length).toBe(1)
      expect(rows[0].id).toEqual('2')
      expect(rows[0].data).toEqual('{}')

      cleanupIdDb(idDb)
    })

    it('should get min entry with corresponding equal and higher conditions', async () => {
      const idDb = await setupIdDb()

      await idDb.insert('accessTokens', { id: '1', data: '{wrong_data}' })
      await idDb.insert('accessTokens', { id: '2', data: '{}' })
      await idDb.insert('accessTokens', { id: '3', data: '{}' })

      const rows = await idDb.getMinWhereEqualAndHigher(
        'accessTokens',
        'id',
        ['id', 'data'],
        { data: '{}' },
        { id: '0' }
      )

      expect(rows.length).toBe(1)
      expect(rows[0].id).toEqual('2')
      expect(rows[0].data).toEqual('{}')

      cleanupIdDb(idDb)
    })

    it('should get max entry with corresponding equal and lower conditions on multiple joined tables', async () => {
      const idDb = await setupIdDb()

      await idDb.insert('accessTokens', { id: '1', data: '{}' })
      await idDb.insert('oneTimeTokens', { id: '1', expires: 999 })
      await idDb.insert('accessTokens', { id: '2', data: '{}' })
      await idDb.insert('oneTimeTokens', { id: '2', expires: 999 })
      await idDb.insert('accessTokens', { id: '3', data: '{wrong_data}' })
      await idDb.insert('oneTimeTokens', { id: '3', expires: 999 })
      await idDb.insert('accessTokens', { id: '4', data: '{wrong_data}' })
      await idDb.insert('oneTimeTokens', { id: '4', expires: 1001 })

      const rows = await idDb.getMaxWhereEqualAndLowerJoin(
        ['accessTokens', 'oneTimeTokens'],
        'accessTokens.id',
        ['accessTokens.id', 'accessTokens.data', 'oneTimeTokens.expires'],
        { 'accessTokens.data': '{}' },
        { 'oneTimeTokens.expires': 1000 },
        { 'accessTokens.id': 'oneTimeTokens.id' }
      )

      expect(rows.length).toBe(1)
      expect(rows[0].accessTokens_id).toEqual('2')
      expect(rows[0].accessTokens_data).toEqual('{}')
      expect(rows[0].oneTimeTokens_expires).toBeLessThan(1000)

      cleanupIdDb(idDb)
    })
  })
})
