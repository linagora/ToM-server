/**
 * Scheduler
 */

import cron, { type ScheduledTask } from 'node-cron'
import type MatrixIdentityServer from '..'
import updateHashes from './changePepper'
import updateUsers from './updateUsers'

const cronOpts = {
  timezone: 'GMT'
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
class CronTasks {
  tasks: ScheduledTask[]
  ready: Promise<void>
  constructor(idServer: MatrixIdentityServer) {
    const conf = idServer.conf
    const db = idServer.db
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (!conf.pepperCron) conf.pepperCron = '0 0 * * *'
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (!conf.update_users_cron) conf.update_users_cron = '*/10 * * * *'
    /* istanbul ignore if */
    if (!cron.validate(conf.pepperCron))
      throw new Error(`Invalid cron line: ${conf.pepperCron}`)
    /* istanbul ignore if */
    if (!cron.validate(conf.update_users_cron))
      throw new Error(`Invalid cron line: ${conf.update_users_cron}`)
    this.tasks = []
    this.ready = new Promise((resolve, reject) => {
      /* istanbul ignore else */
      if (conf.cron_service) {
        db.getCount('hashes', 'hash')
          .then((count) => {
            const sub = (): void => {
              this.tasks.push(
                cron.schedule(
                  conf.pepperCron as string,
                  () => {
                    /* istanbul ignore next */
                    updateHashes(idServer)
                      /* istanbul ignore next */
                      .catch((e) => {
                        /* istanbul ignore next */
                        console.error('Pepper update failed', e)
                      })
                  },
                  cronOpts
                )
              )
              this.tasks.push(
                cron.schedule(
                  conf.update_users_cron as string,
                  () => {
                    updateUsers(idServer)
                      /* istanbul ignore next */
                      .catch((e) => {
                        /* istanbul ignore next */
                        console.error('updateUsers failed', e)
                      })
                  },
                  cronOpts
                )
              )
              resolve()
            }
            if (count !== 0) {
              /* istanbul ignore next */
              sub()
            } else {
              updateHashes(idServer)
                .then(() => {
                  sub()
                })
                /* istanbul ignore next */
                .catch(reject)
            }
          })
          /* istanbul ignore next */
          .catch(reject)
      } else {
        resolve()
      }
    })
  }

  stop(): void {
    this.tasks.forEach((task) => {
      task.stop()
    })
  }
}

export default CronTasks
