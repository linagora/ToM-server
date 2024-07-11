import {
  epoch,
  errMsg,
  jsonContent,
  send,
  type expressAppHandler
} from '@twake/utils'
import type MatrixClientServer from '../..'

interface Parameters {
  client_secret?: string
  token?: string
  sid?: string
}

interface Token {
  client_secret: string
  session_id: string
}

// TODO : Redirect to next_link from requestToken if present

const SubmitToken = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    const realMethod = (parameters: Parameters): void => {
      if (
        parameters.client_secret?.length != null &&
        parameters.token?.length != null &&
        parameters.sid?.length != null
      ) {
        clientServer.matrixDb
          .verifyToken(parameters.token)
          .then((data) => {
            if (
              (data as Token).session_id === parameters.sid &&
              (data as Token).client_secret === parameters.client_secret
            ) {
              clientServer.db
                .deleteToken(parameters.token as string)
                .then(() => {
                  clientServer.matrixDb
                    .updateWithConditions(
                      'threepid_validation_session',
                      { validated_at: epoch() },
                      [
                        {
                          field: 'session_id',
                          value: (data as Token).session_id
                        },
                        {
                          field: 'client_secret',
                          value: (data as Token).client_secret
                        }
                      ]
                    )
                    .then(() => {
                      send(res, 200, { success: true })
                    })
                    .catch((e) => {})
                })
                .catch((e) => {})
            } else {
              /* istanbul ignore next */
              send(res, 400, errMsg('invalidParam', 'sid or secret mismatch'))
            }
          })
          .catch((e) => {
            clientServer.logger.error('Token error', e)
            send(
              res,
              400,
              errMsg('invalidParam', 'Unknown or expired token' + (e as string))
            )
          })
      } else {
        send(res, 400, errMsg('missingParams'))
      }
    }
    if (req.method === 'GET') {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore
      realMethod(req.query as Parameters)
    } else if (req.method === 'POST') {
      jsonContent(req, res, clientServer.logger, (data) => {
        realMethod(data as Parameters)
      })
    } else {
      /* istanbul ignore next */
      send(res, 400, errMsg('unAuthorized', 'Unauthorized method'))
    }
  }
}

export default SubmitToken
