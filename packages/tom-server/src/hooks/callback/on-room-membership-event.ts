import { type TwakeLogger } from '@twake/logger'
import type MatrixApplicationServer from '@twake/matrix-application-server'
import { type ClientEvent } from '@twake/matrix-application-server'
import fetch from 'node-fetch'
import { type Config } from '../../types'
import { type IMatrixDBRepository } from '../repositories/interfaces/matrix-db-repository.interface'

export class OnRoomMembershipEvent {
  constructor(
    private readonly _applicationServer: MatrixApplicationServer,
    matrixDb: IMatrixDBRepository,
    conf: Config,
    logger: TwakeLogger
  ) {
    this._applicationServer.on(
      'state event | type: m.room.member',
      (event: ClientEvent) => {
        if (event.content.membership === 'leave') {
          let statusCode: number
          const deleteRequestUrl = `https://${conf.matrix_server}/_synapse/admin/v1/rooms/${event.room_id}`
          matrixDb
            .hasRoomLocalServerUsers(event.room_id)
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            .then((hasLocalServerUsers) => {
              if (!hasLocalServerUsers) {
                return fetch(encodeURI(deleteRequestUrl), {
                  method: 'DELETE',
                  headers: {
                    Authorization: `Bearer ${this._applicationServer.appServiceRegistration.asToken}`
                  },
                  body: JSON.stringify({})
                })
              }
            })
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            .then((response) => {
              if (response != null) {
                statusCode = response.status
                return response.json()
              }
            })
            .then((body) => {
              if (body != null) {
                logger.info(JSON.stringify(body), {
                  matrixUserId: `@${this._applicationServer.appServiceRegistration.senderLocalpart}:${conf.server_name}`,
                  httpMethod: 'DELETE',
                  requestUrl: deleteRequestUrl,
                  status: statusCode
                })
              }
            })
            .catch((e) => {
              logger.error(e)
            })
        }
      }
    )
  }
}
