import { type Config } from '../index'
import UserDBLDAP from './ldap'
import UserDBPg from './sql/pg'
import UserDBSQLite from './sql/sqlite'

export type SupportedUserDatabases = 'sqlite' | 'pg' | 'ldap'

export type Collections = 'users' | 'groups'

type Get = (table: Collections, fields: string[], field: string, value: string | number) => Promise<Array<Record<string, string | string[] | number >>>
type GetAll = (table: Collections, fields: string[]) => Promise<Array<Record<string, string | string[] | number >>>

export interface UserDBBackend {
  ready: Promise<void>
  get: Get
  getAll: GetAll
}

class UserDB implements UserDBBackend {
  ready: Promise<void>
  db: UserDBBackend
  constructor (conf: Config) {
    let Module
    /* istanbul ignore next */
    switch (conf.userdb_engine) {
      case 'sqlite': {
        Module = UserDBSQLite
        break
      }
      case 'pg': {
        Module = UserDBPg
        break
      }
      case 'ldap': {
        Module = UserDBLDAP
        break
      }
      default: {
        throw new Error(`Unsupported database type ${conf.database_engine}`)
      }
    }
    this.db = new Module(conf)
    this.ready = new Promise((resolve, reject) => {
      this.db.ready.then(() => {
        // TODO: insert here init if needed
        resolve()
      }).catch(e => {
        /* istanbul ignore next */
        reject(e)
      })
    })
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  get (table: Collections, fields: string[], field: string, value: string | number) {
    return this.db.get(table, fields, field, value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/promise-function-async
  getAll (table: Collections, fields: string[]) {
    return this.db.getAll(table, fields)
  }
}

export default UserDB
