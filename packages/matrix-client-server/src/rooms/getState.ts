import { errMsg } from '@twake/matrix-identity-server'
import MatrixClientServer from '..'
import {
  send,
  type expressAppHandler,
  epoch
} from '@twake/matrix-identity-server/dist/utils'
import { Request } from 'express'
import { type ClientEvent } from '../types'

const GetState = (ClientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const roomId: string = (req as Request).params as string
    if (roomId.length != null) {
      ClientServer.authenticate(req, res, (data, id) => {
        const userId = data.sub as string
        const sentAt = data.epoch as number
        ClientServer.matrixDb
          .get('local_current_membership', ['user_id'], {
            user_id: userId,
            room_id: roomId
          })
          .then((rows) => {
            if (rows.length === 0 || rows[0].membership !== 'join') {
              send(
                res,
                404,
                errMsg(
                  'notFound',
                  'User not in the room - cannot retrieve state'
                )
              )
              return
            }
            ClientServer.matrixDb
              .get('current_state_events', ['event_id'], { room_id: roomId })
              .then((rows) => {
                if (rows.length === 0) {
                  send(
                    res,
                    404,
                    errMsg('notFound', 'No current state events found')
                  )
                  return
                }
                let response: ClientEvent[] = []
                const promises = rows.map((event) => {
                  return ClientServer.matrixDb
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
                      { event_id: event.event_id, room_id: roomId }
                    )
                    .then((rows) => {
                      if (rows.length === 0) {
                        send(res, 404, errMsg('notFound', 'Event not found'))
                        return
                      }
                      const event = rows[0]
                      response.push({
                        content: event.content,
                        event_id: event.event_id,
                        origin_server_ts: event.origin_server_ts,
                        room_id: event.room_id,
                        sender: event.sender,
                        state_key: event.state_key,
                        type: event.type,
                        unsigned: {
                          age: epoch() - sentAt,
                          membership: 'join'
                        }
                      } as ClientEvent)
                    })
                    .catch((err) => {
                      /* istanbul ignore next */
                      ClientServer.logger.error(err)
                      /* istanbul ignore next */
                      send(res, 500, errMsg('unknown', err))
                    })
                })
                return Promise.all(promises).then(() => response)
              })
              .then((response) => {
                // TODO : check if this is legit
                // @ts-expect-error
                send(res, 200, response)
              })
              .catch((err) => {
                /* istanbul ignore next */
                ClientServer.logger.error(err)
                /* istanbul ignore next */
                send(res, 500, errMsg('unknown', err))
              })
          })
      })
    } else {
      send(res, 400, errMsg('missingParams'))
    }
  }
}

export default GetState
