import { type TwakeLogger } from '@twake/logger'
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
 * @param {IdentityServerDb<T>} db - the identity server database.
 */
export default async <T extends string = never>(
  conf: Config,
  db: IdentityServerDb<T>,
  logger: TwakeLogger
): Promise<void> => {
  try {
    const matrixDb: MatrixDBBackend = await initDatabase(conf, logger)

    const users = await getMatrixUsers(matrixDb)
    const errors: Array<{ userId: string; error: unknown }> = []
    await Promise.all(
      users.map(async (user) => {
        try {
          const usage = await getUserUsage(matrixDb, user)

          await saveUserUsage(db, user, usage)
        } catch (error) {
          const cause = error instanceof Error ? error.cause : undefined
          logger.error('Failed to save user usage', {
            userId: user,
            error,
            cause
          })
          errors.push({ userId: user, error })
        }
      })
    )
    matrixDb.close()
    if (errors.length > 0) {
      throw Error(
        `Failed to save usage for ${errors.length} user(s): ${errors
          .map((e) => e.userId)
          .join(', ')}`
      )
    }
  } catch (error) {
    // istanbul ignore next
    throw Error('Failed to check users quota', { cause: error })
  }
}

const initDatabase = async (
  conf: Config,
  logger: TwakeLogger
): Promise<MatrixDBBackend> => {
  try {
    if (
      conf.matrix_database_host == null ||
      conf.matrix_database_engine == null
    ) {
      // istanbul ignore next
      throw new Error('Missing matrix database configuration')
    }

    const matrixDb = new MatrixDB(conf, logger)
    await matrixDb.ready

    return matrixDb.db
  } catch (error) {
    // istanbul ignore next
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
    // istanbul ignore next
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
    // istanbul ignore next
    throw Error('Failed to get user media usage', { cause: error })
  }
}

/**
 * Saves the media usage for a given user in the database.
 * Attempts an update first; falls back to insert if no record exists.
 * This avoids data loss from the previous delete-then-insert pattern
 * where a failed insert would leave the user with no quota record.
 *
 * @param {IdentityServerDb<T>} db -the identity server database instance.
 * @param {string} userId - the user id of which to save the usage for.
 * @param {number } size - the total size of the media.
 */
const saveUserUsage = async <T extends string = never>(
  db: IdentityServerDb<T>,
  userId: string,
  size: number
): Promise<void> => {
  try {
    const updated = await db.update(
      'userQuotas',
      { size } satisfies Omit<UserQuota, 'user_id'>,
      'user_id',
      userId
    )

    if (!Array.isArray(updated) || updated.length === 0) {
      await db.insert('userQuotas', {
        user_id: userId,
        size
      } satisfies UserQuota)
    }
  } catch (error) {
    throw Error(`Failed to save user media usage for ${userId}`, {
      cause: error
    })
  }
}
