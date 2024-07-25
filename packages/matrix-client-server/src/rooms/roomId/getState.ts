/**
 * Implements : https://spec.matrix.org/latest/client-server-api/#get_matrixclientv3roomsroomidstate
 *
 * Following the spec and Synapse implementation of the matrix Protocol, we have decided that when the requesting user
 * left the room, he will have access solely to the event of his departure.
 *
 * TODO : eventually add check for eventType to prevent invalid requests in the database
 */

import type MatrixClientServer from '../..'
import {
  epoch,
  errMsg,
  send,
  type expressAppHandler,
  roomIdRegex
} from '@twake/utils'
import { type Request } from 'express'

const RIdReg = new RegExp(roomIdRegex)

const getRoomState = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    const roomId: string = (req as Request).params.roomId
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
                  const unsigned = {
                    age: epoch() - (eventResult[0].origin_server_ts as number),
                    prev_content: eventResult[0].prev_content
                    // TODO : Add more unsigned data cf https://spec.matrix.org/latest/client-server-api/#get_matrixclientv3roomsroomidstate
                  }

                  send(res, 200, [
                    {
                      content: eventResult[0].content,
                      event_id: eventResult[0].event_id,
                      origin_server_ts: eventResult[0].origin_server_ts,
                      room_id: eventResult[0].room_id,
                      sender: eventResult[0].sender,
                      state_key: eventResult[0].state_key,
                      type: eventResult[0].type,
                      unsigned
                    }
                  ])
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
                  [
                    'events.content',
                    'events.event_id',
                    'events.origin_server_ts',
                    'events.room_id',
                    'events.type',
                    'events.sender',
                    'events.state_key'
                  ],
                  {},
                  {
                    'events.event_id': 'current_state_events.event_id',
                    'events.room_id': 'current_state_events.room_id',
                    'events.type': 'current_state_events.type',
                    'events.state_key': 'current_state_events.state_key'
                  }
                )
                .then((eventResult) => {
                  const state = []
                  for (const event of eventResult) {
                    const unsigned = {
                      age:
                        epoch() -
                        (eventResult[0].events_origin_server_ts as number),
                      prev_content: eventResult[0].events_prev_content
                      // TODO : Add more unsigned data cf https://spec.matrix.org/latest/client-server-api/#get_matrixclientv3roomsroomidstate
                    }
                    state.push({
                      content: event.events_content,
                      event_id: event.events_event_id,
                      origin_server_ts: event.events_origin_server_ts,
                      room_id: event.events_room_id,
                      sender: event.events_sender,
                      state_key: event.events_state_key,
                      type: event.events_type,
                      unsigned
                    })
                  }

                  send(res, 200, state, clientServer.logger)
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

export default getRoomState
