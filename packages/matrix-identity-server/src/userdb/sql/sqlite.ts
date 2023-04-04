import { type UserDBBackend } from '..'
import { type Config } from '../..'
import SQL from '../../db/sql/sql'

class UserDBSQLite extends SQL implements UserDBBackend {
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createDatabases (conf: Config): Promise<boolean> {
    return Promise.resolve(true)
  }
}

export default UserDBSQLite
