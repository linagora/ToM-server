import type MatrixClientServer from '..'
import {
  jsonContent,
  validateParameters,
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

// If status message is longer than 2048 characters, we refuse it to prevent clients from sending too long messages that could crash the DB. This value is arbitrary and could be changed
// NB : Maybe the function should update the presence_stream table of the matrixDB,
// TODO : reread the code after implementing streams-related endpoints
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
          validateParameters(res, schema, obj, clientServer.logger, (obj) => {
            if (data.sub !== userId) {
              clientServer.logger.warn(
                'You cannot set the presence state of another user'
              )
              send(res, 403, errMsg('forbidden'), clientServer.logger)
              return
            }
            if (
              (obj as PutRequestBody).presence !== 'offline' &&
              (obj as PutRequestBody).presence !== 'online' &&
              (obj as PutRequestBody).presence !== 'unavailable'
            ) {
              send(res, 400, errMsg('invalidParam', 'Invalid presence state'))
              return
            }
            if (!statusMsgRegex.test((obj as PutRequestBody).status_msg)) {
              send(
                res,
                400,
                errMsg('invalidParam', 'Status message is too long')
              )
              return
            }
            clientServer.matrixDb
              .updateWithConditions(
                // TODO : Replace with upsert
                'presence',
                {
                  state: (obj as PutRequestBody).presence,
                  status_msg: (obj as PutRequestBody).status_msg
                },
                [{ field: 'user_id', value: userId }]
              )
              .then(() => {
                send(res, 200, {}, clientServer.logger)
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
        })
      })
    }
  }
}
export default putStatus
