import type MatrixClientServer from '..'
import {
  jsonContent,
  validateParametersAndValues,
  errMsg,
  type expressAppHandler,
  send,
  isMatrixIdValid
} from '@twake/utils'

interface PutRequestBody {
  presence: string
  status_msg: string
}

const schema = {
  presence: true,
  status_msg: false
}

const statusMsgRegex = /^.{0,2048}$/

const valueChecks = {
  presence: (value: string) =>
    value === 'offline' || value === 'online' || value === 'unavailable',
  // If status message is longer than 2048 characters, we refuse it to prevent clients from sending too long messages that could crash the DB. This value is arbitrary and could be changed
  status_msg: (value: string) => statusMsgRegex.test(value)
}

const putStatus = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const userId: string = req.params.userId as string
    if (!isMatrixIdValid(userId)) {
      send(
        res,
        400,
        errMsg('invalidParam', 'Invalid user ID'),
        clientServer.logger
      )
    } else {
      clientServer.authenticate(req, res, (data, id) => {
        jsonContent(req, res, clientServer.logger, (obj) => {
          validateParametersAndValues(
            res,
            schema,
            valueChecks,
            obj,
            clientServer.logger,
            (obj) => {
              if (data.sub !== userId) {
                clientServer.logger.warn(
                  'You cannot set the presence state of another user'
                )
                send(res, 403, errMsg('forbidden'), clientServer.logger)
                return
              }
              clientServer.presenceStreamIdManager
                .getNextId()
                .then((newStreamId) => {
                  // There is no primary key in the presence_stream table so we cannot use the upsert method
                  clientServer.matrixDb
                    .updateWithConditions(
                      'presence_stream',
                      {
                        stream_id: newStreamId,
                        state: (obj as PutRequestBody).presence,
                        status_msg: (obj as PutRequestBody).status_msg,
                        last_active_ts: Date.now()
                      },
                      [{ field: 'user_id', value: userId }]
                    )
                    .then((rows) => {
                      if (rows.length === 0) {
                        // If no row was updated, we insert a new one
                        clientServer.matrixDb
                          .insert('presence_stream', {
                            user_id: userId,
                            state: (obj as PutRequestBody).presence,
                            status_msg: (obj as PutRequestBody).status_msg,
                            stream_id: newStreamId,
                            last_active_ts: Date.now()
                          })
                          .then(() => {
                            send(res, 200, {}, clientServer.logger)
                          })
                          .catch((e) => {
                            // istanbul ignore next
                            clientServer.logger.error(
                              "Error inserting user's presence state"
                            )
                            // istanbul ignore next
                            send(
                              res,
                              500,
                              errMsg('unknown', e.toString()),
                              clientServer.logger
                            )
                          })
                      } else {
                        send(res, 200, {}, clientServer.logger)
                      }
                    })
                    .catch((e) => {
                      // istanbul ignore next
                      clientServer.logger.error(
                        "Error updating user's presence state"
                      )
                      // istanbul ignore next
                      send(
                        res,
                        500,
                        errMsg('unknown', e.toString()),
                        clientServer.logger
                      )
                    })
                })
                .catch((e) => {
                  // istanbul ignore next
                  clientServer.logger.error(
                    `Failed to get next stream ID for presence state for user ${userId}: ${String(
                      e
                    )}`
                  )
                  // istanbul ignore next
                  send(
                    res,
                    500,
                    errMsg('unknown', e.toString()),
                    clientServer.logger
                  )
                })
            }
          )
        })
      })
    }
  }
}
export default putStatus
