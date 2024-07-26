import { generateKeyPair, randomString } from '@twake/crypto'
import { type TwakeLogger } from '@twake/logger'
import { type Config, type DbGetResult } from '../types'
import { epoch } from '@twake/utils'
import Pg from './sql/pg'
import { type ISQLCondition } from './sql/sql'
import Sqlite from './sql/sqlite'

export type SupportedDatabases = 'sqlite' | 'pg'

export type Collections =
  | 'accessTokens'
  | 'activeContacts'
  | 'attempts'
  | 'oneTimeTokens'
  | 'hashes'
  | 'invitationTokens'
  | 'keys'
  | 'longTermKeypairs'
  | 'mappings'
  | 'privateNotes'
  | 'roomTags'
  | 'shortTermKeypairs'
  | 'userHistory'
  | 'userPolicies'
  | 'userQuotas'
  | 'activeContacts'

const cleanByExpires: Collections[] = ['oneTimeTokens', 'attempts']

const tables: Record<Collections, string> = {
  accessTokens: 'id varchar(64) PRIMARY KEY, data text',
  activeContacts: 'userId text PRIMARY KEY, contacts text',
  attempts: 'email text PRIMARY KEY, expires int, attempt int',
  oneTimeTokens: 'id varchar(64) PRIMARY KEY, expires int, data text',
  hashes:
    'hash varchar(48) PRIMARY KEY, pepper varchar(32), type varchar(8), value text, active integer',
  invitationTokens: 'id varchar(64) PRIMARY KEY, address text, data text',
  keys: 'name varchar(32) PRIMARY KEY, data text',
  longTermKeypairs:
    'name text PRIMARY KEY, keyID varchar(64), public text, private text',
  mappings:
    'client_secret varchar(255) PRIMARY KEY, session_id varchar(12), medium varchar(8), valid integer, address text, submit_time integer, send_attempt integer',
  privateNotes:
    'id varchar(64) PRIMARY KEY, authorId varchar(64), content text, targetId varchar(64)',
  roomTags:
    'id varchar(64) PRIMARY KEY, authorId varchar(64), content text, roomId varchar(64)',
  shortTermKeypairs:
    'keyID varchar(64) PRIMARY KEY, public text, private text, active integer',
  userHistory: 'address text PRIMARY KEY, active integer, timestamp integer',
  userPolicies:
    'user_id text, policy_name text, accepted integer, PRIMARY KEY (user_id, policy_name)',
  userQuotas: 'user_id varchar(64) PRIMARY KEY, size int'
}

const indexes: Partial<Record<Collections, string[]>> = {
  attempts: ['expires'],
  invitationTokens: ['address'],
  oneTimeTokens: ['expires'],
  userHistory: ['timestamp']
}

const initializeValues: Partial<
  Record<Collections, Array<Record<string, string | number>>>
> = {
  keys: [
    { name: 'pepper', data: '' },
    { name: 'previousPepper', data: '' }
  ]
}

interface keyPair {
  publicKey: string
  privateKey: string
  keyId: string
}

type Insert<T> = (
  table: T,
  values: Record<string, string | number>
) => Promise<DbGetResult>
type Update<T> = (
  table: T,
  values: Record<string, string | number>,
  field: string,
  value: string | number
) => Promise<DbGetResult>
type UpdateAnd<T> = (
  table: T,
  values: Record<string, string | number>,
  condition1: { field: string; value: string | number },
  condition2: { field: string; value: string | number }
) => Promise<DbGetResult>
type Get<T> = (
  table: T,
  fields: string[],
  filterFields: Record<string, string | number | Array<string | number>>,
  order?: string
) => Promise<DbGetResult>
type Get2<T> = (
  table: T,
  fields: string[],
  filterFields1: Record<string, string | number | Array<string | number>>,
  filterFields2: Record<string, string | number | Array<string | number>>,
  order?: string
) => Promise<DbGetResult>
type GetJoin<T> = (
  tables: T[],
  fields: string[],
  filterFields: Record<string, string | number | Array<string | number>>,
  joinFields: Record<string, string>,
  order?: string
) => Promise<DbGetResult>
type GetMinMax<T> = (
  table: T,
  targetField: string,
  fields: string[],
  filterFields: Record<string, string | number | Array<string | number>>,
  order?: string
) => Promise<DbGetResult>
type GetMinMax2<T> = (
  table: T,
  targetField: string,
  fields: string[],
  filterFields1: Record<string, string | number | Array<string | number>>,
  filterFields2: Record<string, string | number | Array<string | number>>,
  order?: string
) => Promise<DbGetResult>
type GetMinMaxJoin2<T> = (
  tables: T[],
  targetField: string,
  fields: string[],
  filterFields1: Record<string, string | number | Array<string | number>>,
  filterFields2: Record<string, string | number | Array<string | number>>,
  joinFields: Record<string, string>,
  order?: string
) => Promise<DbGetResult>
type GetCount<T> = (
  table: T,
  field: string,
  value?: string | number | string[]
) => Promise<number>
type GetAll<T> = (
  table: T,
  fields: string[],
  order?: string
) => Promise<DbGetResult>
type Match<T> = (
  table: T,
  fields: string[],
  searchFields: string[],
  value: string | number
) => Promise<DbGetResult>
type DeleteEqual<T> = (
  table: T,
  field: string,
  value: string | number
) => Promise<void>
type DeleteEqualAnd<T> = (
  table: T,
  condition1: {
    field: string
    value: string | number | Array<string | number>
  },
  condition2: { field: string; value: string | number | Array<string | number> }
) => Promise<void>
type DeleteLowerThan<T> = (
  table: T,
  field: string,
  value: string | number
) => Promise<void>

type DeleteWhere<T> = (
  table: T,
  conditions: ISQLCondition | ISQLCondition[]
) => Promise<void>

export interface IdDbBackend<T> {
  ready: Promise<void>
  createDatabases: (conf: Config, ...args: any) => Promise<void>
  insert: Insert<T>
  get: Get<T>
  getJoin: GetJoin<T>
  getWhereEqualOrDifferent: Get2<T>
  getWhereEqualAndHigher: Get2<T>
  getMaxWhereEqual: GetMinMax<T>
  getMaxWhereEqualAndLower: GetMinMax2<T>
  getMinWhereEqualAndHigher: GetMinMax2<T>
  getMaxWhereEqualAndLowerJoin: GetMinMaxJoin2<T>
  getCount: GetCount<T>
  getAll: GetAll<T>
  getHigherThan: Get<T>
  match: Match<T>
  update: Update<T>
  updateAnd: UpdateAnd<T>
  deleteEqual: DeleteEqual<T>
  deleteEqualAnd: DeleteEqualAnd<T>
  deleteLowerThan: DeleteLowerThan<T>
  deleteWhere: DeleteWhere<T>
  close: () => void
}
export type InsertType = (
  table: string,
  values: Array<string | number>
) => Promise<void>

class IdentityServerDb<T extends string = never>
  implements IdDbBackend<Collections | T>
{
  ready: Promise<void>
  db: IdDbBackend<Collections | T>
  cleanJob?: NodeJS.Timeout
  cleanByExpires: Array<Collections | T>

  constructor(
    conf: Config,
    private readonly logger: TwakeLogger,
    additionnalTables?: Record<T, string>,
    additionnalIndexes?: Partial<Record<T, string[]>>,
    additionnalInitializeValues?: Partial<
      Record<Collections, Array<Record<string, string | number>>>
    >
  ) {
    this.cleanByExpires = cleanByExpires
    let Module
    /* istanbul ignore next */
    switch (conf.database_engine) {
      case 'sqlite': {
        Module = Sqlite
        break
      }
      case 'pg': {
        Module = Pg
        break
      }
      default: {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`Unsupported database type ${conf.database_engine}`)
      }
    }

    const allTables =
      additionnalTables != null ? { ...tables, ...additionnalTables } : tables
    const allIndexes =
      additionnalIndexes != null
        ? { ...indexes, ...additionnalIndexes }
        : indexes
    const allInitializeValues =
      additionnalInitializeValues != null
        ? { ...initializeValues, ...additionnalInitializeValues }
        : initializeValues
    this.db = new Module<Collections | T>(
      conf,
      this.logger,
      allTables as Record<Collections | T, string>,
      allIndexes as Partial<Record<Collections | T, string[]>>,
      allInitializeValues as Partial<
        Record<Collections | T, Array<Record<string, string | number>>>
      >
    )
    this.ready = new Promise((resolve, reject) => {
      this.db.ready
        .then(() => {
          this.init()
            .then(() => {
              resolve()
            })
            .catch((e) => {
              /* istanbul ignore next */
              this.logger.error('initialization failed')
              /* istanbul ignore next */
              reject(e)
            })
        })
        .catch((e) => {
          /* istanbul ignore next */
          this.logger.error('Database initialization failed')
          /* istanbul ignore next */
          reject(e)
        })
    })
    this.ready
      .then(() => {
        this.dbMaintenance(conf.database_vacuum_delay)
      })
      .catch((e) => {
        /* istanbul ignore next */
        this.logger.error('DB maintenance error', e)
      })
  }

  // For later
  async init(): Promise<void> {}

  /* istanbul ignore next */
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createDatabases(conf: Config, ...args: any): Promise<void> {
    return this.db.createDatabases(conf, ...args)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  insert(table: Collections | T, values: Record<string, string | number>) {
    return this.db.insert(table, values)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  update(
    table: Collections | T,
    values: Record<string, string | number>,
    field: string,
    value: string | number
  ) {
    return this.db.update(table, values, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  updateAnd(
    table: Collections | T,
    values: Record<string, string | number>,
    condition1: { field: string; value: string | number },
    condition2: { field: string; value: string | number }
  ) {
    return this.db.updateAnd(table, values, condition1, condition2)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  get(
    table: Collections | T,
    fields: string[],
    filterFields: Record<string, string | number | Array<string | number>>,
    order?: string
  ) {
    return this.db.get(table, fields, filterFields, order)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getJoin(
    table: Array<Collections | T>,
    fields: string[],
    filterFields: Record<string, string | number | Array<string | number>>,
    joinFields: Record<string, string>,
    order?: string
  ) {
    return this.db.getJoin(table, fields, filterFields, joinFields, order)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getWhereEqualOrDifferent(
    table: Collections | T,
    fields: string[],
    filterFields1: Record<string, string | number | Array<string | number>>,
    filterFields2: Record<string, string | number | Array<string | number>>,
    order?: string
  ) {
    return this.db.getWhereEqualOrDifferent(
      table,
      fields,
      filterFields1,
      filterFields2,
      order
    )
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getWhereEqualAndHigher(
    table: Collections | T,
    fields: string[],
    filterFields1: Record<string, string | number | Array<string | number>>,
    filterFields2: Record<string, string | number | Array<string | number>>,
    order?: string
  ) {
    return this.db.getWhereEqualAndHigher(
      table,
      fields,
      filterFields1,
      filterFields2,
      order
    )
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getMaxWhereEqual(
    table: Collections | T,
    targetField: string,
    fields: string[],
    filterFields: Record<string, string | number | Array<string | number>>,
    order?: string
  ) {
    return this.db.getMaxWhereEqual(
      table,
      targetField,
      fields,
      filterFields,
      order
    )
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getMaxWhereEqualAndLower(
    table: Collections | T,
    targetField: string,
    fields: string[],
    filterFields1: Record<string, string | number | Array<string | number>>,
    filterFields2: Record<string, string | number | Array<string | number>>,
    order?: string
  ) {
    return this.db.getMaxWhereEqualAndLower(
      table,
      targetField,
      fields,
      filterFields1,
      filterFields2,
      order
    )
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getMinWhereEqualAndHigher(
    table: Collections | T,
    targetField: string,
    fields: string[],
    filterFields1: Record<string, string | number | Array<string | number>>,
    filterFields2: Record<string, string | number | Array<string | number>>,
    order?: string
  ) {
    return this.db.getMinWhereEqualAndHigher(
      table,
      targetField,
      fields,
      filterFields1,
      filterFields2,
      order
    )
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getMaxWhereEqualAndLowerJoin(
    tables: Array<T | Collections>,
    targetField: string,
    fields: string[],
    filterFields1: Record<string, string | number | Array<string | number>>,
    filterFields2: Record<string, string | number | Array<string | number>>,
    joinFields: Record<string, string>,
    order?: string
  ) {
    return this.db.getMaxWhereEqualAndLowerJoin(
      tables,
      targetField,
      fields,
      filterFields1,
      filterFields2,
      joinFields,
      order
    )
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getCount(
    table: Collections | T,
    field: string,
    value?: string | number | string[]
  ) {
    return this.db.getCount(table, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getAll(table: Collections | T, fields: string[], order?: string) {
    return this.db.getAll(table, fields, order)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getHigherThan(
    table: Collections | T,
    fields: string[],
    filterFields: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return this.db.getHigherThan(table, fields, filterFields, order)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  match(
    table: Collections | T,
    fields: string[],
    searchFields: string[],
    value: string | number
  ) {
    return this.db.match(table, fields, searchFields, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  deleteEqual(table: Collections | T, field: string, value: string | number) {
    return this.db.deleteEqual(table, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  deleteEqualAnd(
    table: Collections | T,
    condition1: {
      field: string
      value: string | number | Array<string | number>
    },
    condition2: {
      field: string
      value: string | number | Array<string | number>
    }
  ) {
    return this.db.deleteEqualAnd(table, condition1, condition2)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  deleteLowerThan(
    table: Collections | T,
    field: string,
    value: string | number
  ) {
    return this.db.deleteLowerThan(table, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  deleteWhere(
    table: Collections | T,
    conditions: ISQLCondition | ISQLCondition[]
  ) {
    // Deletes from table where filters correspond to values
    // Size of filters and values must be the same
    return this.db.deleteWhere(table, conditions)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createOneTimeToken(
    data: object,
    expires?: number,
    nextLink?: string
  ): Promise<string> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (nextLink) {
      data = { ...data, next_link: nextLink }
    }
    const id = randomString(64)
    // default: expires in 600 s
    const expiresForDb =
      epoch() + 1000 * (expires != null && expires > 0 ? expires : 600)
    return new Promise((resolve, reject) => {
      this.db
        .insert('oneTimeTokens', {
          id,
          expires: expiresForDb,
          data: JSON.stringify(data)
        })
        .then(() => {
          resolve(id)
        })
        .catch((err) => {
          /* istanbul ignore next */
          this.logger.error('Failed to insert token', err)
        })
    })
  }

  // No difference in creation between a token and a one-time-token
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createToken(data: object, expires?: number): Promise<string> {
    return this.createOneTimeToken(data, expires)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createInvitationToken(address: string, data: object): Promise<string> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    const id = randomString(64)
    return new Promise((resolve, reject) => {
      this.db
        .insert('invitationTokens', {
          id,
          address,
          data: JSON.stringify(data)
        })
        .then(() => {
          this.logger.info(`Invitation token created for ${address}`)
          resolve(id)
        })
        .catch((err) => {
          /* istanbul ignore next */
          this.logger.error('Failed to insert token', err)
          reject(err)
        })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  verifyInvitationToken(id: string): Promise<object> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    return new Promise((resolve, reject) => {
      this.db
        .get('invitationTokens', ['data', 'address'], { id })
        .then((rows) => {
          /* istanbul ignore else */
          if (rows.length > 0) {
            resolve(JSON.parse(rows[0].data as string))
          } else {
            reject(new Error('Unknown token'))
          }
        })
        .catch((e) => {
          /* istanbul ignore next */
          this.logger.error('Failed to get token', e)
          reject(e)
        })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  verifyToken(id: string): Promise<object> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    return new Promise((resolve, reject) => {
      this.db
        .get('oneTimeTokens', ['data', 'expires'], { id })
        .then((rows) => {
          /* istanbul ignore else */
          if (rows.length > 0 && (rows[0].expires as number) >= epoch()) {
            resolve(JSON.parse(rows[0].data as string))
          } else {
            reject(
              new Error(
                'Token expired' + (rows[0].expires as number).toString()
              )
            )
          }
        })
        .catch((e) => {
          reject(e)
        })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  verifyOneTimeToken(id: string): Promise<object> {
    let res: object
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    return new Promise((resolve, reject) => {
      this.verifyToken(id)
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then((data) => {
          res = data
          return this.deleteToken(id)
        })
        .then(() => {
          resolve(res)
        })
        .catch((e) => {
          reject(e)
        })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  deleteToken(id: string): Promise<void> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    return new Promise((resolve, reject) => {
      this.db
        .deleteEqual('oneTimeTokens', 'id', id)
        .then(() => {
          resolve()
        })
        .catch((e) => {
          /* istanbul ignore next */
          this.logger.info(`Token ${id} already deleted`, e)
          /* istanbul ignore next */
          resolve()
        })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getKeys(type: 'current' | 'previous'): Promise<keyPair> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    return new Promise((resolve, reject) => {
      const _type = type === 'current' ? 'currentKey' : 'previousKey'
      this.db
        .get('longTermKeypairs', ['keyID', 'public', 'private'], {
          name: _type
        })
        .then((rows) => {
          if (rows.length === 0) {
            reject(new Error(`No ${_type} found`))
          }
          resolve({
            keyId: rows[0].keyID as string,
            publicKey: rows[0].public as string,
            privateKey: rows[0].private as string
          })
        })
        .catch((e) => {
          reject(e)
        })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createKeypair(
    type: 'longTerm' | 'shortTerm',
    algorithm: 'ed25519' | 'curve25519'
  ): Promise<keyPair> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    const keyPair = generateKeyPair(algorithm)
    if (type === 'longTerm') {
      throw new Error('Long term key pairs are not supported')
    }
    const _type = 'shortTermKeypairs'
    return new Promise((resolve, reject) => {
      this.db
        .insert(_type, {
          keyID: keyPair.keyId,
          public: keyPair.publicKey,
          private: keyPair.privateKey
        })
        .then(() => {
          resolve(keyPair)
        })
        .catch((err) => {
          /* istanbul ignore next */
          this.logger.error('Failed to insert ephemeral Key Pair', err)
        })
    })
  }

  // Deletes a short term key pair from the database
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  deleteKey(_keyID: string): Promise<void> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    return new Promise((resolve, reject) => {
      this.db
        .deleteEqual('shortTermKeypairs', 'KeyID', _keyID)
        .then(() => {
          resolve()
        })
        .catch((e) => {
          /* istanbul ignore next */
          this.logger.info(`Key ${_keyID} already deleted`, e)
          /* istanbul ignore next */
          resolve()
        })
    })
  }

  dbMaintenance(delay: number): void {
    const _vacuum = async (): Promise<void> => {
      /* istanbul ignore next */
      await Promise.all(
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        this.cleanByExpires.map((table) => {
          return this.deleteLowerThan(table, 'expires', epoch())
        })
      )
      /* istanbul ignore next */
      this.cleanJob = setTimeout(() => _vacuum, delay * 1000)
    }
    this.cleanJob = setTimeout(() => _vacuum, delay * 1000)
  }

  close(): void {
    this.db.close()
  }
}

export default IdentityServerDb
