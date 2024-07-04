import type MatrixIdentityServer from '../..'
import {
  epoch,
  errMsg,
  jsonContent,
  send,
  type expressAppHandler
} from '@twake/utils'

interface parameters {
  client_secret?: string
  token?: string
  sid?: string
}

interface mailToken {
  client_secret: string
  mail: string
  sid: string
}

const SubmitToken = <T extends string = never>(
  idServer: MatrixIdentityServer<T>
): expressAppHandler => {
  return (req, res) => {
    const realMethod = (prms: parameters): void => {
      if (
        prms.client_secret?.length != null &&
        prms.token?.length != null &&
        prms.sid?.length != null
      ) {
        idServer.db
          .verifyToken(prms.token)
          .then((data) => {
            if (
              (data as mailToken).sid === prms.sid &&
              (data as mailToken).client_secret === prms.client_secret
            ) {
              // TODO REGISTER (data as mailToken).mail
              idServer.db
                .deleteToken(prms.token as string)
                .then(() => {
                  idServer.db
                    .updateAnd(
                      'mappings',
                      { valid: 1, submit_time: epoch() },
                      { field: 'session_id', value: (data as mailToken).sid },
                      {
                        field: 'client_secret',
                        value: (data as mailToken).client_secret
                      }
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
            idServer.logger.error('Token error', e)
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
      realMethod(req.query as parameters)
    } else if (req.method === 'POST') {
      jsonContent(req, res, idServer.logger, (data) => {
        realMethod(data as parameters)
      })
    } else {
      /* istanbul ignore next */
      send(res, 400, errMsg('unAuthorized', 'Unauthorized method'))
    }
  }
}

export default SubmitToken
