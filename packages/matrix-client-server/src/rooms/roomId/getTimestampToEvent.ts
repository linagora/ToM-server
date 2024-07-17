import type MatrixClientServer from '../..'
import { errMsg, type expressAppHandler, send } from '@twake/utils'
import { type Request } from 'express'

const GetTimestampToEvent = (
  ClientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    const roomId: string = (req as Request).params.roomId
    const dir: string = (req as Request).query.dir as string
    const ts: number = Number((req as Request).query.ts as string)
    if ((dir !== 'b' && dir !== 'f') || isNaN(ts)) {
      send(res, 400, errMsg('invalidParam', 'Invalid parameters'))
      return
    }
    ClientServer.authenticate(req, res, (data, id) => {
      if (dir === 'b') {
        ClientServer.matrixDb
          .getMaxWhereEqualAndLower(
            'events',
            'origin_server_ts',
            ['event_id', 'origin_server_ts'],
            {
              room_id: roomId
            },
            {
              origin_server_ts: ts
            }
          )
          .then((rows) => {
            if (rows.length === 0) {
              send(
                res,
                404,
                errMsg(
                  'notFound',
                  `Unable to find event from ${ts} in backward direction`
                )
              )
              return
            }
            send(res, 200, rows[0])
          })
          .catch((err) => {
            /* istanbul ignore next */
            ClientServer.logger.error(err)
            /* istanbul ignore next */
            send(res, 500, errMsg('unknown', err))
          })
      }
      if (dir === 'f') {
        ClientServer.matrixDb
          .getMinWhereEqualAndHigher(
            'events',
            'origin_server_ts',
            ['event_id', 'origin_server_ts'],
            {
              room_id: roomId
            },
            { origin_server_ts: ts }
          )
          .then((rows) => {
            if (rows.length === 0) {
              send(
                res,
                404,
                errMsg(
                  'notFound',
                  `Unable to find event from ${ts} in forward direction`
                )
              )
              return
            }
            send(res, 200, rows[0])
          })
          .catch((err) => {
            /* istanbul ignore next */
            ClientServer.logger.error(err)
            /* istanbul ignore next */
            send(res, 500, errMsg('unknown', err))
          })
      }
    })
  }
}

export default GetTimestampToEvent
