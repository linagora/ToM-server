/**
 * Change pepper and update hashes
 */

import { type DbGetResult } from '../types'
import type MatrixIdentityServer from '..'
import { randomString } from '../utils/tokenUtils'
import MatrixDB from '../matrixDb'
import updateHash, { type UpdatableFields } from '../lookup/updateHash'

const dbFieldsToHash = ['mobile', 'mail']

// eslint-disable-next-line @typescript-eslint/promise-function-async
const updateHashes = (idServer: MatrixIdentityServer): Promise<void> => {
  const conf = idServer.conf
  const db = idServer.db
  const userDB = idServer.userDB
  const isMatrixDbAvailable =
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    conf.matrix_database_host &&
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    conf.matrix_database_engine

  // If Matrix DB is available, this function filter inactive users
  const _filter = async (rows: DbGetResult): Promise<DbGetResult> => {
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (isMatrixDbAvailable) {
      const matrixDb = new MatrixDB(conf)
      await matrixDb.ready
      const entries = await matrixDb.getAll('users', ['name']).catch((e) => {
        /* istanbul ignore next */
        console.error('Unable to query Matrix DB', e)
      })
      matrixDb.close()
      /* istanbul ignore if */
      if (entries == null) {
        return rows
      }
      const names: string[] = []
      entries.forEach((row) => {
        names.push((row.name as string).replace(/^@(.*?):(?:.*)$/, '$1'))
      })
      for (let i = 0; i < rows.length; i++) {
        if (names.includes(rows[i].uid as string)) rows[i].active = 1
      }
    }
    return rows
  }

  return new Promise((resolve, reject) => {
    const logAndReject = (msg: string) => {
      return (e: any) => {
        /* istanbul ignore next */
        console.error(msg, e)
        /* istanbul ignore next */
        reject(e)
      }
    }
    /**
     * Step 1:
     *  - drop old-old hashes
     *  - get current pepper
     */
    db.get('keys', ['data'], 'name', 'previousPepper')
      .then((rows) => {
        db.deleteEqual('hashes', 'pepper', rows[0].data as string).catch(
          (e) => {
            /* istanbul ignore next */
            console.error('Unable to clean old hashes', e)
          }
        )
      })
      .catch((e) => {
        // Previous value may not exist
      })
    db.get('keys', ['data'], 'name', 'pepper')
      .then((values: unknown[]) => {
        /**
         * Step 2:
         *  - generate new pepper
         *  - set previousPepper to current value
         *  - calculate new hashes and populate hashes database
         */
        const newPepper = randomString(32)
        Promise.all([
          // move current pepper to 'previousPepper'
          db.update(
            'keys',
            { data: values[0] as string },
            'name',
            'previousPepper'
          ),
          // New hashes
          new Promise((_resolve, _reject) => {
            userDB
              .getAll('users', [...dbFieldsToHash, 'uid'])
              .then(_filter)
              .then((rows: DbGetResult) => {
                const init: UpdatableFields = {}
                updateHash(
                  idServer,
                  rows.reduce((res, row) => {
                    res[`@${row.uid as string}:${conf.server_name}`] = {
                      email: row.mail as string,
                      phone: row.mobile as string,
                      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                      active: isMatrixDbAvailable ? (row.active as number) : 1
                    }
                    return res
                  }, init) as unknown as UpdatableFields,
                  newPepper
                )
                  .then(_resolve)
                  .catch(_reject)
              })
              .catch((e) => {
                /* istanbul ignore next */
                console.error('Unable to parse user DB', e)
                /* istanbul ignore next */
                reject(e)
              })
              .catch(logAndReject('Unable to parse user DB'))
          })
        ])
          .then(() => {
            db.update('keys', { data: newPepper }, 'name', 'pepper')
              .then(() => {
                console.log('Identity server: new pepper published', newPepper)
                resolve()
              })
              .catch(logAndReject('Unable to publish new pepper'))
          })
          .catch(logAndReject('Update hashes failed'))
      })
      .catch(logAndReject('Update hashes failed'))
  })
}

export default updateHashes
