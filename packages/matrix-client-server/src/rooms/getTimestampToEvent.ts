import MatrixClientServer from '../..'
import { errMsg, expressAppHandler, send } from '@twake/utils'

interface parameters {
  roomId: string
}

interface query_parameters {
  dir: string
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
    // TODO : introduce rate-limiting
    ClientServer.authenticate(req, res, (data, id) => {
      if (params.dir === 'b') {
        ClientServer.matrixDb
          .getMaxWhereEqualAndLower(
            'events',
            'origin_server_ts',
            ['event_id', 'origin_server_ts'],
            {
              room_id: roomId,
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
                )
              )
              return
            }
            send(res, 200, rows[0])
          })
      }
      if (params.dir === 'f') {
        ClientServer.matrixDb
          .getMinWhereEqualAndHigher(
            'events',
            'origin_server_ts',
            ['event_id', 'origin_server_ts'],
            {
              room_id: roomId,
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
                  `Unable to find event from ${params.ts} in forward direction`
                )
              )
              return
            }
            send(res, 200, rows[0])
          })
      }
    })
  }
}
