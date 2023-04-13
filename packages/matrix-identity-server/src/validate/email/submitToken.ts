import { type Config } from '../..'
import type IdentityServerDb from '../../db'
import { type expressAppHandler, send, jsonContent } from '../../utils'
import { errMsg } from '../../utils/errors'

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

const SubmitToken = (db: IdentityServerDb, conf: Config): expressAppHandler => {
  return (req, res) => {
    const realMethod = (prms: parameters): void => {
      if (
        prms.client_secret?.length != null &&
        prms.token?.length != null &&
        prms.sid?.length != null
      ) {
        db.verifyToken(prms.token)
          .then((data) => {
            if (
              (data as mailToken).sid === prms.sid &&
              (data as mailToken).client_secret === prms.client_secret
            ) {
              // TODO REGISTER (data as mailToken).mail
              db.deleteToken(prms.token as string)
                .then(() => {
                  send(res, 200, { success: true })
                })
                .catch((e) => {})
            } else {
              send(res, 400, errMsg('invalidParam', 'sid or secret mismatch'))
            }
          })
          .catch((e) => {
            console.error('Token error', e)
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
      jsonContent(req, res, (data) => {
        realMethod(data as parameters)
      })
    } else {
      /* istanbul ignore next */
      send(res, 400, errMsg('unAuthorized', 'Unauthorized method'))
    }
  }
}

export default SubmitToken
