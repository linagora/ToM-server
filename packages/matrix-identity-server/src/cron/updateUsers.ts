import { type TwakeLogger } from '@twake/logger'
import type IdentityServerDb from '../db'
import updateHash, { type UpdatableFields } from '../lookup/updateHash'
import MatrixDB from '../matrixDb'
import { type Config, type DbGetResult } from '../types'
import type UserDB from '../userdb'
import { epoch } from '../utils'

/**
 * updateUsers is a cron task that reads users from UserDB and find which of
 * them have to be updated inside hashes table
 * @param idServer Matrix identity server
 * @returns Promise<void>
 */
const updateUsers = async (
  conf: Config,
  db: IdentityServerDb,
  userDB: UserDB,
  logger: TwakeLogger
): Promise<void> => {
  /* Step 1: collect data
      - list of uid from userDB
      - list of uid from hashes table
      - list of uid from MatrixDB if available
  */
  const promises: Array<Promise<DbGetResult | string[] | null>> = [
    userDB.getAll('users', ['uid', 'mail', 'mobile']),
    db.getAll('hashes', ['value', 'active']),
    db.getAll('userHistory', ['address'])
  ]
  const isMatrixDbAvailable: boolean =
    Boolean(conf.matrix_database_host) && Boolean(conf.matrix_database_engine)
  const isFederatedIdentityServiceSet =
    (conf.federated_identity_services != null &&
      conf.federated_identity_services?.length > 0) ||
    conf.is_federated_identity_service

  if (isMatrixDbAvailable) {
    promises.push(
      new Promise((resolve, reject) => {
        const matrixDb = new MatrixDB(conf, logger)
        matrixDb.ready
          .then(() => {
            matrixDb
              .getAll('users', ['name'])
              .then((rows) => {
                matrixDb.close()
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
            logger.error('Unable to query Matrix DB', e)
            /* istanbul ignore next */
            resolve([])
          })
      })
    )
  }
  const res = await Promise.all(promises)
  const updates: Array<Promise<void> | Promise<DbGetResult>> = []
  // res[0] is the result of userDB.getAll('users', ['uid', 'mail', 'mobile'])
  const users = res[0] as DbGetResult
  // res[1] is the result of db.getAll('hashes', ['value', 'active'])
  const knownUids: string[] = (res[1] as DbGetResult).map((row) =>
    (row.value as string).replace(/^@(.*?):.*$/, '$1')
  )
  const knownActiveUsers = (res[1] as DbGetResult).map((row) => row.active)
  const matrixUsers = res[3] as string[]
  const existingHistory: Record<string, true> = {}
  if (res[2] != null)
    (res[2] as DbGetResult).forEach((histEntry) => {
      existingHistory[(histEntry as Record<string, string>).address] = true
    })
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
    const matrixAddress = `@${uid}:${conf.server_name}`
    const pos = knownUids.indexOf(uid)
    const isMatrixUser = matrixUsers.includes(uid)
    const data = {
      address: matrixAddress,
      timestamp,
      active: 1
    }
    if (pos < 0) {
      found = true
      data.active = isMatrixDbAvailable ? (isMatrixUser ? 1 : 0) : 1
      if (data.active !== 0)
        updates.push(
          existingHistory[matrixAddress]
            ? db.update('userHistory', data, 'address', matrixAddress)
            : db.insert('userHistory', data)
        )
      if (!isFederatedIdentityServiceSet || isMatrixUser) {
        usersToUpdate[matrixAddress] = {
          email: user.mail as string,
          phone: user.mobile as string,
          active: data.active
        }
      }
      logger.debug(
        `New user detected: ${user.uid as string}, status:`,
        data.active
      )
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    } else if (isMatrixUser && !knownActiveUsers[pos]) {
      updates.push(
        db.update('hashes', { active: 1 }, 'value', matrixAddress),
        existingHistory[matrixAddress]
          ? db.update('userHistory', data, 'address', matrixAddress)
          : db.insert('userHistory', data)
      )
      logger.debug(`User ${user.uid as string} becomes active`)
    }
  })

  // Step 3: launch hashes updates
  if (found) updates.push(updateHash(db, logger, usersToUpdate))

  const uids = users.map((user) => user.uid)

  const setInactive = async (address: string): Promise<void> => {
    logger.debug(`User ${address} becomes inactive`)
    const res = await db.get('userHistory', ['active'], {
      address
    })
    /* istanbul ignore else */
    if (res == null || res.length === 0) {
      await db.insert('userHistory', { address, active: 0, timestamp })
    } else if (res[0].active !== 0) {
      await db.update('userHistory', { active: 0 }, 'address', address)
    }
  }

  // uid in knwonUid are not uniques
  const seen: Record<string, boolean> = {}
  knownUids.forEach((uid, i) => {
    if (!uids.includes(uid)) {
      if (!seen[uid]) updates.push(setInactive(`@${uid}:${conf.server_name}`))
      seen[uid] = true
    }
  })

  // end: wait for promises (here catch avoids any server crash)
  if (updates.length > 0)
    await Promise.all(updates).catch((e) => {
      /* istanbul ignore next */
      logger.error('Error during user updates', e)
    })
}

export default updateUsers
