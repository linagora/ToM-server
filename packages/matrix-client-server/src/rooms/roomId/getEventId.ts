import type MatrixClientServer from '../..'
import { epoch, errMsg, send, type expressAppHandler } from '@twake/utils'
import { type ClientEvent } from '../../types'

interface parameters {
  eventId: string
  roomId: string
}

const GetEventId = (ClientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const prms: parameters = (req as Request).params as parameters
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
            send(
              res,
              404,
              errMsg('notFound', 'Cannot retrieve event : event not found'),
              ClientServer.logger
            )
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
              if (
                rows2.length === 0 ||
                rows2[0].room_memberships_membership !== 'join'
              ) {
                send(
                  res,
                  404,
                  errMsg(
                    'notFound',
                    'Cannot retrieve event : User not in the room at the time of the event'
                  ),
                  ClientServer.logger
                )
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
              send(res, 500, errMsg('unknown', err))
            })
        })
        .catch((err) => {
          /* istanbul ignore next */
          send(res, 500, errMsg('unknown', err))
        })
    })
  }
}

export default GetEventId
