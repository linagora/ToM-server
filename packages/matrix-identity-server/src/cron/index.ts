/**
 * Scheduler
 */

import { type TwakeLogger } from '@twake/logger'
import cron, { type ScheduledTask } from 'node-cron'
import type UserDB from '../userdb'
import type IdentityServerDb from '../db'
import { type Config } from '../types'
import updateHashes from './changePepper'
import checkQuota from './check-quota'
import updateFederationHashes from './update-federation-hashes'
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
        this._addCheckUserQuotaJob(conf, db)
      ]

      if (conf.federation_server != null) {
        cronTasks.push(
          this._addUpdateFederationServerHashesJob(conf, db, userDB, logger)
        )
      }
      await Promise.all(cronTasks)
    } catch (error) {
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
      throw new Error(`Invalid cron line: ${cronString}`)
    }

    if (!cron.validate(pepperCron)) {
      throw new Error(`Invalid cron line: ${pepperCron}`)
    }

    const _addJob = (): void => {
      const updateHashesTask = cron.schedule(
        pepperCron,
        () => {
          updateHashes(conf, db, userDB, logger).catch((e) => {
            logger.error('Pepper update failed', e)
          })
        },
        this.options
      )

      const updateUsersTask = cron.schedule(
        cronString,
        () => {
          updateUsers(conf, db, userDB, logger).catch((e) => {
            logger.error('Users update failed', e)
          })
        },
        this.options
      )

      this.tasks.push(updateHashesTask)
      this.tasks.push(updateUsersTask)
    }

    try {
      if (!conf.cron_service) return

      const count = await db.getCount('hashes', 'hash')

      if (count > 0) {
        _addJob()
      } else {
        await updateHashes(conf, db, userDB, logger)
        _addJob()
      }
    } catch (error) {
      throw Error('Failed to add update hashes job')
    }
  }

  /**
   * Adds the check user quota job
   *
   * @param {Config} conf - the configuration
   * @param {IdentityServerDb} db - the identity server db instance
   */
  private readonly _addCheckUserQuotaJob = async (
    conf: Config,
    db: IdentityServerDb
  ): Promise<void> => {
    const cronString = conf.check_quota_cron ?? '0 0 0 * * *'

    if (!cron.validate(cronString)) {
      throw new Error(`Invalid cron line: ${cronString}`)
    }

    const task = cron.schedule(
      cronString,
      () => {
        checkQuota(conf, db).catch((e) => {
          db.logger.error('User quota check failed', e)
        })
      },
      this.options
    )

    this.tasks.push(task)
  }

  /**
   * Adds the federation server hashes job.
   *
   * @param {Config} conf - the config
   * @param {IdentityServerDb} db - the identity server db instance
   * @param {UserDB} userDB - the user db instance
   * @param {TwakeLogger} logger - the logger
   */
  private readonly _addUpdateFederationServerHashesJob = async (
    conf: Config,
    db: IdentityServerDb,
    userDB: UserDB,
    logger: TwakeLogger
  ): Promise<void> => {
    const cronString: string =
      conf.update_federation_hashes_cron ?? '3 3 3 * * *'

    if (!cron.validate(cronString)) {
      throw new Error(`Invalid cron line: ${cronString}`)
    }

    const task = cron.schedule(
      cronString,
      () => {
        updateFederationHashes(conf, userDB, logger).catch((e) => {
          db.logger.error('Federation hashes update failed', e)
        })
      },
      this.options
    )

    this.tasks.push(task)
  }
}

export default CronTasks
