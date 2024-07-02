import { errMsg } from '@twake/matrix-identity-server'
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

const createContent = (rows: any) => {
  const content: { [key: string]: any } = {}
  for (const row of rows) {
    if (content[row.user_id] !== undefined) {
      content[row.user_id].push(row.membership)
    }
  }
  return content
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
        if (params.membership !== undefined) {
          if (params.not_membership !== undefined) {
            ClientServer.matrixDb
              .getOrNot(
                'local_current_membership',
                ['user_id', 'membership'],
                { membership: params.membership },
                { membership: params.not_membership }
              )
              .then((rows) => {
                // TODO
              })
              .catch((err) => {
                /* istanbul ignore next */
                ClientServer.logger.error(err)
                /* istanbul ignore next */
                send(res, 500, errMsg('unknown', err))
              })
          } else {
            ClientServer.matrixDb
              .get('local_current_membership', ['user_id', 'membership'], {
                room_id: roomId,
                membership: params.membership
              })
              .then((rows) => {
                if (rows.length === 0) {
                  send(res, 404, errMsg('notFound', 'Members not found'))
                  return
                }
                const content = createContent(rows)
                const event_id = 'TODO'
                const response: { [key: string]: [ClientEvent] } = {
                  chunk: [
                    {
                      content: content,
                      event_id: event_id,
                      origin_server_ts: epoch(),
                      room_id: roomId,
                      sender: 'TODO',
                      state_key: 'TODO',
                      type: 'TODO',
                      unsigned: {
                        // TODO
                      }
                    }
                  ]
                }
                send(res, 200, response)
              })
              .catch((err) => {
                /* istanbul ignore next */
                ClientServer.logger.error(err)
                /* istanbul ignore next */
                send(res, 500, errMsg('unknown', err))
              })
          }
        } else {
          if (params.not_membership !== undefined) {
            // call to select where ... not equal ...
            // send response
          } else {
            ClientServer.matrixDb
              .get('local_current_membership', ['user_id', 'membership'], {
                room_id: roomId
              })
              .then((rows) => {
                if (rows.length === 0) {
                  send(res, 404, errMsg('notFound', 'Members not found'))
                  return
                }
                const content = createContent(rows)
                const event_id = 'TODO'
                const response: { [key: string]: [ClientEvent] } = {
                  chunk: [
                    {
                      content: content,
                      event_id: event_id,
                      origin_server_ts: epoch(),
                      room_id: roomId,
                      sender: 'TODO',
                      state_key: 'TODO',
                      type: 'TODO',
                      unsigned: {
                        // TODO
                      }
                    }
                  ]
                }
                send(res, 200, response)
              })
              .catch((err) => {
                /* istanbul ignore next */
                ClientServer.logger.error(err)
                /* istanbul ignore next */
                send(res, 500, errMsg('unknown', err))
              })
          }
        }
      })
    } else {
      send(res, 400, errMsg('missingParams'))
    }
  }
}

export default GetMembers
