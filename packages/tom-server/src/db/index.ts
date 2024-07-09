import type TwakeServer from '..'
import type { IdentityServerDb } from '../types'

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
              recoveryWords: 'userId text PRIMARY KEY, words TEXT',
              matrixTokens: 'id varchar(64) PRIMARY KEY, data text',
              privateNotes:
                'id varchar(64) PRIMARY KEY, authorId varchar(64), content text, targetId varchar(64)',
              roomTags:
                'id varchar(64) PRIMARY KEY, authorId varchar(64), content text, roomId varchar(64)',
              userQuotas: 'user_id varchar(64) PRIMARY KEY, size int',
              rooms: 'id varchar(64) PRIMARY KEY, filter varchar(64)',
              activeContacts: 'userId text PRIMARY KEY, contacts text'
            },
            {},
            {},
            server.logger
          )
          .then(() => {
            server.db = server.idServer.db // as TwakeDB
            // @ts-expect-error matrixTokens isn't member of Collections
            server.db.cleanByExpires.push('matrixTokens')
            resolve()
          })
          /* istanbul ignore next */
          .catch(reject)
        break
      default:
        /* istanbul ignore next */ throw new Error(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Unsupported DB type ${server.conf.database_engine}`
        )
    }
  })
}

export default initializeDb
