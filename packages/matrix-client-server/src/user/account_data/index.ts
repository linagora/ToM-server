import type MatrixClientServer from '../..'
import {
  jsonContent,
  validateParameters,
  errMsg,
  type expressAppHandler,
  send
} from '@twake/utils'

interface parameters {
  userId: string
  type: string
}

interface PutRequestBody {
  content: string
}

const schema = {
  content: true
}

const mxidRe = /^@[0-9a-zA-Z._=-]+:[0-9a-zA-Z.-]+$/
// TODO : Handle error 403 where the user isn't allowed to see this user's account data
// TODO : Handle error 405 where the type of account data is controlled by the server and cannot be modified by the client

const accountDataType = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const prms: parameters = req.params as parameters
    if (!mxidRe.test(prms.userId)) {
      send(res, 400, errMsg('invalidParam', 'invalid Matrix user ID'))
      return
    }
    clientServer.authenticate(req, res, (data, id) => {
      if (req.method === 'GET') {
        clientServer.matrixDb
          .get('account_data', ['content'], {
            user_id: prms.userId,
            account_data_type: prms.type
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
              body[prms.type] = rows[0].content as string
              send(res, 200, body)
            }
          })
          .catch((e) => {
            // istanbul ignore next
            clientServer.logger.error(
              "Error retrieving user's presence state",
              e
            )
            // istanbul ignore next
            send(res, 500, errMsg('unknown'))
          })
      } else if (req.method === 'PUT') {
        jsonContent(req, res, clientServer.logger, (obj) => {
          validateParameters(res, schema, obj, clientServer.logger, (obj) => {
            clientServer.matrixDb
              .updateWithConditions(
                'account_data',
                { content: (obj as PutRequestBody).content },
                [
                  { field: 'user_id', value: prms.userId },
                  { field: 'account_data_type', value: prms.type }
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
      }
    })
  }
}

export default accountDataType
