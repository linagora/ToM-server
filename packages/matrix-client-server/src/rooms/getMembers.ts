import { errMsg, UserDB } from '@twake/matrix-identity-server'
import MatrixClientServer from '..'
import {
  epoch,
  send,
  type expressAppHandler
} from '@twake/matrix-identity-server/dist/utils'
import { type ClientEvent } from '../types'

// TODO : modify the code to do a call to ... where with the two tables

interface query_parameters {
  at?: string
  membership?: string
  not_membership?: string
}

const createChunk = (rows: any) => {
  const chunk: ClientEvent[] = []
  for (const row of rows) {
    chunk.push({
      content: row.events_content,
      event_id: row.events_event_id,
      origin_server_ts: row.events_origin_server_ts,
      room_id: row.events_room_id,
      sender: row.events_sender,
      type: row.events_type,
      unsigned: {
        age: epoch() - row.events_origin_server_ts,
        membership: row.local_current_membership_membership
      }
    } as ClientEvent)
  }
  return chunk
}

const GetMembers = (ClientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const roomId: string = (req as Request).params as string
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const params: query_parameters = (req as Request).query as query_parameters
    if (roomId.length != null) {
      ClientServer.authenticate(req, res, (data, id) => {
        let userId = data.sub as string
        // Check if the user is in the room
        ClientServer.matrixDb
          .get('local_current_membership', ['membership', 'event_id'], {
            room_id: roomId,
            user_id: userId
          })
          .then((rows) => {
            if (rows.length === 0) {
              send(
                res,
                403,
                errMsg(
                  'forbidden',
                  'User has never been in the room - cannot retrieve members'
                )
              )
              return
            }
            if (rows[0].membership === 'join') {
              if (params.at) {
                // Retrieve when the user joined the room
                ClientServer.matrixDb
                  .get('events', ['origin_server_ts'], {
                    event_id: rows[0].event_id
                  })
                  .then((rows) => {
                    if (rows.length === 0) {
                      ClientServer.logger.error(
                        'Event not found in events table despite being in local_current_membership'
                      )
                      send(res, 500, errMsg('unknown', 'Unexpected error'))
                      return
                    }
                    let joinTs = rows[0].origin_server_ts
                    // TODO CONTINUE THIS AFTER THE IMPLEMENTATION OF SYNC API AND MANAGEMENT OF PAGINATION TOKENS
                  })
                  .catch((err) => {
                    /* istanbul ignore next */
                    ClientServer.logger.error(err)
                    /* istanbul ignore next */
                    send(res, 500, errMsg('unknown', err))
                  })
              } else {
                ClientServer.matrixDb
                  .getWhereEqualOrDifferentJoin(
                    ['local_current_membership', 'events'],
                    [
                      'local_current_membership.membership',
                      'events.event_id',
                      'events.content',
                      'events.origin_server_ts',
                      'events.room_id',
                      'events.sender',
                      'events.type'
                    ],
                    {
                      'local_current_membership.membership': params.membership,
                      'local_current_membership.room_id': roomId
                    },
                    {
                      'local_current_membership.membership':
                        params.not_membership
                    },
                    { 'local_current_membership.event_id': 'events.event_id' }
                  )
                  .then((rows) => {
                    let chunk = createChunk(rows)
                    send(res, 200, { chunk: chunk })
                  })
                  .catch((err) => {
                    /* istanbul ignore next */
                    ClientServer.logger.error(err)
                    /* istanbul ignore next */
                    send(res, 500, errMsg('unknown', err))
                  })
              }
            }
            // TODO : add the case where the user is not in the room anymore
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

export default GetMembers
