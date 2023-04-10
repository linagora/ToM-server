/**
 * Scheduler
 */

import cron, { type ScheduledTask } from 'node-cron'
import { type Config } from '..'
import type IdentityServerDb from '../db'
import type UserDB from '../userdb'
import updateHashes from './updateHashes'

// eslint-disable-next-line @typescript-eslint/promise-function-async
class CronTasks {
  tasks: ScheduledTask[]
  constructor (conf: Config, db: IdentityServerDb, userdb: UserDB) {
    if (conf.pepperCron == null) conf.pepperCron = '0 0 0 * * *'
    if (!cron.validate(conf.pepperCron)) throw new Error(`Invalid cron line: ${conf.pepperCron}`)
    this.tasks = []
    updateHashes(conf, db, userdb).then(() => {
      const task = cron.schedule(conf.pepperCron as string, () => {
        updateHashes(conf, db, userdb).catch(e => {
          console.error('Pepper update failed', e)
        })
      }, {
        timezone: 'GMT'
      })
      this.tasks.push(task)
    }).catch(e => {
      throw new Error(e)
    })
  }

  stop (): void {
    this.tasks.forEach(task => {
      task.stop()
    })
  }
}

export default CronTasks
