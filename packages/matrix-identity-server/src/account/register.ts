import { type expressAppHandler, jsonContent, validateParameters, send, epoch } from '../utils'
import { randomString } from '../utils/tokenUtils'
import fetch from 'node-fetch'
import { errMsg } from '../utils/errors'
import type IdentityServerDb from '../db'

const schema = {
  access_token: true,
  expires_in: true,
  matrix_server_name: true,
  token_type: true
}

type registerArgs = Record<keyof typeof schema, string>

interface userInfoResponse {
  sub: string
}

export interface tokenContent {
  sub: string
  epoch: number
}

const hostnameRe = /^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9-]*[A-Za-z0-9])$/i

const Register = (db: IdentityServerDb): expressAppHandler => {
  return (req, res) => {
    jsonContent(req, res, (obj) => {
      validateParameters(res, schema, obj, (obj) => {
        if (hostnameRe.test((obj as registerArgs).matrix_server_name)) {
          fetch(
            encodeURI(`https://${(obj as registerArgs).matrix_server_name}/_matrix/federation/v1/openid/userinfo?access_token=${(obj as registerArgs).access_token}`)
          )
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            .then(res => res.json())
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
            // @ts-ignore
            .then((userInfo: userInfoResponse) => {
              if (userInfo.sub != null) {
                const cmp = userInfo.sub.match(/^@(.+?):[^:]+$/)
                if (cmp != null) {
                  const data: tokenContent = {
                    sub: userInfo.sub,
                    epoch: epoch()
                  }
                  const token = randomString(64)
                  db.insert('tokens', [token, JSON.stringify(data)]).then(() => {
                    send(res, 200, { token, access_token: token })
                  }).catch(e => {
                    /* istanbul ignore next */
                    console.error('Unable to create session', e)
                    /* istanbul ignore next */
                    send(res, 500, errMsg('unknown', 'Unable to create session'))
                  })
                } else {
                  send(res, 500, errMsg('unknown', 'The Matrix homeserver returned an invalid MXID'))
                }
              } else {
                send(res, 500, errMsg('unknown', "The Matrix homeserver did not include 'sub' in its response"))
              }
            }).catch(e => {
              /* istanbul ignore next */
              send(res, 500, errMsg('unknown'))
            })
        }
      })
    })
  }
}

export default Register
