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
        if (!contentRegex.test(JSON.stringify(obj))) {
          send(res, 400, errMsg('invalidParam', 'Content is too long'))
          return
        }
        clientServer.matrixDb
          .upsert(
            'room_account_data',
            {
              content: JSON.stringify(obj),
              user_id: parameters.userId,
              account_data_type: parameters.type,
              room_id: parameters.roomId,
              stream_id: 0
            },
            ['user_id', 'account_data_type', 'room_id']
          )
          .then(() => {
            send(res, 200, {}, clientServer.logger)
          })
          .catch((e) => {
            /* istanbul ignore next */
            send(res, 500, errMsg('unknown', e.toString()), clientServer.logger)
          })
      })
    })
  }
}

export default putRoomAccountData
