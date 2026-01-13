import type MatrixIdentityServer from '../..'
import {
  epoch,
  errMsg,
  jsonContent,
  send,
  type expressAppHandler
} from '@twake-chat/utils'

interface parameters {
  client_secret?: string
  token?: string
  sid?: string
}

interface MailToken {
  client_secret: string
  mail: string
  sid: string
  next_link?: string
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
              (data as MailToken).sid === prms.sid &&
              (data as MailToken).client_secret === prms.client_secret
            ) {
              idServer.db
                .deleteToken(prms.token as string)
                .then(() => {
                  idServer.db
                    .updateAnd(
                      'mappings',
                      { valid: 1, submit_time: epoch() },
                      { field: 'session_id', value: (data as MailToken).sid },
                      {
                        field: 'client_secret',
                        value: (data as MailToken).client_secret
                      }
                    )
                    .then(() => {
                      if (
                        req.method === 'GET' &&
                        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                        (data as MailToken).next_link
                      ) {
                        const redirectUrl = new URL(
                          // @ts-expect-error : We check that next_link is not null beforehand
                          (data as Token).next_link
                        ).toString()
                        res.writeHead(302, {
                          Location: redirectUrl
                        })
                        res.end()
                        return
                      }
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
