import type MatrixIdentityServer from '..'
import { MatrixDB } from '..'
import { type DbGetResult } from '..'
import updateHash, { type UpdatableFields } from '../lookup/updateHash'
import { epoch } from '../utils'

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
  // res[0] is the result of userDB.getAll('users', ['uid', 'mail', 'mobile'])
  const users = res[0] as DbGetResult
  // res[1] is the result of db.getAll('hashes', ['value', 'active'])
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
  const timestamp = epoch()
  users.forEach((user) => {
    const uid = user.uid as string
    const matrixAddress = `@${uid}:${idServer.conf.server_name}`
    const pos = knownUids.indexOf(uid)
    if (pos < 0) {
      found = true
      const active = isMatrixDbAvailable
        ? matrixUsers.includes(uid)
          ? 1
          : 0
        : 1
      if (active !== 0)
        updates.push(
          idServer.db.insert('userHistory', {
            address: matrixAddress,
            timestamp,
            active
          })
        )
      usersToUpdate[matrixAddress] = {
        email: user.mail as string,
        phone: user.mobile as string,
        active
      }
      console.log(`New user detected: ${user.uid as string}, status:`, active)
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    } else if (matrixUsers.includes(uid) && !knownActiveUsers[pos]) {
      updates.push(
        idServer.db.update('hashes', { active: 1 }, 'value', matrixAddress),
        idServer.db.insert('userHistory', {
          address: matrixAddress,
          timestamp,
          active: 1
        })
      )
      console.log(`User ${user.uid as string} becomes active`)
    }
  })

  // Step 3: launch hashes updates
  if (found) updates.push(updateHash(idServer, usersToUpdate))

  const uids = users.map((user) => user.uid)

  const setInactive = async (address: string): Promise<void> => {
    const res = await idServer.db.get(
      'userHistory',
      ['active'],
      'address',
      address
    )
    /* istanbul ignore else */
    if (res == null || res.length === 0) {
      await idServer.db.insert('userHistory', { address, active: 0, timestamp })
    } else if (res[0].active !== 0) {
      await idServer.db.update('userHistory', { active: 0 }, 'address', address)
    }
  }

  // uid in knwonUid are not uniques
  const seen: Record<string, boolean> = {}
  knownUids.forEach((uid, i) => {
    if (!uids.includes(uid)) {
      if (!seen[uid])
        updates.push(setInactive(`@${uid}:${idServer.conf.server_name}`))
      seen[uid] = true
    }
  })

  // end: wait for promises (here catch avoids any server crash)
  if (updates.length > 0)
    await Promise.all(updates).catch((e) => {
      /* istanbul ignore next */
      console.error('Error during user updates', e)
    })
}

export default updateUsers
