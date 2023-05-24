import type MatrixIdentityServer from '..'
import { MatrixDB } from '..'
import { type DbGetResult } from '..'
import updateHash, { type UpdatableFields } from '../lookup/updateHash'

/**
 * updateUsers is a cron task that reads users from UserDB and find which of
 * them have to be updated inside hashes table
 * @param idServer Matrix identity server
 * @returns Promise<void>
 */
const updateUsers = async (idServer: MatrixIdentityServer): Promise<void> => {
  /* Step 1: collect data
      - list of uid from userDB
      - list of uid from hashes table
      - list of uid from MatrixDB if available
  */
  const promises: Array<Promise<DbGetResult | string[] | null>> = [
    idServer.userDB.getAll('users', ['uid', 'mail', 'mobile']),
    idServer.db.getAll('hashes', ['value', 'active'])
  ]
  const isMatrixDbAvailable: boolean =
    Boolean(idServer.conf.matrix_database_host) &&
    Boolean(idServer.conf.matrix_database_engine)
  if (isMatrixDbAvailable) {
    promises.push(
      new Promise((resolve, reject) => {
        const matrixDb = new MatrixDB(idServer.conf)
        matrixDb.ready
          .then(() => {
            matrixDb
              .getAll('users', ['name'])
              .then((rows) => {
                resolve(
                  rows.map((row) =>
                    (row.name as string).replace(/^@(.*?):.*$/, '$1')
                  )
                )
              })
              .catch(reject)
          })
          .catch((e) => {
            /* istanbul ignore next */
            console.error('Unable to query Matrix DB', e)
            /* istanbul ignore next */
            resolve([])
          })
      })
    )
  }
  const res = await Promise.all(promises)
  const updates: Array<Promise<void>> = []
  const users = res[0] as DbGetResult
  const knownUids: string[] = (res[1] as DbGetResult).map((row) =>
    (row.value as string).replace(/^@(.*?):.*$/, '$1')
  )
  const knownActiveUsers = (res[1] as DbGetResult).map((row) => row.active)
  const matrixUsers = res[2] as string[]
  const usersToUpdate: UpdatableFields = {}

  /*
    Step 2: find:
     - new users (uid not in knownUids array)
     - new active users
  */
  let found = false
  users.forEach((user) => {
    const uid = user.uid as string
    const matrixAddress = `@${uid}:${idServer.conf.server_name}`
    const pos = knownUids.indexOf(uid)
    if (pos < 0) {
      found = true
      usersToUpdate[matrixAddress] = {
        email: user.mail as string,
        phone: user.mobile as string,
        active: isMatrixDbAvailable ? (matrixUsers.includes(uid) ? 1 : 0) : 1
      }
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    } else if (matrixUsers.includes(uid) && !knownActiveUsers[pos]) {
      updates.push(
        idServer.db.update('hashes', { active: 1 }, 'value', matrixAddress)
      )
    }
  })

  // Step 3: launch updates
  if (found) updates.push(updateHash(idServer, usersToUpdate))
  if (updates.length > 0) await Promise.all(updates)
}

export default updateUsers
