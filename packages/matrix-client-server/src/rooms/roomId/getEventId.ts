import type MatrixClientServer from '../..'
import { epoch, errMsg, send, type expressAppHandler } from '@twake/utils'
import { type ClientEvent } from '../../types'
import { type Request } from 'express'

const GetEventId = (ClientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    ClientServer.authenticate(req, res, (data, id) => {
      const eventId = (req as Request).params.eventId
      const roomId = (req as Request).params.roomId
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
            event_id: eventId,
            room_id: roomId
          }
        )
        .then((rows) => {
          if (rows.length === 0) {
            /* istanbul ignore next */
            ClientServer.logger.error('Event not found')
            send(res, 404, errMsg('notFound', 'Cannot retrieve event'))
            return
          }
          // Check if the user has permission to retrieve this event
          const userId = data.sub
          ClientServer.matrixDb
            .getMaxWhereEqualAndLowerJoin(
              ['room_memberships', 'events'],
              'events.origin_server_ts',
              ['room_memberships.membership'],
              {
                'room_memberships.user_id': userId,
                'room_memberships.room_id': roomId
              },
              {
                'events.origin_server_ts': rows[0].origin_server_ts
              },
              {
                'room_memberships.event_id': 'events.event_id'
              }
            )
            .then((rows2) => {
              if (
                rows2.length === 0 ||
                rows2[0].room_memberships_membership !== 'join'
              ) {
                /* istanbul ignore next */
                ClientServer.logger.error(
                  'User not in the room at the time of the event'
                )
                send(res, 404, errMsg('notFound', 'Cannot retrieve event'))
                return
              }
              const event = rows[0]
              const response: ClientEvent = {
                content: event.content as Record<string, any>,
                event_id: event.event_id as string,
                origin_server_ts: event.origin_server_ts as number,
                room_id: event.room_id as string,
                sender: event.sender as string,
                type: event.type as string,
                unsigned: {
                  age: epoch() - (event.origin_server_ts as number)
                }
              }
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
  }
}

export default GetEventId
