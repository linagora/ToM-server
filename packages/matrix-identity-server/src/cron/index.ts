/**
 * Scheduler
 */

import cron, { type ScheduledTask } from 'node-cron'
import type MatrixIdentityServer from '..'
import type IdentityServerDb from '../db'
import { type Config } from '../types'
import updateHashes from './changePepper'
import checkQuota from './check-quota'
import updateUsers from './updateUsers'

class CronTasks {
  tasks: ScheduledTask[]
  ready: Promise<void>
  readonly options: Record<string, string | number> = { timezone: 'GMT' }

  constructor(idServer: MatrixIdentityServer) {
    const conf = idServer.conf

    this.tasks = []
    this.ready = this.init(conf, idServer)
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
   * @param {MatrixIdentityServer} idServer - the identity server db
   */
  private readonly init = async (
    conf: Config,
    idServer: MatrixIdentityServer
  ): Promise<void> => {
    try {
      if (!conf.cron_service) return

      await Promise.all([
        this._addUpdateHashesJob(conf, idServer),
        this._addCheckUserQuotaJob(conf, idServer.db)
      ])
    } catch (error) {
      throw Error('Failed to initialize cron tasks')
    }
  }

  /**
   * Update the hashes job.
   *
   * @param {Config} conf - the configuration
   * @param {MatrixIdentityServer} idServer - the matrix identity server instance.
   */
  private readonly _addUpdateHashesJob = async (
    conf: Config,
    idServer: MatrixIdentityServer
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
          updateHashes(idServer).catch((e) => {
            idServer.logger.error('Pepper update failed', e)
          })
        },
        this.options
      )

      const updateUsersTask = cron.schedule(
        cronString,
        () => {
          updateUsers(idServer).catch((e) => {
            idServer.logger.error('Users update failed', e)
          })
        },
        this.options
      )

      this.tasks.push(updateHashesTask)
      this.tasks.push(updateUsersTask)
    }

    try {
      if (!conf.cron_service) return

      const count = await idServer.db.getCount('hashes', 'hash')

      if (count > 0) {
        _addJob()
      } else {
        await updateHashes(idServer)
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
}

export default CronTasks
