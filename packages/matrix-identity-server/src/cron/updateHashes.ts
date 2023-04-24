/**
 * Update hashes
 */

import { Hash, supportedHashes } from '@twake/crypto'
import { type Config } from '..'
import type IdentityServerDb from '../db'
import type UserDB from '../userdb'
import { randomString } from '../utils/tokenUtils'

const fieldsToHash = ['phone', 'email']
const dbFieldsToHash = ['mobile', 'mail']

// eslint-disable-next-line @typescript-eslint/promise-function-async
const updateHashes = (
  conf: Config,
  db: IdentityServerDb,
  userDB: UserDB
): Promise<void> => {
  return new Promise((resolve, reject) => {
    /**
     * Step 1:
     *  - drop old-old hashes
     *  - get current pepper
     */
    db.get('keys', ['data'], 'name', 'previousPepper')
      .then((rows) => {
        db.deleteEqual('hashes', 'pepper', rows[0].data).catch((e) => {
          /* istanbul ignore next */
          console.error('Unable to clean old hashes', e)
        })
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
          new Promise((resolve, reject) => {
            userDB
              .getAll('users', [...dbFieldsToHash, 'uid'])
              .then((rows) => {
                const hash = new Hash()
                hash.ready
                  .then(() => {
                    const promises: Array<Promise<void>> = []
                    if (fieldsToHash.length === 0) {
                      /* istanbul ignore next */
                      resolve(true)
                    } else {
                      rows.forEach((row) => {
                        fieldsToHash.forEach((field, i) => {
                          if (row[dbFieldsToHash[i]] != null) {
                            // eslint-disable-next-line @typescript-eslint/promise-function-async
                            supportedHashes.forEach((method: string) => {
                              promises.push(
                                db.insert('hashes', {
                                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
                                  // @ts-ignore method is a function of hash
                                  hash: hash[method](
                                    `${
                                      row[dbFieldsToHash[i]] as string
                                    } ${field} ${newPepper}`
                                  ),
                                  pepper: newPepper,
                                  type: field,
                                  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                                  value: `@${row.uid}:${conf.server_name}`
                                })
                              )
                            })
                          }
                        })
                      })
                      /* istanbul ignore if */
                      if (promises.length === 0) {
                        resolve(true)
                      } else {
                        Promise.all(promises)
                          .then(() => {
                            resolve(true)
                          })
                          .catch((e) => {
                            /* istanbul ignore next */
                            console.error('Unable to store hash', e)
                            /* istanbul ignore next */
                            reject(e)
                          })
                      }
                    }
                  })
                  .catch((e: any) => {
                    /* istanbul ignore next */
                    console.error('Unable to initialize js-nacl', e)
                    /* istanbul ignore next */
                    reject(e)
                  })
              })
              .catch((e) => {
                /* istanbul ignore next */
                console.error('Unable to parse user DB', e)
                /* istanbul ignore next */
                reject(e)
              })
          })
        ])
          .then(() => {
            db.update('keys', { data: newPepper }, 'name', 'pepper')
              .then(() => {
                console.log('Identity server: new pepper published', newPepper)
                resolve()
              })
              .catch((e) => {
                /* istanbul ignore next */
                console.error('Unable to publish new pepper', e)
                /* istanbul ignore next */
                reject(e)
              })
          })
          .catch((e) => {
            /* istanbul ignore next */
            console.error('Update hashes failed', e)
            /* istanbul ignore next */
            reject(e)
          })
      })
      .catch((e) => {
        /* istanbul ignore next */
        console.error('Update hashes failed', e)
        /* istanbul ignore next */
        reject(e)
      })
  })
}

export default updateHashes
