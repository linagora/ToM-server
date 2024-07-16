import { type TwakeLogger } from '@twake/logger'
import { type Request, type Response } from 'express'
import type http from 'http'
import {
  type MatrixIdentifier,
  type AuthenticationData,
  type ClientServerDb,
  type Config,
  type AppServiceRegistration
} from '../types'
import { Hash, randomString } from '@twake/crypto'
import type MatrixDBmodified from '../matrixDb'
import { errMsg, jsonContent, send, toMatrixId } from '@twake/utils'
export type UiAuthFunction = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  callback: (data: any, userId: string) => void
) => void

interface requestBody {
  auth?: AuthenticationData
  [key: string]: any // others parameters given in request body
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
const checkAuthentication = (
  auth: AuthenticationData,
  matrixDb: MatrixDBmodified,
  conf: Config,
  req: Request | http.IncomingMessage
): Promise<string> => {
  // It returns a Promise<string> so that it can return the userId of the authenticated user for endpoints other than /register. For register and dummy auth we return ''.
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
                  resolve(rows[0].name as string)
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
    case 'm.login.msisdn':
    case 'm.login.email.identity': // Both cases are handled the same through their threepid_creds
      return new Promise((resolve, reject) => {
        const threepidCreds: ThreepidCreds = auth.threepid_creds
        matrixDb
          .get('threepid_validation_session', ['address', 'validated_at'], {
            client_secret: threepidCreds.client_secret,
            session_id: threepidCreds.sid
          })
          .then((sessionRows) => {
            if (sessionRows.length === 0) {
              reject(errMsg('noValidSession'))
              return
            }
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            if (!sessionRows[0].validated_at) {
              reject(errMsg('sessionNotValidated'))
              return
            }
            matrixDb
              .get('user_threepids', ['user_id'], {
                address: sessionRows[0].address
              })
              .then((rows) => {
                if (rows.length === 0) {
                  reject(errMsg('threepidNotFound'))
                } else {
                  resolve(rows[0].user_id as string)
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
    case 'm.login.recaptcha':
      return new Promise((resolve, reject) => {
        // TODO : Implement this after understanding the structure of the response field in request body
      })
    case 'm.login.dummy':
      return new Promise((resolve, reject) => {
        resolve('') // Dummy authentication always succeeds
      })
    case 'm.login.registration_token': // Only valid on the /register endpoint as per the spec // TODO : add uses_allowed to config ?
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
                      resolve('')
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
        resolve('') // The client makes sure the user has accepted all the terms before sending the request indicating the user has accepted the terms
      })
    case 'm.login.application_service': // TODO : Check the structure of the ApplicationServiceAuth in the spec.
      return new Promise((resolve, reject) => {
        const applicationServices = conf.application_services
        const asTokens: string[] = applicationServices.map(
          (as: AppServiceRegistration) => as.as_token
        )
        if (req.headers.authorization === undefined) {
          reject(errMsg('missingToken'))
        }
        // @ts-expect-error req.headers.authorization is defined
        const token = req.headers.authorization.split(' ')[1]
        if (asTokens.includes(token)) {
          // Check if the request is made by an application-service
          const appService = applicationServices.find(
            (as: AppServiceRegistration) => as.as_token === token
          )
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          const userId = toMatrixId(auth.username, conf.server_name)
          if (
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            appService?.namespaces.users &&
            !appService?.namespaces.users.some((namespace) =>
              new RegExp(namespace.regex).test(userId)
            ) // check if the userId is registered by the appservice
          ) {
            reject(errMsg('invalidUsername'))
          } else {
            resolve(userId)
          }
        } else {
          reject(errMsg('unknownToken'))
        }
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
          flows: conf.authentication_flows.flows,
          params: conf.authentication_flows.params,
          session: randomString(12) // Chose 12 arbitrarily according to a spec example
        })
      } else {
        const auth = (obj as requestBody).auth as AuthenticationData
        checkAuthentication(auth, matrixDb, conf, req)
          .then((userId) => {
            if (auth.type === 'm.login.application_service') {
              callback(obj, userId) // Arguments of callback are subject to change
              return
            }
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
                    const authOver = conf.authentication_flows.flows.some(
                      (flow) => {
                        return (
                          flow.stages.length === completed.length &&
                          flow.stages.every((stage) =>
                            completed.includes(stage)
                          )
                        )
                      }
                    )

                    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                    if (authOver) {
                      callback(obj, userId) // Arguments of callback are subject to change
                    } else {
                      send(res, 401, {
                        flows: conf.authentication_flows.flows,
                        params: conf.authentication_flows.params,
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
                    send(res, 400, e)
                  })
              })
              .catch((e) => {
                // istanbul ignore next
                logger.error(
                  'Error while inserting session credentials into the database during User-Interactive Authentication',
                  e
                )
                // istanbul ignore next
                send(res, 400, e)
              })
          })
          .catch((e) => {
            if (auth.type === 'm.login.application_service') {
              send(res, 401, {
                errcode: e.errcode,
                error: e.error,
                flows: conf.authentication_flows.flows,
                params: conf.authentication_flows.params
              })
              return
            }
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
                  flows: conf.authentication_flows.flows,
                  params: conf.authentication_flows.params,
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
                send(res, 400, e)
              })
          })
      }
    })
  }
}

export default UiAuthenticate
