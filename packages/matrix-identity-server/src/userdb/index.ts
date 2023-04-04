import { type Config } from '../index'
import UserDBSQLite from './sql/sqlite'

export type SupportedUserDatabases = 'sqlite' | 'ldap'

export type Collections = 'users' | 'groups'

type Get = (table: Collections, fields: string[], field: string, value: string | number) => Promise<Array<Record<string, string | string[] | number >>>

export interface UserDBBackend {
  ready: Promise<void>
  get: Get
}

class UserDB {
  ready: Promise<void>
  db: UserDBBackend
  constructor (conf: Config) {
    let Module
    /* istanbul ignore next */
    switch (conf.database_engine) {
      case 'sqlite': {
        Module = UserDBSQLite
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
}

export default UserDB
