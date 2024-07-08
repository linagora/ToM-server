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
}

interface PutRequestBody {
  content: string
}

const schema = {
  content: true
}

const matrixIdRegex = /^@[0-9a-zA-Z._=-]+:[0-9a-zA-Z.-]+$/
const eventTypeRegex = /^(?:[a-z]+(?:\.[a-z][a-z0-9]*)*)$/ // Following Java's package naming convention as per : https://spec.matrix.org/v1.11/#events

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
      send(res, 400, errMsg('invalidParam'))
      return
    }
    clientServer.authenticate(req, res, (data, token) => {
      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(res, schema, obj, clientServer.logger, (obj) => {
          if (parameters.userId !== data.sub) {
            // The config is only visible to the user that set the account data
            send(res, 403, {
              errcode: 'M_FORBIDDEN',
              error:
                'The access token provided is not authorized to update this user’s account data.'
            })
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
              send(res, 200, {})
            })
            .catch((e) => {
              // istanbul ignore next
              clientServer.logger.error(
                "Error updating user's presence state",
                e
              )
              // istanbul ignore next
              send(res, 500, errMsg('unknown'))
            })
        })
      })
    })
  }
}

export default putAccountData
