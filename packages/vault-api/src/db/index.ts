import { type Config } from '../utils'
import { VaultDBSQLite } from './sql/sqlite'
import { type VaultDbBackend, recoveryWords } from './utils'

export default class VaultDb {
  ready: Promise<void>
  db: VaultDbBackend
  constructor (conf: Config) {
    let Module
    /* istanbul ignore next */
    switch (conf.database_engine) {
      case 'sqlite': {
        Module = VaultDBSQLite
        break
      }
      default: {
        throw new Error(`Unsupported database type ${conf.database_engine}`)
      }
    }
    this.db = new Module(conf)
    this.ready = this.db.ready
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  insert (values: Record<string, string>): Promise<void> {
    return this.db.insert(recoveryWords.title, values).catch((e) => {
      throw e
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  get (userId: string): Promise<Array<Record<string, string | string>>> {
    return (
      this.db.get(recoveryWords.title, ['words'], 'userId', userId) as Promise<
      Array<Record<string, string | string>>
      >
    ).catch((e) => {
      throw e
    })
  }
}
