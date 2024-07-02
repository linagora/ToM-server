import { errMsg } from '@twake/matrix-identity-server'
import MatrixClientServer from '..'
import {
  send,
  type expressAppHandler
} from '@twake/matrix-identity-server/dist/utils'
import { type ClientEvent } from '../types'

interface parameters {
  eventId: string
  roomId: string
}

const GetEventId = (ClientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const prms: parameters = (req as Request).params as parameters
    if (prms.eventId?.length != null && prms.roomId?.length != null) {
      ClientServer.authenticate(req, res, (data, id) => {
        // Check if the user has permission to retrieve this event
        const userId = data.sub as string
        ClientServer.matrixDb
          .get('local_current_membership', ['user_id'], {
            user_id: userId,
            room_id: prms.roomId
          })
          .then((rows) => {
            if (rows.length === 0 || rows[0].membership !== 'join') {
              send(
                res,
                404,
                errMsg(
                  'notFound',
                  'User not in the room - cannot retrieve event'
                )
              )
              return
            }
            ClientServer.matrixDb
              .get(
                'events',
                [
                  'content',
                  'event_id',
                  'origin_server_ts',
                  'room_id',
                  'sender',
                  'state_key',
                  'type'
                ],
                {
                  event_id: prms.eventId,
                  room_id: prms.roomId
                }
              )
              .then((rows) => {
                if (rows.length === 0) {
                  send(res, 404, errMsg('notFound', 'Event not found'))
                  return
                }
                const event = rows[0]
                const response = {
                  content: event.content,
                  event_id: event.event_id,
                  origin_server_ts: event.origin_server_ts,
                  room_id: event.room_id,
                  sender: event.sender,
                  type: event.type,
                  unsigned: {}
                } as ClientEvent

                if (event.state_key !== null) {
                  response.state_key = event.state_key as string
                }
                send(res, 200, response)
              })
              .catch((err) => {
                /* istanbul ignore next */
                ClientServer.logger.error(err)
                /* istanbul ignore next */
                send(res, 500, errMsg('unknown', err))
              })
          })
          .catch((err) => {
            /* istanbul ignore next */
            ClientServer.logger.error(err)
            /* istanbul ignore next */
            send(res, 500, errMsg('unknown', err))
          })
      })
    } else {
      send(res, 400, errMsg('missingParams'))
    }
  }
}

export default GetEventId
