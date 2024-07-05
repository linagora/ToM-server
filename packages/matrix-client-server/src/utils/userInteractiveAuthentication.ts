import { type TwakeLogger } from '@twake/logger'
import { type Request, type Response } from 'express'
import type http from 'http'
import {
  type MatrixIdentifier,
  type AuthenticationData,
  type ClientServerDb,
  type Config,
  type flowContent
} from '../types'
import { Hash, randomString } from '@twake/crypto'
import type MatrixDBmodified from '../matrixDb'
import { errMsg, jsonContent, send } from '@twake/utils'
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
    case 'm.login.password':
      return new Promise((resolve, reject) => {
        const hash = new Hash()
        hash.ready
          .then(() => {
            matrixDb
              .get('users', ['name'], {
                name: (auth.identifier as MatrixIdentifier).user,
                password_hash: hash.sha256(auth.password) // TODO : Handle other hash functions
              })
              .then((rows) => {
                if (rows.length === 0) {
                  throw new Error()
                } else {
                  resolve()
                }
              })
              .catch((e) => {
                reject(errMsg('forbidden'))
              })
          })
          .catch((e) => {
            // istanbul ignore next
            reject(e)
          })
      })
    case 'm.login.email.identity':
      return new Promise((resolve, reject) => {
        // TODO : After implementing POST /_matrix/client/v3/account/password/email/requestToken, use it to validate this authentication type
      })
    case 'm.login.msisdn':
      return new Promise((resolve, reject) => {
        // TODO : After implementing POST /_matrix/client/v3/account/password/msisdn/requestToken, use it to validate this authentication type
      })
    case 'm.login.recaptcha':
      return new Promise((resolve, reject) => {
        // TODO : Implement this after understanding the structure of the response field in request body
      })
    case 'm.login.dummy':
      return new Promise((resolve, reject) => {
        resolve() // Dummy authentication always succeeds
      })
    case 'm.login.registration_token': // Only valid on the /register endpoint as per the spec
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
              .updateWithConditions(
                'registration_tokens',
                { pending: pending + 1 },
                [{ field: 'token', value: auth.token }]
              )
              .then(() => {
                const completed: number = rows[0].completed as number
                const usesAllowed: number = rows[0].uses_allowed as number
                if (
                  pending + completed + 1 > usesAllowed &&
                  usesAllowed !== null
                ) {
                  reject(errMsg('tokenMax'))
                } else {
                  matrixDb
                    .updateWithConditions(
                      'registration_tokens',
                      { completed: completed + 1, pending },
                      [{ field: 'token', value: auth.token }]
                    )
                    .then(() => {
                      resolve()
                    })
                    .catch((e) => {
                      // istanbul ignore next
                      reject(e)
                    })
                }
              })
              .catch((e) => {
                // istanbul ignore next
                reject(e)
              })
          })
          .catch((e) => {
            // istanbul ignore next
            reject(e)
          })
      })
    case 'm.login.terms': // Only valid on the /register endpoint as per the spec
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
        send(res, 401, {
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
                    const authOver = (
                      conf.flows as unknown as flowContent
                    ).some((flow) => {
                      return (
                        flow.stages.length === completed.length &&
                        flow.stages.every((stage) => completed.includes(stage))
                      )
                    })

                    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                    if (authOver) {
                      callback(obj) // what arguments to use in callback ?
                    } else {
                      send(res, 401, {
                        flows: conf.flows,
                        params: conf.params,
                        session: auth.session,
                        completed
                      })
                    }
                  })
                  .catch((e) => {
                    // istanbul ignore next
                    logger.error(
                      'Error while retrieving session credentials from the database during User-Interactive Authentication',
                      e
                    )
                    // istanbul ignore next
                    send(res, 400, errMsg('unknown'))
                  })
              })
              .catch((e) => {
                // istanbul ignore next
                logger.error(
                  'Error while inserting session credentials into the database during User-Interactive Authentication',
                  e
                )
                // istanbul ignore next
                send(res, 400, errMsg('unknown'))
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
                send(res, 401, {
                  errcode: e.errcode,
                  error: e.error,
                  completed,
                  flows: conf.flows,
                  params: conf.params,
                  session: auth.session
                })
              })
              .catch((e) => {
                // istanbul ignore next
                logger.error(
                  'Error while retrieving session credentials from the database during User-Interactive Authentication',
                  e
                )
                // istanbul ignore next
                send(res, 400, errMsg('unknown'))
              })
          })
      }
    })
  }
}

export default UiAuthenticate
