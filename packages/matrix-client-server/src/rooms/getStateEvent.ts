import MatrixClientServer from '../..'
import { errMsg, send, type expressAppHandler, epoch } from '@twake/utils'
import { Request } from 'express'
import { type ClientEvent } from '../../types'

interface parameters {
  eventType: string
  roomId: string
  stateKey: string
}

const GetStateEvent = (ClientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const prms: parameters = (req as Request).params as parameters
    ClientServer.authenticate(req, res, (data, id) => {
      const userId = data.sub as string
      ClientServer.matrixDb
        .getJoin(
          ['room_memberships', 'events'],
          ['events.origin_server_ts'],
          {
            'room_memberships.user_id': userId,
            'room_memberships.room_id': prms.roomId,
            'room_memberships.membership': 'join'
          },
          {
            'room_memberships.event_id': 'events.event_id'
          }
        )
        .then((rows) => {
          if (rows.length === 0) {
            send(
              res,
              404,
              errMsg(
                'notFound',
                'User was never in the room - cannot retrieve content'
              )
            )
            return
          }
          ClientServer.matrixDb
            .getWhereEqualAndHigher(
              'state_events',
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
                room_id: prms.roomId,
                type: prms.eventType,
                state_key: prms.stateKey
              }
            )
            .then((rows) => {
              if (rows.length === 0) {
                send(res, 404, errMsg('notFound', 'No state event found'))
                return
              }
              const response: ClientEvent[] = []
              for (const row of rows) {
                response.push({
                  content: row.content as string,
                  event_id: row.event_id as string,
                  origin_server_ts: row.origin_server_ts as number,
                  room_id: row.room_id as string,
                  sender: row.sender as string,
                  state_key: row.state_key as string,
                  type: row.type as string,
                  unsigned: {
                    age: epoch() - row.origin_server_ts
                  }
                })
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

export default GetState
