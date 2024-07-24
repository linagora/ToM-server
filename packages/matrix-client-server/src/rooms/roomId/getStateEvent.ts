import type MatrixClientServer from '../..'
import {
  epoch,
  errMsg,
  send,
  type expressAppHandler,
  roomIdRegex
} from '@twake/utils'
import { type Request } from 'express'

// TODO : Manage the case where it is an Application Service, in which case any of the AS’s users must be in the room for it to work.
// cf https://spec.matrix.org/v1.11/client-server-api/#get_matrixclientv3roomsroomidjoined_members

const RIdReg = new RegExp(roomIdRegex)

const getRoomStateEvent = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    const roomId: string = (req as Request).params.roomId
    const eventType = (req as Request).params.eventType
    const stateKey = (req as Request).params.stateKey
    // TODO : add check for eventType
    if (!RIdReg.test(roomId)) {
      send(
        res,
        400,
        errMsg('invalidParam', 'Invalid roomId'),
        clientServer.logger
      )
      return
    }

    clientServer.authenticate(req, res, (token) => {
      const requesterUid = token.sub

      // Check if requester is currently in the room or was in it before
      clientServer.matrixDb
        .get('local_current_membership', ['membership', 'event_id'], {
          user_id: requesterUid,
          room_id: roomId
        })
        .then((rows) => {
          if (
            rows.length === 0 ||
            (rows[0].membership !== 'join' && rows[0].membership !== 'leave')
          ) {
            send(
              res,
              403,
              errMsg('forbidden', 'User is not and was never part of the room'),
              clientServer.logger
            )
          } else {
            if (rows[0].membership !== 'join') {
              // The requester was once part of the room and left it
              // We then arbitrarily decided to allow him to get the event of his departure
              clientServer.matrixDb
                .get(
                  'events',
                  [
                    'content',
                    'event_id',
                    'origin_server_ts',
                    'room_id',
                    'type',
                    'sender',
                    'state_key'
                  ],
                  { event_id: rows[0].event_id }
                )
                .then((eventResult) => {
                  /* istanbul ignore if */
                  if (eventResult.length === 0) {
                    send(
                      res,
                      404,
                      errMsg('unknown', 'Event not found'),
                      clientServer.logger
                    )
                    return
                  }
                  send(
                    res,
                    200,
                    JSON.stringify(eventResult[0].content),
                    clientServer.logger
                  )
                })
                .catch((err) => {
                  /* istanbul ignore next */
                  send(res, 500, errMsg('unknown', err), clientServer.logger)
                })
            } else {
              // The requester is currently in the room
              clientServer.matrixDb
                .getJoin(
                  ['events', 'current_state_events'],
                  ['events.content'],
                  {
                    'events.room_id': roomId,
                    'events.type': eventType,
                    'events.state_key': stateKey
                  },
                  {
                    'events.event_id': 'current_state_events.event_id',
                    'events.room_id': 'current_state_events.room_id',
                    'events.type': 'current_state_events.type',
                    'events.state_key': 'current_state_events.state_key'
                  }
                )
                .then((eventResult) => {
                  if (eventResult.length === 0) {
                    send(
                      res,
                      404,
                      errMsg(
                        'unknown',
                        'The room has no state with the given type or key.'
                      ),
                      clientServer.logger
                    )
                    return
                  }

                  send(
                    res,
                    200,
                    JSON.stringify(eventResult[0].events_content),
                    clientServer.logger
                  )
                })
                .catch((err) => {
                  /* istanbul ignore next */
                  send(res, 500, errMsg('unknown', err), clientServer.logger)
                })
            }
          }
        })
        .catch((err) => {
          /* istanbul ignore next */
          send(res, 500, errMsg('unknown', err), clientServer.logger)
        })
    })
  }
}

export const getRoomStateEventNoStatekey = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    const roomId: string = (req as Request).params.roomId
    const eventType = (req as Request).params.eventType

    // TO DO : appel a api au dessus avec state key vide
  }
}

export default getRoomState
