import type MatrixClientServer from '../..'
import { epoch, errMsg, send, type expressAppHandler } from '@twake/utils'
import { type ClientEvent } from '../../types'
import { isRoomIdValid } from '@twake/utils'

interface parameters {
  eventId: string
  roomId: string
}

const GetEventId = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const prms: parameters = (req as Request).params as parameters
    if (!isRoomIdValid(prms.roomId)) {
      send(
        res,
        400,
        errMsg('invalidParam', 'Invalid roomId'),
        clientServer.logger
      )
      return
    }

    clientServer.authenticate(req, res, (data) => {
      const requesterUid = data.sub

      // TODO : eventually add redirection with federation here
      /* istanbul ignore if */
      if (!clientServer.isMine(requesterUid)) {
        send(res, 403, errMsg('forbidden', 'User is not hosted on this server'))
        return
      }

      // Check for authorization
      clientServer.matrixDb
        .get('local_current_membership', ['membership'], {
          user_id: requesterUid,
          room_id: prms.roomId
        })
        .then((roomsResult) => {
          if (
            roomsResult.length === 0 ||
            roomsResult[0].membership !== 'join'
          ) {
            send(
              res,
              404,
              errMsg('forbidden', 'User is not in the room'),
              clientServer.logger
            )
          } else {
            clientServer.matrixDb
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
                    errMsg(
                      'notFound',
                      'Cannot retrieve event : event not found'
                    ),
                    clientServer.logger
                  )
                  return
                }
                // TODO : eventually serialize the event before sending it to client as done in Synapse implementation
                // This is used for bundling extra information.
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
                send(
                  res,
                  500,
                  errMsg('unknown', err.toString()),
                  clientServer.logger
                )
              })
          }
        })
        .catch((e) => {
          /* istanbul ignore next */
          send(res, 500, errMsg('unknown', e.toString()), clientServer.logger)
        })
    })
  }
}

export default GetEventId
