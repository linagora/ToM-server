import type MatrixClientServer from '../..'
import { errMsg, type expressAppHandler, send } from '@twake/utils'

interface Parameters {
  userId: string
  type: string
}

const matrixIdRegex = /^@[0-9a-zA-Z._=-]+:[0-9a-zA-Z.-]+$/
const eventTypeRegex = /^(?:[a-z]+(?:\.[a-z][a-z0-9]*)*)$/ // Following Java's package naming convention as per : https://spec.matrix.org/v1.11/#events

const getAccountData = (
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
        .get('account_data', ['content'], {
          user_id: parameters.userId,
          account_data_type: parameters.type
        })
        .then((rows) => {
          if (rows.length === 0) {
            send(res, 404, {
              errcode: 'M_NOT_FOUND',
              error:
                'No account data has been provided for this user with the given type.'
            })
          } else {
            const body: Record<string, string> = {}
            body[parameters.type] = rows[0].content as string
            send(res, 200, body)
          }
        })
        .catch((e) => {
          // istanbul ignore next
          clientServer.logger.error("Error retrieving user's account data", e)
          // istanbul ignore next
          send(res, 500, errMsg('unknown'))
        })
    })
  }
}

export default getAccountData
