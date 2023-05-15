/**
 * Scheduler
 */

import cron, { type ScheduledTask } from 'node-cron'
import type MatrixIdentityServer from '..'
import updateHashes from './changePepper'

// eslint-disable-next-line @typescript-eslint/promise-function-async
class CronTasks {
  tasks: ScheduledTask[]
  ready: Promise<void>
  constructor(idServer: MatrixIdentityServer) {
    const conf = idServer.conf
    const db = idServer.db
    if (conf.pepperCron == null) conf.pepperCron = '0 0 0 * * *'
    /* istanbul ignore if */
    if (!cron.validate(conf.pepperCron))
      throw new Error(`Invalid cron line: ${conf.pepperCron}`)
    this.tasks = []
    this.ready = new Promise((resolve, reject) => {
      /* istanbul ignore else */
      if (conf.cron_service) {
        db.getCount('hashes', 'hash')
          .then((count) => {
            const sub = (): void => {
              const task = cron.schedule(
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
