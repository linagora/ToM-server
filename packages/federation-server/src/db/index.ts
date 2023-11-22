import { type TwakeLogger } from '@twake/logger'
import {
  type SQLite,
  createTables,
  type Pg
} from '@twake/matrix-identity-server'
import { type Collections, type Config, type IdentityServerDb } from '../types'

export const hashByServer = 'hashByServer' as Collections

// eslint-disable-next-line @typescript-eslint/promise-function-async
const initializeDb = (
  db: IdentityServerDb,
  conf: Config,
  logger: TwakeLogger
): Promise<void> => {
  return new Promise((resolve, reject) => {
    switch (conf.database_engine) {
      case 'sqlite':
      case 'pg':
        createTables(
          db.db as SQLite.default | Pg,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          {
            hashByServer:
              'hash varchar(48), server text, active integer, PRIMARY KEY (hash, server)'
          } as unknown as Record<Collections, string>,
          {},
          {},
          logger,
          resolve,
          reject
        )
        break
      default:
        /* istanbul ignore next */ throw new Error(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Unsupported DB type ${conf.database_engine}`
        )
    }
  })
}

export default initializeDb
