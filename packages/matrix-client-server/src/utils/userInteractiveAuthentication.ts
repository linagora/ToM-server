import { type TwakeLogger } from '@twake/logger'
import { type Request, type Response } from 'express'
import type http from 'http'
import type e from 'express'
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
  isMatrixIdValid
} from '@twake/utils'
import type MatrixClientServer from '..'
export type UiAuthFunction = (
  req: Request | http.IncomingMessage,
  res: Response | http.ServerResponse,
  reference: Record<string, string>,
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
  reference: Record<string, string>,
  userId: string,
  description: string,
  data: any,
  callback: (data: any, userId: string | null) => void
): void => {
  if (userId != null && !isMatrixIdValid(userId)) {
    send(
      res,
      400,
      errMsg('invalidParam', 'Invalid user ID'),
      clientServer.logger
    )
  }
  // Authentication flows to verify that the user who has an access token is indeed who he claims to be, and has not just stolen another  user's access token
  getAvailableValidateUIAuthFlows(clientServer, userId)
    .then((verificationFlows) => {
      clientServer.uiauthenticate(
        req,
        res,
        reference,
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
const getAvailableValidateUIAuthFlows = async (
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
  if (
    clientServer.conf.is_password_login_enabled &&
    passwordRows.length > 0 &&
    passwordRows[0].password_hash !== null
  ) {
    // If the user has a password registered, he can authenticate using it
    availableFlows.flows.push({
      stages: ['m.login.password']
    })
    availableFlows.params['m.login.password'] = getParams('m.login.password')
  }
  if (clientServer.conf.is_sso_login_enabled) {
    availableFlows.flows.push({
      stages: ['m.login.sso']
    })
    availableFlows.params['m.login.sso'] = getParams('m.login.sso')
  }
  return availableFlows
}

// We do a separate function for the /register endpoint since the authentication flows are different
// For now we use the same config variables to allow the flows for login and register, but this can be changed in the future
// We don't include m.login.sso as done in the ElementHQ implementation but we could add it if needed
export const getRegisterAllowedFlows = (
  conf: Config
): AuthenticationFlowContent => {
  const availableFlows: AuthenticationFlowContent = {
    flows: [],
    params: {}
  }
  const requireEmail: boolean =
    conf.registration_required_3pid.includes('email')
  const requireMsisdn: boolean =
    conf.registration_required_3pid.includes('msisdn')
  if (requireEmail && !conf.is_email_login_enabled) {
    // istanbul ignore next
    throw new Error('Email registration is required but not enabled')
  }
  if (requireMsisdn && !conf.is_msisdn_login_enabled) {
    // istanbul ignore next
    throw new Error('Msisdn registration is required but not enabled')
  }
  if (conf.is_recaptcha_login_enabled) {
    availableFlows.flows.push({
      stages: ['m.login.recaptcha']
    })
    availableFlows.params['m.login.recaptcha'] = getParams('m.login.recaptcha')
  }
  if (conf.is_registration_token_login_enabled) {
    availableFlows.flows.push({
      stages: ['m.login.registration_token']
    })
    availableFlows.params['m.login.registration_token'] = getParams(
      'm.login.registration_token'
    )
  }
  if (conf.is_terms_login_enabled) {
    availableFlows.flows.push({
      stages: ['m.login.terms']
    })
    availableFlows.params['m.login.terms'] = getParams('m.login.terms')
  }
  if (requireEmail && requireMsisdn) {
    availableFlows.flows.push({
      stages: ['m.login.email.identity', 'm.login.msisdn']
    })
    availableFlows.params['m.login.email.identity'] = getParams(
      'm.login.email.identity'
    )
    availableFlows.params['m.login.msisdn'] = getParams('m.login.msisdn')
  } else {
    if (conf.is_msisdn_login_enabled) {
      availableFlows.flows.push({
        stages: ['m.login.msisdn']
      })
      availableFlows.params['m.login.msisdn'] = getParams('m.login.msisdn')
    }
    if (conf.is_email_login_enabled) {
      availableFlows.flows.push({
        stages: ['m.login.email.identity']
      })
      availableFlows.params['m.login.email.identity'] = getParams(
        'm.login.email.identity'
      )
    }
    if (!requireEmail && !requireMsisdn) {
      // If no 3pid authentication is required, we add the dummy auth flow as done in elementHQ's implementation.
      // This allows anybody to register so it could be removed if it is considered a security risk
      availableFlows.flows.push({
        stages: ['m.login.dummy']
      })
      // No parameters for dummy auth since it always succeeds
    }
  }
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

const verifyClientDict = <T>(
  res: e.Response | http.ServerResponse,
  content: T,
  reference: Record<string, string>,
  logger: TwakeLogger,
  callback: (obj: T) => void
): void => {
  for (const key in reference) {
    const expectedType = reference[key]
    const value = (content as any)[key]

    if (value !== null && value !== undefined) {
      // eslint-disable-next-line valid-typeof
      if (typeof value !== expectedType) {
        send(
          res,
          400,
          errMsg(
            'invalidParam',
            `Invalid ${key}: expected ${expectedType}, got ${typeof value}`
          ),
          logger
        )
        return
      }

      if (expectedType === 'string' && (value as string).length > 512) {
        send(
          res,
          400,
          errMsg('invalidParam', `${key} exceeds 512 characters`),
          logger
        )
        return
      }
    }
  }
  callback(content)
}

const UiAuthenticate = (
  // db: ClientServerDb,
  matrixDb: MatrixDBmodified,
  conf: Config,
  logger: TwakeLogger
): UiAuthFunction => {
  return (req, res, reference, allowedFlows, description, callback) => {
    jsonContent(req, res, logger, (obj) => {
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (!(obj as requestBody).auth) {
        send(res, 401, {
          ...allowedFlows,
          session: randomString(12) // Chose 12 arbitrarily according to a spec example
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
                      const getCompletedStages = matrixDb.get(
                        'ui_auth_sessions_credentials',
                        ['stage_type'],
                        {
                          session_id: auth.session
                        }
                      )
                      const updateClientDict = matrixDb.updateWithConditions(
                        'ui_auth_sessions',
                        { clientdict: JSON.stringify(obj) },
                        [{ field: 'session_id', value: auth.session }]
                      )
                      Promise.all([getCompletedStages, updateClientDict])
                        .then((rows) => {
                          const completed: string[] = rows[0].map(
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
                      send(res, 401, {
                        ...allowedFlows,
                        session: auth.session,
                        completed
                      })
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
                  // istanbul ignore next
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
  }
}

export default UiAuthenticate
