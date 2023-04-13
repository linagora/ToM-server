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
  ready: Promise<void>
  constructor(conf: Config, db: IdentityServerDb, userdb: UserDB) {
    if (conf.pepperCron == null) conf.pepperCron = '0 0 0 * * *'
    if (!cron.validate(conf.pepperCron))
      throw new Error(`Invalid cron line: ${conf.pepperCron}`)
    this.tasks = []
    this.ready = new Promise((resolve, reject) => {
      db.getCount('hashes', 'hash')
        .then((count) => {
          const sub = (): void => {
            const task = cron.schedule(
              conf.pepperCron as string,
              () => {
                /* istanbul ignore next */
                updateHashes(conf, db, userdb)
                  /* istanbul ignore next */
                  .catch((e) => {
                    /* istanbul ignore next */
                    console.error('Pepper update failed', e)
                  })
              },
              {
                timezone: 'GMT'
              }
            )
            this.tasks.push(task)
            resolve()
          }
          if (count !== 0) {
            /* istanbul ignore next */
            sub()
          } else {
            updateHashes(conf, db, userdb)
              .then(() => {
                sub()
              })
              .catch((e) => {
                /* istanbul ignore next */
                reject(e)
              })
          }
        })
        .catch((e) => {
          /* istanbul ignore next */
          reject(e)
        })
    })
  }

  stop(): void {
    this.tasks.forEach((task) => {
      task.stop()
    })
  }
}

export default CronTasks
