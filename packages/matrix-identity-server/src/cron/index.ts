/**
 * Scheduler
 */

import { type TwakeLogger } from '@twake/logger'
import cron, { type ScheduledTask } from 'node-cron'
import type IdentityServerDb from '../db'
import { type Config } from '../types'
import type UserDB from '../userdb'
import updateHashes from './changePepper'
import checkQuota from './check-quota'
import updateFederatedIdentityHashes from './update-federated-identity-hashes'
import updateUsers from './updateUsers'

class CronTasks {
  tasks: ScheduledTask[]
  ready: Promise<void>
  readonly options: Record<string, string | number> = { timezone: 'GMT' }

  constructor(
    conf: Config,
    db: IdentityServerDb,
    userDB: UserDB,
    logger: TwakeLogger
  ) {
    this.tasks = []
    this.ready = this.init(conf, db, userDB, logger)
  }

  stop(): void {
    this.tasks.forEach((task) => {
      task.stop()
    })
  }

  /**
   * Initializes the cron tasks
   *
   * @param {Config} conf - the config
   * @param {IdentityServerDb} db - the identity server db instance
   * @param {UserDB} userDB - the user db instance
   * @param {TwakeLogger} logger - the logger
   */
  private readonly init = async (
    conf: Config,
    db: IdentityServerDb,
    userDB: UserDB,
    logger: TwakeLogger
  ): Promise<void> => {
    try {
      if (!conf.cron_service) return

      const cronTasks = [
        this._addUpdateHashesJob(conf, db, userDB, logger),
        this._addCheckUserQuotaJob(conf, db, logger)
      ]

      if (
        conf.federated_identity_services != null &&
        conf.federated_identity_services.length > 0
      ) {
        logger.debug(
          `federated_identity_services set to [${conf.federated_identity_services.join(
            ', '
          )}], add task`
        )
        cronTasks.push(
          this._addUpdateFederatedIdentityHashesJob(conf, userDB, logger)
        )
      }
      await Promise.all(cronTasks)
      logger.debug('Cron tasks initialized')
    } catch (error) {
      // istanbul ignore next
      throw Error(`Failed to initialize cron tasks: ${error}`)
    }
  }

  /**
   * Update the hashes job.
   *
   * @param {Config} conf - the config
   * @param {IdentityServerDb} db - the identity server db instance
   * @param {UserDB} userDB - the user db instance
   * @param {TwakeLogger} logger - the logger
   */
  private readonly _addUpdateHashesJob = async (
    conf: Config,
    db: IdentityServerDb,
    userDB: UserDB,
    logger: TwakeLogger
  ): Promise<void> => {
    const cronString: string = conf.update_users_cron ?? '0 0 0 * * *'
    const pepperCron: string = conf.pepperCron ?? '0 0 0 * * *'

    if (!cron.validate(cronString)) {
      // istanbul ignore next
      throw new Error(`Invalid cron line: ${cronString}`)
    }

    if (!cron.validate(pepperCron)) {
      // istanbul ignore next
      throw new Error(`Invalid cron line: ${pepperCron}`)
    }

    const _addJob = (): void => {
      const updateHashesTask = cron.schedule(
        pepperCron,
        () => {
          updateHashes(conf, db, userDB, logger)
            .then(() => logger.debug('Pepper update succeeded'))
            .catch((e) => {
              // istanbul ignore next
              logger.error('Pepper update failed', e)
            })
        },
        this.options
      )

      const updateUsersTask = cron.schedule(
        cronString,
        () => {
          updateUsers(conf, db, userDB, logger)
            .then(() => logger.debug('Users update succeeded'))
            .catch((e) => {
              // istanbul ignore next
              logger.error('Users update failed', e)
            })
        },
        this.options
      )

      logger.debug('Add tasks: updateHashesTask updateUsersTask')
      this.tasks.push(updateHashesTask)
      this.tasks.push(updateUsersTask)
    }

    try {
      if (!conf.cron_service) return

      const count = await db.getCount('hashes', 'hash')

      // istanbul ignore if
      if (count > 0) {
        logger.debug('Previous hashes detected')
        _addJob()
      } else {
        logger.debug('No previous hashes detected, launching an update')
        await updateHashes(conf, db, userDB, logger)
        _addJob()
      }
    } catch (error) {
      // istanbul ignore next
      throw Error('Failed to add update hashes job')
    }
  }

  /**
   * Adds the check user quota job
   *
   * @param {Config} conf - the configuration
   * @param {IdentityServerDb} db - the identity server db instance
   * @param {TwakeLogger} logger - the logger
   */
  private readonly _addCheckUserQuotaJob = async (
    conf: Config,
    db: IdentityServerDb,
    logger: TwakeLogger
  ): Promise<void> => {
    const cronString = conf.check_quota_cron ?? '0 0 0 * * *'

    if (!cron.validate(cronString)) {
      // istanbul ignore next
      throw new Error(`Invalid cron line: ${cronString}`)
    }

    const task = cron.schedule(
      cronString,
      () => {
        checkQuota(conf, db, logger)
          .then(() => logger.debug('User quota check succeeded'))
          .catch((e) => {
            // istanbul ignore next
            logger.error('User quota check failed', e)
          })
      },
      this.options
    )

    logger.debug('Add task userQuotas')
    this.tasks.push(task)
  }

  /**
   * Adds the federated identity service hashes job.
   *
   * @param {Config} conf - the config
   * @param {UserDB} userDB - the user db instance
   * @param {TwakeLogger} logger - the logger
   */
  private readonly _addUpdateFederatedIdentityHashesJob = async (
    conf: Config,
    userDB: UserDB,
    logger: TwakeLogger
  ): Promise<void> => {
    const cronString: string =
      conf.update_federated_identity_hashes_cron ?? '3 3 3 * * *'

    if (!cron.validate(cronString)) {
      // istanbul ignore next
      throw new Error(`Invalid cron line: ${cronString}`)
    }

    const task = cron.schedule(
      cronString,
      () => {
        updateFederatedIdentityHashes(conf, userDB, logger)
          .then(() =>
            logger.debug('Federated identity hashes update succeeded')
          )
          .catch((e: Error) => {
            // istanbul ignore next
            logger.error(`${e.message}. Reason: ${e.cause as string}`)
          })
      },
      this.options
    )

    logger.debug('Add task federatedIdentityUpdates')
    this.tasks.push(task)
  }
}

export default CronTasks
