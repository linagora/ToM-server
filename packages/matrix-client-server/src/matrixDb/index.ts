import { type TwakeLogger } from '@twake/logger'
import { type Config, type DbGetResult } from '../types'
import MatrixDBPg from './sql/pg'
import MatrixDBSQLite from './sql/sqlite'
import { randomString } from '@twake/crypto'
import { epoch } from '@twake/utils'

export type Collections =
  | 'users'
  | 'profiles'
  | 'destinations'
  | 'events'
  | 'state_events'
  | 'current_state_events'
  | 'event_forward_extremities'
  | 'event_backward_extremities'
  | 'rooms'
  | 'room_memberships'
  | 'room_aliases'
  | 'room_stats_state'
  | 'room_depth'
  | 'room_tags'
  | 'room_account_data'
  | 'local_current_membership'
  | 'server_signature_keys'
  | 'rejections'
  | 'local_media_repository'
  | 'redactions'
  | 'user_ips'
  | 'registration_tokens'
  | 'account_data'
  | 'devices'
  | 'threepid_validation_token'
  | 'threepid_validation_session'
  | 'user_threepids'
  | 'presence'
  | 'user_threepid_id_server'
  | 'access_tokens'
  | 'refresh_tokens'
  | 'open_id_tokens'
  | 'user_filters'
  | 'ui_auth_sessions'
  | 'ui_auth_sessions_ips'
  | 'ui_auth_sessions_credentials'
  | 'stream_positions'
  | 'users_in_public_rooms'
  | 'users_who_share_private_rooms'
  | 'user_directory'
  | 'user_directory_search'
  | 'pushers'
  | 'deleted_pushers'
  | 'erased_users'
  | 'event_expiry'
  | 'account_validity'
  | 'ignored_users'
  | 'push_rules'
  | 'push_rules_enable'
  | 'push_rules_stream'
  | 'e2e_room_keys'
  | 'e2e_room_keys_versions'
  | 'e2e_device_keys_json'
  | 'e2e_one_time_keys_json'
  | 'e2e_fallback_keys_json'
  | 'event_json'
  | 'device_auth_providers'
  | 'dehydrated_devices'
  | 'device_inbox'

type sqlComparaisonOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | '<>'
interface ISQLCondition {
  field: string
  operator: sqlComparaisonOperator
  value: string | number
}

type Get = (
  table: Collections,
  fields: string[],
  filterFields: Record<string, string | number | Array<string | number>>,
  order?: string
) => Promise<DbGetResult>
type Get2 = (
  table: Collections,
  fields: string[],
  filterFields1: Record<string, string | number | Array<string | number>>,
  filterFields2: Record<string, string | number | Array<string | number>>,
  order?: string
) => Promise<DbGetResult>
type GetJoin = (
  tables: Collections[],
  fields: string[],
  filterFields: Record<string, string | number | Array<string | number>>,
  joinFields: Record<string, string>,
  order?: string
) => Promise<DbGetResult>
type GetMinMax = (
  table: Collections,
  targetField: string,
  fields: string[],
  filterFields: Record<string, string | number | Array<string | number>>,
  order?: string
) => Promise<DbGetResult>
type GetMinMax2 = (
  table: Collections,
  targetField: string,
  fields: string[],
  filterFields1: Record<string, string | number | Array<string | number>>,
  filterFields2: Record<string, string | number | Array<string | number>>,
  order?: string
) => Promise<DbGetResult>
type GetMinMaxJoin2 = (
  tables: Collections[],
  targetField: string,
  fields: string[],
  filterFields1: Record<string, string | number | Array<string | number>>,
  filterFields2: Record<string, string | number | Array<string | number>>,
  joinFields: Record<string, string>,
  order?: string
) => Promise<DbGetResult>

type GetAll = (table: Collections, fields: string[]) => Promise<DbGetResult>

type Insert = (
  table: Collections,
  values: Record<string, string | number>
) => Promise<DbGetResult>
type updateWithConditions = (
  table: Collections,
  values: Record<string, string | number | null>,
  conditions: Array<{ field: string; value: string | number }>
) => Promise<DbGetResult>
type Upsert = (
  table: Collections,
  values: Record<string, string | number>,
  conflictFields: string[]
) => Promise<DbGetResult>
type DeleteEqual = (
  table: Collections,
  field: string,
  value: string | number
) => Promise<void>
type DeleteWhere = (
  table: Collections,
  conditions: ISQLCondition | ISQLCondition[]
) => Promise<void>
type SearchUserDirectory = (
  userId: string,
  searchTerm: string,
  limit: number,
  searchAllUsers: boolean
) => Promise<DbGetResult>
type GetMaxStreamId = (
  userId: string,
  deviceId: string,
  lowerBoundStreamId: number,
  upperBoundStreamId: number,
  limit: number
) => Promise<number | null>

export interface MatrixDBmodifiedBackend {
  ready: Promise<void>
  get: Get
  getJoin: GetJoin
  getWhereEqualOrDifferent: Get2
  getWhereEqualAndHigher: Get2
  getMaxWhereEqual: GetMinMax
  getMaxWhereEqualAndLower: GetMinMax2
  getMinWhereEqualAndHigher: GetMinMax2
  getMaxWhereEqualAndLowerJoin: GetMinMaxJoin2
  getAll: GetAll
  insert: Insert
  upsert: Upsert
  deleteEqual: DeleteEqual
  deleteWhere: DeleteWhere
  updateWithConditions: updateWithConditions
  getMaxStreamId: GetMaxStreamId // This function is only used in the delete_devices function
  // The following functions are specific to the user_directory module
  searchUserDirectory: SearchUserDirectory
  close: () => void
}

class MatrixDBmodified implements MatrixDBmodifiedBackend {
  ready: Promise<void>
  db: MatrixDBmodifiedBackend

  constructor(conf: Config, private readonly logger: TwakeLogger) {
    let Module
    /* istanbul ignore next */
    switch (conf.matrix_database_engine) {
      case 'sqlite': {
        Module = MatrixDBSQLite
        break
      }
      case 'pg': {
        Module = MatrixDBPg
        break
      }
      default: {
        throw new Error(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Unsupported matrix-database type ${conf.matrix_database_engine}`
        )
      }
    }
    this.db = new Module(conf, this.logger)
    this.ready = new Promise((resolve, reject) => {
      this.db.ready
        .then(() => {
          resolve()
        })
        /* istanbul ignore next */
        .catch(reject)
    })
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getAll(table: Collections, fields: string[]) {
    return this.db.getAll(table, fields)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  get(
    table: Collections,
    fields: string[],
    filterFields: Record<string, string | number | Array<string | number>>,
    order?: string
  ) {
    return this.db.get(table, fields, filterFields, order)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getJoin(
    table: Collections[],
    fields: string[],
    filterFields: Record<string, string | number | Array<string | number>>,
    joinFields: Record<string, string>,
    order?: string
  ) {
    return this.db.getJoin(table, fields, filterFields, joinFields, order)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getWhereEqualOrDifferent(
    table: Collections,
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
    table: Collections,
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
    table: Collections,
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
    table: Collections,
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
    table: Collections,
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
    tables: Collections[],
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
  insert(table: Collections, values: Record<string, string | number>) {
    return this.db.insert(table, values)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  upsert(
    table: Collections,
    values: Record<string, string | number>,
    conflictFields: string[]
  ) {
    /* Be careful it requires that there is a primary key or unique constraint on the conflictFields */
    return this.db.upsert(table, values, conflictFields)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  deleteEqual(table: Collections, field: string, value: string | number) {
    return this.db.deleteEqual(table, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  deleteWhere(table: Collections, conditions: ISQLCondition | ISQLCondition[]) {
    // Deletes from table where filters correspond to values
    // Size of filters and values must be the same
    return this.db.deleteWhere(table, conditions)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  updateWithConditions(
    table: Collections,
    values: Record<string, string | number | null>,
    conditions: Array<{ field: string; value: string | number }>
  ) {
    return this.db.updateWithConditions(table, values, conditions)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createOneTimeToken(
    sessionId: string,
    expires?: number,
    nextLink?: string
  ): Promise<string> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    const token = randomString(64)
    // default: expires in 600 s
    const expiresForDb =
      epoch() + 1000 * (expires != null && expires > 0 ? expires : 600)
    return new Promise((resolve, reject) => {
      const insertData: Record<string, any> = {
        token,
        expires: expiresForDb,
        session_id: sessionId
      }
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (nextLink) {
        insertData.next_link = nextLink
      }

      this.db
        .insert('threepid_validation_token', insertData)
        .then(() => {
          resolve(token)
        })
        .catch((err) => {
          /* istanbul ignore next */
          this.logger.error('Failed to insert token', err)
          /* istanbul ignore next */
          reject(err)
        })
    })
  }

  // No difference in creation between a token and a one-time-token
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createToken(sessionId: string, expires?: number): Promise<string> {
    return this.createOneTimeToken(sessionId, expires)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  verifyToken(token: string): Promise<object> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    return new Promise((resolve, reject) => {
      this.db
        .get(
          'threepid_validation_token',
          ['session_id', 'expires', 'next_link'],
          { token }
        )
        .then((rows) => {
          /* istanbul ignore else */
          if (rows.length > 0 && (rows[0].expires as number) >= epoch()) {
            this.db
              .get('threepid_validation_session', ['client_secret'], {
                session_id: rows[0].session_id
              })
              .then((validationRows) => {
                const body: any = {}
                // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                if (rows[0].next_link) {
                  body.next_link = rows[0].next_link
                }
                resolve({
                  ...body,
                  session_id: rows[0].session_id,
                  client_secret: validationRows[0].client_secret
                })
              })
              .catch((e) => {
                // istanbul ignore next
                reject(e)
              })
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
  deleteToken(token: string): Promise<void> {
    /* istanbul ignore if */
    if (this.db == null) {
      throw new Error('Wait for database to be ready')
    }
    return new Promise((resolve, reject) => {
      this.db
        .deleteEqual('threepid_validation_token', 'token', token)
        .then(() => {
          resolve()
        })
        .catch((e) => {
          /* istanbul ignore next */
          this.logger.info(`Token ${token} already deleted`, e)
          /* istanbul ignore next */
          resolve()
        })
    })
  }

  close(): void {
    this.db.close()
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getMaxStreamId(
    userId: string,
    deviceId: string,
    lowerBoundStreamId: number,
    upperBoundStreamId: number,
    limit: number
  ) {
    return this.db.getMaxStreamId(
      userId,
      deviceId,
      lowerBoundStreamId,
      upperBoundStreamId,
      limit
    )
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  searchUserDirectory(
    userId: string,
    searchTerm: string,
    limit: number,
    searchAllUsers: boolean
  ) {
    return this.db.searchUserDirectory(
      userId,
      searchTerm,
      limit,
      searchAllUsers
    )
  }
}

export default MatrixDBmodified
