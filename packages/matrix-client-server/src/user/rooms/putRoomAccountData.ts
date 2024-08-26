import type MatrixClientServer from '../..'
import {
  jsonContent,
  errMsg,
  type expressAppHandler,
  send,
  isMatrixIdValid,
  isEventTypeValid,
  isRoomIdValid
} from '@twake/utils'
import { StreamKeyType } from '../../utils/notifier'

interface Parameters {
  userId: string
  type: string
  roomId: string
}

const contentRegex = /^.{0,2048}$/ // Prevent the client from sending too long messages that could crash the DB. This value is arbitrary and could be changed

// TODO : Handle error 405 where the type of account data is controlled by the server and cannot be modified by the client

const putRoomAccountData = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const parameters: Parameters = req.params as Parameters
    if (
      !isMatrixIdValid(parameters.userId) ||
      !isEventTypeValid(parameters.type) ||
      !isRoomIdValid(parameters.roomId)
    ) {
      send(res, 400, errMsg('invalidParam'), clientServer.logger)
      return
    }
    if (
      parameters.type === 'm.push_rules' ||
      parameters.type === 'm.fully_read'
    ) {
      // Servers MUST reject setting account data for event types that the server manages.
      send(
        res,
        405,
        errMsg('badJson', `Cannot set ${parameters.type} through this API.`),
        clientServer.logger
      )
      return
    }
    clientServer.authenticate(req, res, (data, token) => {
      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(res, schema, obj, clientServer.logger, (obj) => {
          if (parameters.userId !== data.sub) {
            send(
              res,
              403,
              {
                errcode: 'M_FORBIDDEN',
                error:
                  'The access token provided is not authorized to update this user’s account data.'
              },
              clientServer.logger
            )
            return
          }
          if (!contentRegex.test((obj as PutRequestBody).content)) {
            send(res, 400, errMsg('invalidParam', 'Content is too long'))
            return
          }
          if (!contentRegex.test((obj as PutRequestBody).content)) {
            send(res, 400, errMsg('invalidParam', 'Content is too long'))
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
              send(res, 200, {}, clientServer.logger)
            })
            .catch((e) => {
              /* istanbul ignore next */
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

export default putRoomAccountData
