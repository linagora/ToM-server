import { type TwakeLogger } from '@twake/logger'
import type MatrixApplicationServer from '@twake/matrix-application-server'
import { type MatrixDB } from '@twake/matrix-identity-server'
import { type Config } from '../types'
import { OnRoomMembershipEvent } from './callback/on-room-membership-event'
import { MatrixDBRepository } from './repositories/matrix-db.repository'

export type CallbackHooks = OnRoomMembershipEvent

export class TwakeServerHooks {
  callbackHooks: CallbackHooks[]
  ready: Promise<void>
  constructor(
    applicationServer: MatrixApplicationServer,
    matrixDb: MatrixDB,
    conf: Config,
    logger: TwakeLogger
  ) {
    this.callbackHooks = []
    const matrixDbRepository = new MatrixDBRepository(
      matrixDb,
      conf.server_name
    )
    this.ready = new Promise<void>((resolve, reject) => {
      matrixDbRepository
        .addMatrixUserAdmin(
          `@${applicationServer.appServiceRegistration.senderLocalpart}:${conf.server_name}`
        )
        .then(() => {
          this.callbackHooks.push(
            new OnRoomMembershipEvent(
              applicationServer,
              matrixDbRepository,
              conf,
              logger
            )
          )
          resolve()
        })
        .catch((e) => {
          reject(e)
        })
    })
  }
}
