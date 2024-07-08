import { errMsg } from '@twake/matrix-identity-server'
import MatrixClientServer from '..'
import {
  epoch,
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
              ClientServer.logger.error('Event not found')
              send(res, 404, errMsg('notFound', 'Cannot retrieve event'))
              return
            }
            // Check if the user has permission to retrieve this event
            const userId = data.sub as string
            ClientServer.matrixDb
              .getMaxWhereEqualAndLowerJoin(
                ['room_memberships', 'events'],
                'events.origin_server_ts',
                ['room_memberships.membership'],
                {
                  'room_memberships.user_id': userId,
                  'room_memberships.room_id': prms.roomId
                },
                {
                  'events.origin_server_ts': rows[0].origin_server_ts
                },
                {
                  'room_memberships.event_id': 'events.event_id'
                }
              )
              .then((rows2) => {
                if (rows2.length === 0 || rows2[0].membership !== 'join') {
                  ClientServer.logger.error(
                    'User not in the room at the time of the event'
                  )
                  send(res, 404, errMsg('notFound', 'Cannot retrieve event'))
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
                  unsigned: {
                    age: epoch() - (event.origin_server_ts as number)
                  }
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
