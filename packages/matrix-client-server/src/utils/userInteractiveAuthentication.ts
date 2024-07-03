import { type TwakeLogger } from '@twake/logger'
import { type Request, type Response } from 'express'
import { errMsg, Utils } from '@twake/matrix-identity-server'
import type http from 'http'
import { jsonContent } from '@twake/matrix-identity-server/dist/utils'
import {
  AuthenticationTypes,
  type MatrixIdentifier,
  type AuthenticationData,
  type ClientServerDb,
  type Config
} from '../types'
import { Hash, randomString } from '@twake/crypto'
import type MatrixDBmodified from '../matrixDb'
export type UiAuthFunction = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  callback: (data: any) => void
) => void

interface requestBody {
  auth?: AuthenticationData
  [key: string]: any // others parameters given in request body
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
const checkAuthentication = (
  auth: AuthenticationData,
  matrixDb: MatrixDBmodified
): Promise<void> => {
  switch (auth.type) {
    case AuthenticationTypes.Password:
      return new Promise((resolve, reject) => {
        const hash = new Hash()
        matrixDb
          .get('users', ['user_id'], {
            name: (auth.identifier as MatrixIdentifier).user,
            password_hash: hash.sha256(auth.password) // TODO : Handle other hash functions
          })
          .then((rows) => {
            resolve()
          })
          .catch((e) => {
            reject(e)
          })
      })
    case AuthenticationTypes.Email:
      return new Promise((resolve, reject) => {
        // TODO : After implementing POST /_matrix/client/v3/account/password/email/requestToken, use it to validate this authentication type
      })
    case AuthenticationTypes.Phone:
      return new Promise((resolve, reject) => {
        // TODO : After implementing POST /_matrix/client/v3/account/password/msisdn/requestToken, use it to validate this authentication type
      })
    case AuthenticationTypes.Recaptcha:
      return new Promise((resolve, reject) => {
        // TODO : Implement this after understanding the structure of the response field in request body
      })
    case AuthenticationTypes.Dummy:
      return new Promise((resolve, reject) => {
        resolve() // Dummy authentication always succeeds
      })
    case AuthenticationTypes.Token: // Only valid on the /register endpoint as per the spec
      return new Promise((resolve, reject) => {
        matrixDb
          .get(
            'registration_tokens',
            ['uses_allowed', 'pending', 'completed'],
            {
              // We don't check for expiry time as the client should use the /validity API before attempting registration to make sure the token is still valid before using it, as per the spec
              token: auth.token
            }
          )
          .then((rows) => {
            const pending: number = rows[0].pending as number
            matrixDb
              .update(
                'registration_tokens',
                { pending: pending + 1 },
                'token',
                auth.token
              )
              .then(() => {
                const completed: number = rows[0].completed as number
                const usesAllowed: number = rows[0].uses_allowed as number
                if (
                  pending + completed + 1 > usesAllowed &&
                  usesAllowed !== null
                ) {
                  const err: Error = new Error(
                    'Token has been used too many times'
                  )
                  reject(err)
                } else {
                  matrixDb
                    .update(
                      'registration_tokens',
                      { completed: completed + 1, pending },
                      'token',
                      auth.token
                    )
                    .then(() => {
                      resolve()
                    })
                    .catch((e) => {
                      reject(e)
                    })
                }
              })
              .catch((e) => {
                reject(e)
              })
            resolve()
          })
          .catch((e) => {
            reject(e)
          })
      })
    case AuthenticationTypes.Terms: // Only valid on the /register endpoint as per the spec
      return new Promise((resolve, reject) => {
        resolve() // The client makes sure the user has accepted all the terms before sending the request indicating the user has accepted the terms
      })
  }
}

const UiAuthenticate = (
  db: ClientServerDb,
  matrixDb: MatrixDBmodified,
  conf: Config,
  logger: TwakeLogger
): UiAuthFunction => {
  return (req, res, callback) => {
    jsonContent(req, res, logger, (obj) => {
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (!(obj as requestBody).auth) {
        Utils.send(res, 401, {
          flows: conf.flows,
          params: conf.params,
          session: randomString(12) // Chose 12 arbitrarily according to a spec example
        })
      } else {
        const auth = (obj as requestBody).auth as AuthenticationData
        checkAuthentication(auth, matrixDb)
          .then(() => {
            db.insert('ui_auth_sessions', {
              session_id: auth.session,
              stage_type: auth.type
            })
              .then((rows) => {
                db.get('ui_auth_sessions', ['stage_type'], {
                  session_id: auth.session
                })
                  .then((rows) => {
                    const completed: string[] = rows.map(
                      (row) => row.stage_type as string
                    )
                    const authOver = conf.flows.some((flow) => {
                      return flow.stages.every((stage) =>
                        completed.includes(stage)
                      ) // check if all stages of a flow are completed
                    })
                    if (authOver) {
                      callback(obj) // what arguments to use in callback ?
                    } else {
                      Utils.send(res, 401, {
                        flows: conf.flows,
                        params: conf.params,
                        session: auth.session,
                        completed
                      })
                    }
                  })
                  .catch((e) => {
                    logger.error(
                      'Error while retrieving session credentials from the database during User-Interactive Authentication',
                      e
                    )
                    Utils.send(res, 400, errMsg('unknown'))
                  })
              })
              .catch((e) => {
                logger.error(
                  'Error while inserting session credentials into the database during User-Interactive Authentication',
                  e
                )
                Utils.send(res, 400, errMsg('unknown'))
              })
          })
          .catch((e) => {
            db.get('ui_auth_sessions', ['stage_type'], {
              session_id: auth.session
            })
              .then((rows) => {
                const completed: string[] = rows.map(
                  (row) => row.stage_type as string
                )
                Utils.send(res, 401, {
                  errcode: e.errcode,
                  error: e.error,
                  completed,
                  flows: conf.flows,
                  params: conf.params,
                  session: auth.session
                })
              })
              .catch((e) => {
                logger.error(
                  'Error while retrieving session credentials from the database during User-Interactive Authentication',
                  e
                )
                Utils.send(res, 400, errMsg('unknown'))
              })
          })
      }
    })
  }
}

export default UiAuthenticate
