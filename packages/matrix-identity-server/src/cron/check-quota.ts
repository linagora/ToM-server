import type IdentityServerDb from '../db'
import MatrixDB, { type MatrixDBBackend } from '../matrixDb'
import type {
  Config,
  LocalMediaRepository,
  MatrixUser,
  UserQuota
} from '../types'

/**
 * check user quota cron job.
 *
 * @param {Config} conf - the configuration.
 * @param {IdentityServerDb} db - the identity server database.
 */
export default async (conf: Config, db: IdentityServerDb): Promise<void> => {
  try {
    const matrixDb: MatrixDBBackend = await initDatabase(conf)

    const users = await getMatrixUsers(matrixDb)
    await Promise.all(
      users.map(async (user) => {
        try {
          const usage = await getUserUsage(matrixDb, user)

          await saveUserUsage(db, user, usage)
        } catch (error) {
          db.logger.warn('Failed to save user usage', error)
        }
      })
    )
    matrixDb.close()
  } catch (error) {
    throw Error('Failed to check users quota', { cause: error })
  }
}

const initDatabase = async (conf: Config): Promise<MatrixDBBackend> => {
  try {
    if (
      conf.matrix_database_host == null ||
      conf.matrix_database_engine == null
    ) {
      throw new Error('Missing matrix database configuration')
    }

    const matrixDb = new MatrixDB(conf)
    await matrixDb.ready

    return matrixDb.db
  } catch (error) {
    throw Error('Failed to initialize matrix database', { cause: error })
  }
}

/**
 * Gets the list of all users from the matrix database.
 *
 * @param {MatrixDBBackend} db - the matrix database instance.
 * @returns {Promise<string[]>} - the list of all users.
 */
const getMatrixUsers = async (db: MatrixDBBackend): Promise<string[]> => {
  try {
    const users = (await db.getAll('users', [
      'name'
    ])) as unknown as MatrixUser[]

    return users.map(({ name }) => name)
  } catch (error) {
    throw Error('Failed to get matrix users', { cause: error })
  }
}

/**
 * Calculates the media usage for a given user from the local storage repository.
 *
 * @param {MatrixDBBackend} db - the matrix database instance.
 * @param {string} userId - the user id of the user to calculate the usage for.
 * @returns {Promise<number>} - the total size of the media for the given user.
 */
const getUserUsage = async (
  db: MatrixDBBackend,
  userId: string
): Promise<number> => {
  try {
    const userMedia = (await db.get(
      'local_media_repository',
      ['media_length'],
      { user_id: userId }
    )) as unknown as LocalMediaRepository[]

    return userMedia
      .map(({ media_length: mediaLength }) => +mediaLength)
      .reduce<number>((acc, length) => acc + length, 0)
  } catch (error) {
    throw Error('Failed to get user media usage', { cause: error })
  }
}

/**
 * Saves the media usage for a given user in the database.
 *
 * @param {IdentityServerDb} db -the identity server database instance.
 * @param {string} userId - the user id of which to save the usage for.
 * @param {number } size - the total size of the media.
 */
const saveUserUsage = async (
  db: IdentityServerDb,
  userId: string,
  size: number
): Promise<void> => {
  try {
    await db.deleteEqual('userQuotas', 'user_id', userId)

    await db.insert('userQuotas', {
      user_id: userId,
      size
    } satisfies UserQuota)
  } catch (error) {
    throw Error('Failed to save user media usage', { cause: error })
  }
}
