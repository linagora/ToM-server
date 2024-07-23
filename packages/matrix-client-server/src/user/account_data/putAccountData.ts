import type MatrixClientServer from '../..'
import {
  jsonContent,
  validateParameters,
  errMsg,
  type expressAppHandler,
  send,
  matrixIdRegex,
  eventTypeRegex
} from '@twake/utils'

interface Parameters {
  userId: string
  type: string
}

interface PutRequestBody {
  content: string
}

const schema = {
  content: true
}
const contentRegex = /^.{0,2048}$/ // Prevent the client from sending too long messages that could crash the DB. This value is arbitrary and could be changed

const putAccountData = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const parameters: Parameters = req.params as Parameters
    if (
      !matrixIdRegex.test(parameters.userId) ||
      !eventTypeRegex.test(parameters.type)
    ) {
      send(res, 400, errMsg('invalidParam'), clientServer.logger)
      return
    }
    clientServer.authenticate(req, res, (data, token) => {
      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(res, schema, obj, clientServer.logger, (obj) => {
          if (parameters.userId !== data.sub) {
            // The config is only visible to the user that set the account data
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
              'account_data',
              { content: (obj as PutRequestBody).content },
              [
                { field: 'user_id', value: parameters.userId },
                { field: 'account_data_type', value: parameters.type }
              ]
            )
            .then(() => {
              send(res, 200, {}, clientServer.logger)
            })
            .catch((e) => {
              /* istanbul ignore next */
              send(res, 500, errMsg('unknown', e), clientServer.logger)
            })
        })
      })
    })
  }
}

export default putAccountData
