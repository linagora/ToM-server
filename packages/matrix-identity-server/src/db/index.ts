import { randomString, generateKeyPair } from '@twake/crypto'
import { type TwakeLogger } from '@twake/logger'
import { type Config, type DbGetResult } from '../types'
import { epoch } from '../utils'
import Pg from './sql/pg'
import Sqlite from './sql/sqlite'

export type SupportedDatabases = 'sqlite' | 'pg'

export type Collections =
  | 'accessTokens'
  | 'oneTimeTokens'
  | 'attempts'
  | 'keys'
  | 'hashes'
  | 'privateNotes'
  | 'roomTags'
  | 'userHistory'
  | 'userQuotas'
  | 'invitations'
  | 'longTermKeypairs'
  | 'shortTermKeypairs'

const cleanByExpires: Collections[] = ['oneTimeTokens', 'attempts']

type sqlComparaisonOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | '<>'

interface keyPair {
  publicKey: string
  privateKey: string
  keyId: string
}

interface keyPair {
  publicKey: string
  privateKey: string
  keyId: string
}

export interface ISQLCondition {
  field: string
  operator: sqlComparaisonOperator
  value: string | number
}

type Insert = (
  table: Collections,
  values: Record<string, string | number>
) => Promise<DbGetResult>
type Update = (
  table: Collections,
  values: Record<string, string | number>,
  field: string,
  value: string | number
) => Promise<DbGetResult>
type Get = (
  table: Collections,
  fields: string[],
  filterFields: Record<string, string | number | Array<string | number>>,
  order?: string
) => Promise<DbGetResult>
type GetCount = (
  table: Collections,
  field: string,
  value?: string | number | string[]
) => Promise<number>
type GetAll = (
  table: Collections,
  fields: string[],
  order?: string
) => Promise<DbGetResult>
type Match = (
  table: Collections,
  fields: string[],
  searchFields: string[],
  value: string | number
) => Promise<DbGetResult>
type DeleteEqual = (
  table: Collections,
  field: string,
  value: string | number
) => Promise<void>
type DeleteLowerThan = (
  table: Collections,
  field: string,
  value: string | number
) => Promise<void>

type DeleteWhere = (
  table: string,
  conditions: ISQLCondition | ISQLCondition[]
) => Promise<void>

export interface IdDbBackend {
  ready: Promise<void>
  createDatabases: (conf: Config, ...args: any) => Promise<void>
  insert: Insert
  get: Get
  getCount: GetCount
  getAll: GetAll
  getHigherThan: Get
  match: Match
  update: Update
  deleteEqual: DeleteEqual
  deleteLowerThan: DeleteLowerThan
  deleteWhere: DeleteWhere
  close: () => void
}
export type InsertType = (
  table: string,
  values: Array<string | number>
) => Promise<void>

class IdentityServerDb implements IdDbBackend {
  ready: Promise<void>
  db: IdDbBackend
  cleanJob?: NodeJS.Timeout
  cleanByExpires: Collections[]

  constructor(conf: Config, private readonly logger: TwakeLogger) {
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
    this.db = new Module(conf, this.logger)
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
  insert(table: Collections, values: Record<string, string | number>) {
    return this.db.insert(table, values)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  update(
    table: Collections,
    values: Record<string, string | number>,
    field: string,
    value: string | number
  ) {
    return this.db.update(table, values, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  get(
    table: Collections,
    fields: string[],
    filterFields: Record<string, string | number | Array<string | number>>
  ) {
    return this.db.get(table, fields, filterFields)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getCount(
    table: Collections,
    field: string,
    value?: string | number | string[]
  ) {
    return this.db.getCount(table, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getAll(table: Collections, fields: string[], order?: string) {
    return this.db.getAll(table, fields, order)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getHigherThan(
    table: Collections,
    fields: string[],
    filterFields: Record<string, string | number | Array<string | number>>,
    order?: string
  ): Promise<DbGetResult> {
    return this.db.getHigherThan(table, fields, filterFields, order)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  match(
    table: Collections,
    fields: string[],
    searchFields: string[],
    value: string | number
  ) {
    return this.db.match(table, fields, searchFields, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  deleteEqual(table: Collections, field: string, value: string | number) {
    return this.db.deleteEqual(table, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  deleteLowerThan(table: Collections, field: string, value: string | number) {
    return this.db.deleteLowerThan(table, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  deleteWhere(table: string, conditions: ISQLCondition | ISQLCondition[]) {
    // Deletes from table where filters correspond to values
    // Size of filters and values must be the same
    return this.db.deleteWhere(table, conditions)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createOneTimeToken(data: object, expires?: number): Promise<string> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    const id = randomString(64)
    // default: expires in 600 s
    const expiresForDb =
      epoch() + (expires != null && expires > 0 ? expires : 600)
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
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const _type = type === 'longTerm' ? 'longTermKeypairs' : 'shortTermKeypairs'
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
        cleanByExpires.map((table) => {
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
