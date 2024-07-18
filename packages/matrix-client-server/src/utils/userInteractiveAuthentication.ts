import { type TwakeLogger } from '@twake/logger'
import { type Request, type Response } from 'express'
import type http from 'http'
import {
  type MatrixIdentifier,
  type AuthenticationData,
  type ClientServerDb,
  type Config,
  type AppServiceRegistration,
  type ThreepidCreds,
  type AuthenticationFlowContent,
  type AuthenticationTypes
} from '../types'
import { Hash, randomString } from '@twake/crypto'
import type MatrixDBmodified from '../matrixDb'
import { errMsg, jsonContent, send, toMatrixId } from '@twake/utils'
export type UiAuthFunction = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  allowedFlows: AuthenticationFlowContent,
  callback: (data: any, userId: string | null) => void
) => void

interface requestBody {
  auth?: AuthenticationData
  [key: string]: any // others parameters given in request body
}

const getParams = (type: AuthenticationTypes): any => {
  // for now only terms has params, spec is unclear about the other types. Add params here if needed in other endpoints
  // For production,maybe these params should be included in the config. The values here are only illustrative and taken from examples in the spec, they are not relevant and should be adapted before deployment.
  // TODO : Modify this before deployment
  switch (type) {
    case 'm.login.terms':
      return {
        policies: {
          terms_of_service: {
            version: '1.2',
            en: {
              name: 'Terms of Service',
              url: 'https://example.org/somewhere/terms-1.2-en.html'
            },
            fr: {
              name: "Conditions d'utilisation",
              url: 'https://example.org/somewhere/terms-1.2-fr.html'
            }
          }
        }
      }
    default:
      return {}
  }
}

// allowedFlows for endpoints other than register. Subject to change after implementing other endpoints that require UIAuth
export const allowedFlows: AuthenticationFlowContent = {
  flows: [
    {
      stages: ['m.login.application_service']
    },
    {
      stages: ['m.login.email.identity']
    },
    {
      stages: ['m.login.msisdn']
    },
    {
      stages: ['m.login.password']
    },
    {
      stages: ['m.login.recaptcha']
    },
    {
      stages: ['m.login.dummy']
    },
    {
      stages: ['m.login.sso']
    }
  ],
  params: {
    // Aside from terms, the other two params are useless for now, but I leave them here in case they become useful in the future
    // If we want to add params, we change the getParams function in utils/userInteractiveAuthentication.ts
    'm.login.application_service': getParams('m.login.application_service'),
    'm.login.msisdn': getParams('m.login.msisdn'),
    'm.login.email.identity': getParams('m.login.email.identity'),
    'm.login.password': getParams('m.login.password'),
    'm.login.recaptcha': getParams('m.login.recaptcha'),
    'm.login.dummy': getParams('m.login.dummy'),
    'm.login.sso': getParams('m.login.sso')
  }
}

// Allowed flow stages for /register endpoint.
// Doesn't contain password, email and msisdn since the user isn't registered yet (spec is unclear about this, only my interpretation)
export const registerAllowedFlows: AuthenticationFlowContent = {
  flows: [
    {
      stages: ['m.login.application_service']
    },
    {
      stages: ['m.login.terms', 'm.login.dummy'] // m.login.dummy added for testing purposes. This variable and the one before need to be updated before going into production (maybe add them to the config ?)
    },
    {
      stages: ['m.login.registration_token']
    },
    {
      stages: ['m.login.sso']
    },
    {
      stages: ['m.login.recaptcha']
    },
    {
      stages: ['m.login.dummy']
    }
  ],
  params: {
    // Aside from terms, the other two params are useless for now, but I leave them here in case they become useful in the future
    // If we want to add params, we change the getParams function in utils/userInteractiveAuthentication.ts
    'm.login.application_service': getParams('m.login.application_service'),
    'm.login.registration_token': getParams('m.login.registration_token'),
    'm.login.terms': getParams('m.login.terms'),
    'm.login.sso': getParams('m.login.sso')
  }
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
                  if (
                    rows[0].name === (auth.identifier as MatrixIdentifier).user
                  ) {
                    // Maybe should also check that the user account isn't shadowbanned nor deactivated (check that rows[0].shadow_banned/deactivated ===0), spec is unclear
                    // We only consider the case where the identifier is a MatrixIdentifier
                    // since the only table that has a password field is the users table
                    // which only contains a "name" field with the userId and no address field
                    // meaning we can't access it without the userId associated to that password
                    resolve(rows[0].name)
                  } else {
                    reject(errMsg('forbidden'))
                  }
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
    case 'm.login.sso':
      return new Promise((resolve, reject) => {
        // TODO : Complete this after implementing fallback mechanism : https://spec.matrix.org/v1.11/client-server-api/#fallback
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
  return (req, res, allowedFlows, callback) => {
    jsonContent(req, res, logger, (obj) => {
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (!(obj as requestBody).auth) {
        send(res, 401, {
          ...allowedFlows,
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
                    const authOver = allowedFlows.flows.some((flow) => {
                      return (
                        flow.stages.length === completed.length &&
                        flow.stages.every((stage) => completed.includes(stage))
                      )
                    })

                    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                    if (authOver) {
                      callback(obj, userId) // Arguments of callback are subject to change
                    } else {
                      send(res, 401, {
                        ...allowedFlows,
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
                ...allowedFlows
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
                  ...allowedFlows,
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
