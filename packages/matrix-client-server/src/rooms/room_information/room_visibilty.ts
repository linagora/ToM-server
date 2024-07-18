import type MatrixClientServer from '../../'
import {
  errMsg,
  send,
  type expressAppHandler,
  jsonContent,
  validateParameters
} from '@twake/utils'
import { type Request } from 'express'

export const getRoomVisibility = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    const roomId = (req as Request).params.roomId

    clientServer.matrixDb
      .get('rooms', ['room_id', 'is_public'], {
        room_id: roomId
      })
      .then((roomsResult) => {
        if (roomsResult.length === 0) {
          send(res, 404, errMsg('notFound', 'Room not found'))
        } else {
          const roomInfo = roomsResult[0]

          const _visibility =
            roomInfo.is_public !== null && roomInfo.is_public === 1
              ? 'public'
              : 'private'
          send(res, 200, {
            visibility: _visibility
          })
        }
      })
      .catch((e) => {
        /* istanbul ignore next */
        clientServer.logger.error('Error querying room directory info:', e)
        /* istanbul ignore next */
        send(res, 500, errMsg('unknown', 'Error querying room directory info'))
      })
  }
}

const schema = {
  visibility: true
}

export const setRoomVisibility = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    const roomId = (req as Request).params.roomId

    // TO DO : eventually implement additional access control checks here
    clientServer.authenticate(req, res, (data, id) => {
      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(res, schema, obj, clientServer.logger, (obj) => {
          const order = obj as { visibility: string }
          if (order.visibility !== 'public' && order.visibility !== 'private') {
            send(res, 400, errMsg('invalidParam', 'Invalid parameters'))
          } else {
            const isPublic = order.visibility === 'public' ? 1 : 0

            clientServer.matrixDb
              .updateWithConditions('rooms', { is_public: isPublic }, [
                { field: 'room_id', value: roomId }
              ])
              .then((rows) => {
                if (rows.length === 0) {
                  send(res, 404, errMsg('notFound', 'Room not found'))
                } else {
                  send(res, 200, {})
                }
              })
              .catch((e) => {
                /* istanbul ignore next */
                clientServer.logger.error('Error updating room visibility:', e)
                /* istanbul ignore next */
                send(
                  res,
                  500,
                  errMsg('unknown', 'Error updating room visibility')
                )
              })
          }
        })
      })
    })
  }
}
