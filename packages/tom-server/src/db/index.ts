import type IdentityServerDb from '@twake/matrix-identity-server/dist/db'
import type TwakeServer from '..'

export type TwakeDB = IdentityServerDb

// eslint-disable-next-line @typescript-eslint/promise-function-async
const initializeDb = (server: TwakeServer): Promise<void> => {
  return new Promise((resolve, reject) => {
    switch (server.conf.database_engine) {
      case 'sqlite':
      case 'pg':
        server.idServer.db
          .createDatabases(
            server.conf,
            {
              recoveryWords: 'userId text PRIMARY KEY, words TEXT'
            },
            {},
            {}
          )
          .then(() => {
            server.db = server.idServer.db // as TwakeDB
            resolve()
          })
          /* istanbul ignore next */
          .catch((e) => reject)
        break
      default: // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        /* istanbul ignore next */ throw new Error(
          `Unsupported DB type ${server.conf.database_engine}`
        )
    }
  })
}

export default initializeDb
