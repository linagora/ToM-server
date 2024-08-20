import type MatrixClientServer from '../..'
import { errMsg, type expressAppHandler, send } from '@twake/utils'

interface query_parameters {
  dir: 'b' | 'f'
  ts: number
}

const GetTimestampToEvent = (
  ClientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const roomId: string = (req as Request).params.roomId
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const params: query_parameters = (req as Request).query
    if (params.dir !== 'b' && params.dir !== 'f') {
      send(
        res,
        400,
        errMsg('invalidParam', 'Invalid parameters'),
        ClientServer.logger
      )
      return
    }
    ClientServer.authenticate(req, res, (data, id) => {
      if (params.dir === 'b') {
        ClientServer.matrixDb
          .getMaxWhereEqualAndLower(
            'events',
            'origin_server_ts',
            ['event_id', 'origin_server_ts'],
            {
              room_id: roomId
            },
            {
              origin_server_ts: params.ts
            }
          )
          .then((rows) => {
            if (rows.length === 0) {
              send(
                res,
                404,
                errMsg(
                  'notFound',
                  `Unable to find event from ${params.ts} in backward direction`
                ),
                ClientServer.logger
              )
              return
            }
            send(res, 200, rows[0])
          })
          .catch((err) => {
            /* istanbul ignore next */
            send(
              res,
              500,
              errMsg('unknown', err.toString()),
              ClientServer.logger
            )
          })
      }
      if (params.dir === 'f') {
        ClientServer.matrixDb
          .getMinWhereEqualAndHigher(
            'events',
            'origin_server_ts',
            ['event_id', 'origin_server_ts'],
            {
              room_id: roomId
            },
            { origin_server_ts: params.ts }
          )
          .then((rows) => {
            if (rows.length === 0) {
              send(
                res,
                404,
                errMsg(
                  'notFound',
                  `Unable to find event from ${params.ts} in forward direction`
                ),
                ClientServer.logger
              )
              return
            }
            send(res, 200, rows[0])
          })
          .catch((err) => {
            /* istanbul ignore next */
            send(
              res,
              500,
              errMsg('unknown', err.toString()),
              ClientServer.logger
            )
          })
      }
    })
  }
}

export default GetTimestampToEvent
