import { type TwakeLogger } from '@twake/logger'
import { type Request, type Response } from 'express'
import type http from 'http'
import {
  type MatrixIdentifier,
  type AuthenticationData,
  type Config,
  type AppServiceRegistration,
  type ThreepidCreds,
  type AuthenticationFlowContent,
  type AuthenticationTypes,
  type ApplicationServiceAuth
} from '../types'
import { Hash, randomString } from '@twake/crypto'
import type MatrixDBmodified from '../matrixDb'
import {
  epoch,
  errMsg,
  jsonContent,
  send,
  toMatrixId,
  matrixIdRegex
} from '@twake/utils'
import type MatrixClientServer from '..'
export type UiAuthFunction = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  allowedFlows: AuthenticationFlowContent,
  description: string,
  callback: (data: any, userId: string | null) => void
) => void

interface requestBody {
  auth?: AuthenticationData
  [key: string]: any // others parameters given in request body
}

export const getParams = (type: AuthenticationTypes): any => {
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

// This method is used after the user has been authenticated with clientServer.authenticate to verify that the user is indeed who he claims to be
export const validateUserWithUIAuthentication = (
  clientServer: MatrixClientServer,
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  userId: string,
  description: string,
  data: any,
  callback: (data: any, userId: string | null) => void
): void => {
  if (userId != null && !matrixIdRegex.test(userId)) {
    send(
      res,
      400,
      errMsg('invalidParam', 'Invalid user ID'),
      clientServer.logger
    )
  }
  // Authentication flows to verify that the user who has an access token is indeed who he claims to be, and has not just stolen another  user's access token
  getAvailableUIAuthFlows(clientServer, userId)
    .then((verificationFlows) => {
      clientServer.uiauthenticate(
        req,
        res,
        verificationFlows,
        description,
        callback
      )
    })
    .catch((e) => {
      // istanbul ignore next
      clientServer.logger.error(
        'Error getting available authentication flows for user',
        e
      )
      // istanbul ignore next
      send(res, 500, e, clientServer.logger)
    })
}

// Function to get the available authentication flows for a user
// Maybe application services are also allowed to access these endpoints with the type m.login.application_service
// but the spec is unclear about this.
// It says appservices cannot access "Account Management" endpoints but never defines what these endpoints are
const getAvailableUIAuthFlows = async (
  clientServer: MatrixClientServer,
  userId: string
): Promise<AuthenticationFlowContent> => {
  const availableFlows: AuthenticationFlowContent = {
    flows: [],
    params: {}
  }
  const passwordRows = await clientServer.matrixDb.get(
    'users',
    ['password_hash'],
    {
      name: userId
    }
  )
  if (passwordRows.length > 0 && passwordRows[0].password_hash !== null) {
    // If the user has a password registered, he can authenticate using it
    availableFlows.flows.push({
      stages: ['m.login.password']
    })
  }
  availableFlows.flows.push({
    // For now we assume SSO Authentication available for every user, but we could add a check to see if it supported in server config for example
    stages: ['m.login.sso']
  })
  return availableFlows
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
                  // Maybe should also check that the user account isn't shadowbanned nor deactivated (check that rows[0].shadow_banned/deactivated ===0), spec is unclear
                  // We only consider the case where the identifier is a MatrixIdentifier
                  // since the only table that has a password field is the users table
                  // which only contains a "name" field with the userId and no address field
                  // meaning we can't access it without the userId associated to that password
                  resolve(rows[0].name as string)
                }
              })
              .catch((e) => {
                reject(
                  errMsg(
                    'forbidden',
                    'The user does not have a password registered'
                  )
                )
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
        resolve('') // Placeholder return statement
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
                address: sessionRows[0].address,
                medium: auth.type === 'm.login.msisdn' ? 'msisdn' : 'email' // So that you can't validate with an email if you're in the msisdn flow and vice versa
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
        resolve('') // Placeholder return statement
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
                  reject(
                    errMsg('invalidToken', 'Token has been used too many times')
                  )
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
  }
  // istanbul ignore next
  return new Promise((resolve, reject) => {
    // istanbul ignore next
    resolve('') // Placeholder to prevent error since m.login.application_service isn't handled here
  })
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
const handleAppServiceAuthentication = (
  req: Request | http.IncomingMessage,
  conf: Config,
  auth: ApplicationServiceAuth
): Promise<string> => {
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
      const userId = auth.username
        ? toMatrixId(auth.username, conf.server_name)
        : // @ts-expect-error : appService is defined since asTokens contains token
          toMatrixId(appService?.sender_localpart, conf.server_name)
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

const doAppServiceAuthentication = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  allowedFlows: AuthenticationFlowContent,
  auth: ApplicationServiceAuth,
  conf: Config,
  logger: TwakeLogger,
  obj: any,
  callback: (data: any, userId: string | null) => void
): void => {
  handleAppServiceAuthentication(req, conf, auth)
    .then((userId) => {
      callback(obj, userId)
    })
    .catch((e) => {
      send(
        res,
        401,
        {
          errcode: e.errcode,
          error: e.error,
          ...allowedFlows
        },
        logger
      )
    })
}
const UiAuthenticate = (
  // db: ClientServerDb,
  matrixDb: MatrixDBmodified,
  conf: Config,
  logger: TwakeLogger
): UiAuthFunction => {
  return (req, res, allowedFlows, description, callback) => {
    jsonContent(req, res, logger, (obj) => {
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (!(obj as requestBody).auth) {
        // If there is no auth key in the request body, we create a new authentication session
        const sessionId = randomString(24) // Chose 24 according to synapse implementation but seems arbitrary
        const ip =
          (req.headers['x-forwarded-for'] as string) ?? (req as Request).ip
        const userAgent = req.headers['user-agent'] ?? 'undefined'
        const addUserIps = matrixDb.insert('ui_auth_sessions_ips', {
          session_id: sessionId,
          ip,
          user_agent: userAgent
        })
        const createAuthSession = matrixDb.insert('ui_auth_sessions', {
          session_id: sessionId,
          creation_time: epoch(),
          clientdict: JSON.stringify(obj),
          serverdict: JSON.stringify({}),
          uri: req.url as string, // TODO : Ensure this is the right way to get the URI
          method: req.method as string,
          description
        })
        Promise.all([addUserIps, createAuthSession])
          .then(() => {
            send(
              // We send back the session_id to the client so that he can use it in future requests
              res,
              401,
              {
                ...allowedFlows,
                session: sessionId
              },
              logger
            )
          })
          .catch((e) => {
            /* istanbul ignore next */
            logger.error(
              'Error while creating a new session during User-Interactive Authentication',
              e
            )
            /* istanbul ignore next */
            send(res, 500, e, logger)
          })
      } else {
        const auth = (obj as requestBody).auth as AuthenticationData
        if (auth.type === 'm.login.application_service') {
          doAppServiceAuthentication(
            req,
            res,
            allowedFlows,
            auth,
            conf,
            logger,
            obj,
            callback
          )
          return
        }
        matrixDb
          .get('ui_auth_sessions', ['*'], { session_id: auth.session })
          .then((rows) => {
            if (rows.length === 0) {
              logger.error(`Unknown session ID : ${auth.session}`)
              send(res, 400, errMsg('noValidSession'), logger)
            } else if (
              rows[0].uri !== req.url ||
              rows[0].method !== req.method
            ) {
              send(
                res,
                403,
                errMsg(
                  'forbidden',
                  'Requested operation has changed during the UI authentication session.'
                ),
                logger
              )
            } else {
              checkAuthentication(auth, matrixDb, conf, req)
                .then((userId) => {
                  matrixDb
                    .insert('ui_auth_sessions_credentials', {
                      session_id: auth.session,
                      stage_type: auth.type,
                      result: userId
                    })
                    .then((rows) => {
                      matrixDb
                        .get('ui_auth_sessions_credentials', ['stage_type'], {
                          session_id: auth.session
                        })
                        .then((rows) => {
                          const completed: string[] = rows.map(
                            (row) => row.stage_type as string
                          )
                          const authOver = allowedFlows.flows.some((flow) => {
                            return (
                              flow.stages.length === completed.length &&
                              flow.stages.every((stage) =>
                                completed.includes(stage)
                              )
                            )
                          })

                          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                          if (authOver) {
                            callback(obj, userId) // Arguments of callback are subject to change
                          } else {
                            send(
                              res,
                              401,
                              {
                                ...allowedFlows,
                                session: auth.session,
                                completed
                              },
                              logger
                            )
                          }
                        })
                        .catch((e) => {
                          /* istanbul ignore next */
                          logger.error(
                            'Error while retrieving session credentials from the database during User-Interactive Authentication',
                            e
                          )
                          /* istanbul ignore next */
                          send(res, 400, e, logger)
                        })
                    })
                    .catch((e) => {
                      /* istanbul ignore next */
                      logger.error(
                        'Error while inserting session credentials into the database during User-Interactive Authentication',
                        e
                      )
                      /* istanbul ignore next */
                      send(res, 400, e, logger)
                    })
                })
                .catch((e) => {
                  matrixDb
                    .get('ui_auth_sessions_credentials', ['stage_type'], {
                      session_id: auth.session
                    })
                    .then((rows) => {
                      const completed: string[] = rows.map(
                        // istanbul ignore next
                        (row) => row.stage_type as string
                      )
                      send(
                        res,
                        401,
                        {
                          errcode: e.errcode,
                          error: e.error,
                          completed,
                          ...allowedFlows,
                          session: auth.session
                        },
                        logger
                      )
                    })
                    .catch((e) => {
                      /* istanbul ignore next */
                      logger.error(
                        'Error while retrieving session credentials from the database during User-Interactive Authentication',
                        e
                      )
                      /* istanbul ignore next */
                      send(res, 400, e, logger)
                    })
                })
            }
          })
          .catch((e) => {
            // istanbul ignore next
            logger.error(
              'Error retrieving UI Authentication session from the database'
            )
            // istanbul ignore next
            send(res, 500, e, logger)
          })
      }
    })
  }
}

export default UiAuthenticate
