import type MatrixClientServer from '../..'
import {
  jsonContent,
  validateParameters,
  errMsg,
  type expressAppHandler,
  send
} from '@twake/utils'

interface Parameters {
  userId: string
  type: string
  roomId: string
}

interface PutRequestBody {
  content: string
}

const schema = {
  content: true
}

const matrixIdRegex = /^@[0-9a-zA-Z._=-]+:[0-9a-zA-Z.-]+$/
const eventTypeRegex = /^(?:[a-z]+(?:\.[a-z][a-z0-9]*)*)$/ // Following Java's package naming convention as per : https://spec.matrix.org/v1.11/#events
const roomIdRegex = /^![0-9a-zA-Z._=/+-]+:[0-9a-zA-Z.-]+$/ // From : https://spec.matrix.org/v1.11/#room-structure
// TODO : Handle error 405 where the type of account data is controlled by the server and cannot be modified by the client

const putRoomAccountData = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const parameters: Parameters = req.params as Parameters
    if (
      !matrixIdRegex.test(parameters.userId) ||
      !eventTypeRegex.test(parameters.type) ||
      !roomIdRegex.test(parameters.roomId)
    ) {
      send(res, 400, errMsg('invalidParam'))
      return
    }
    clientServer.authenticate(req, res, (data, token) => {
      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(res, schema, obj, clientServer.logger, (obj) => {
          if (parameters.userId !== data.sub) {
            send(res, 403, {
              errcode: 'M_FORBIDDEN',
              error:
                'The access token provided is not authorized to update this user’s account data.'
            })
            return
          }
          clientServer.matrixDb
            .updateWithConditions(
              'room_account_data',
              { content: (obj as PutRequestBody).content },
              [
                { field: 'user_id', value: parameters.userId },
                { field: 'account_data_type', value: parameters.type },
                { field: 'room_id', value: parameters.roomId }
              ]
            )
            .then(() => {
              send(res, 200, {})
            })
            .catch((e) => {
              // istanbul ignore next
              clientServer.logger.error("Error updating user's account data", e)
              // istanbul ignore next
              send(res, 500, errMsg('unknown'))
            })
        })
      })
    })
  }
}

export default putRoomAccountData
