/* eslint-disable @typescript-eslint/promise-function-async */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import {
  jsonContent,
  errMsg,
  type expressAppHandler,
  send,
  epoch,
  toMatrixId
} from '@twake/utils'
import {
  type AuthenticationFlowContent,
  type AuthenticationData
} from '../types'
import { Hash, randomString } from '@twake/crypto'
import type MatrixClientServer from '..'
import { type DbGetResult } from '@twake/matrix-identity-server'
import type { ServerResponse } from 'http'
import type e from 'express'
import { getParams } from '../utils/userInteractiveAuthentication'

interface Parameters {
  kind: 'guest' | 'user'
  guest_access_token?: string // If a guest wants to upgrade his account, from spec : https://spec.matrix.org/v1.11/client-server-api/#guest-access
}

interface RegisterRequestBody {
  auth?: AuthenticationData
  device_id?: string
  inhibit_login?: boolean
  initial_device_display_name?: string
  password?: string
  refresh_token?: boolean
  username?: string
}

// Allowed flow stages for /register endpoint.
// Doesn't contain password since the user is registering a new account, so he doesn't have a password yet.
// for now only terms has params, spec is unclear about the other types. Add params here if needed in other endpoints
// For production,maybe these params should be included in the config. The values here are only illustrative and taken from examples in the spec, they are not relevant and should be adapted before deployment.
// Maybe we should add parameters in the config to tell whether or not the server supports a given login type,
// and create a function to get the supported flows reading the config instead of hardcoding the supported flows here.
// TODO : Modify this before deployment
export const registerAllowedFlows: AuthenticationFlowContent = {
  flows: [
    {
      stages: ['m.login.application_service']
    },
    {
      stages: ['m.login.terms']
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
    },
    {
      stages: ['m.login.msisdn']
    },
    {
      stages: ['m.login.email.identity']
    }
  ],
  params: {
    // Aside from terms, the other two params are useless for now, but I leave them here in case they become useful in the future
    // If we want to add params, we change the getParams function in utils/userInteractiveAuthentication.ts
    'm.login.application_service': getParams('m.login.application_service'),
    'm.login.registration_token': getParams('m.login.registration_token'),
    'm.login.terms': getParams('m.login.terms'),
    'm.login.sso': getParams('m.login.sso'),
    'm.login.recaptcha': getParams('m.login.recaptcha'),
    'm.login.dummy': getParams('m.login.dummy'),
    'm.login.msisdn': getParams('m.login.msisdn'),
    'm.login.email.identity': getParams('m.login.email.identity')
  }
}

const sendSuccessResponse = (
  body: RegisterRequestBody,
  res: e.Response | ServerResponse,
  userId: string,
  accessToken: string,
  deviceId: string
): void => {
  if (body.inhibit_login) {
    send(res, 200, { user_id: userId })
  } else {
    if (!body.refresh_token) {
      send(res, 200, {
        access_token: accessToken,
        device_id: deviceId,
        user_id: userId,
        expires_in_ms: 60000 // Arbitrary value, should probably be defined in the server config
      })
    } else {
      // TODO : Implement this after implementing the /refresh endpoint
    }
  }
}
const createUser = (
  display_name: string,
  clientServer: MatrixClientServer,
  userId: string,
  accessToken: string,
  deviceId: string,
  ip: string,
  userAgent: string,
  body: RegisterRequestBody,
  res: e.Response | ServerResponse,
  kind: string,
  password?: string
): void => {
  if (typeof display_name !== 'string' || display_name.length > 512) {
    send(
      res,
      400,
      errMsg('invalidParam', 'Invalid initial_device_display_name')
    )
  }
  if (typeof deviceId !== 'string' || deviceId.length > 512) {
    send(res, 400, errMsg('invalidParam', 'Invalid device_id'))
  }
  const createUserPromise = (): Promise<DbGetResult> => {
    const commonUserData = {
      name: userId,
      creation_ts: epoch(),
      is_guest: kind === 'guest' ? 1 : 0,
      user_type: kind,
      shadow_banned: 0
    }

    if (password) {
      if (typeof password !== 'string' || password.length > 512) {
        send(res, 400, errMsg('invalidParam', 'Invalid password'))
      }
      const hash = new Hash()
      return hash.ready.then(() => {
        return clientServer.matrixDb.insert('users', {
          ...commonUserData,
          password_hash: hash.sha256(password) // TODO: Handle other hashing algorithms
        })
      })
    } else {
      return clientServer.matrixDb.insert('users', commonUserData)
    }
  }

  createUserPromise()
    .then((userPromise) => {
      const userIpPromise = clientServer.matrixDb.insert('user_ips', {
        user_id: userId,
        access_token: accessToken,
        device_id: deviceId,
        ip,
        user_agent: userAgent,
        last_seen: epoch()
      })
      const newDevicePromise = clientServer.matrixDb.insert('devices', {
        user_id: userId,
        device_id: deviceId,
        display_name,
        last_seen: epoch(),
        ip,
        user_agent: userAgent
      })
      const accessTokenPromise = clientServer.matrixDb.insert('access_tokens', {
        id: randomString(64), // To be fixed later
        user_id: userId,
        token: accessToken,
        device_id: deviceId,
        valid_until_ms: 0
      }) // TODO : Add a token_lifetime in the config, replace the id with a correct one, and fill the 'puppets_user_id' row with the right value
      return Promise.all([
        newDevicePromise,
        userPromise,
        userIpPromise,
        accessTokenPromise
      ])
    })
    .then(() => {
      sendSuccessResponse(body, res, userId, accessToken, deviceId)
    })
    .catch((e) => {
      // istanbul ignore next
      clientServer.logger.error('Error while registering a user', e)
      // istanbul ignore next
      send(res, 500, {
        error: 'Error while registering a user'
      })
    })
}

const register = (clientServer: MatrixClientServer): expressAppHandler => {
  if (!clientServer.conf.is_registration_enabled) {
    return (req, res) => {
      send(res, 404, { error: 'Registration is disabled' })
    }
  }
  return (req, res) => {
    // @ts-expect-error req.query exists
    const parameters = req.query as Parameters
    // @ts-expect-error req.headers exists
    let ip = req.headers['x-forwarded-for'] ?? req.ip
    ip = ip ?? 'undefined' // Same as user-agent, required in the DB schemas but not in the spec, so we set it to the string 'undefined' if it's not present
    const accessToken = randomString(64)
    const userAgent = req.headers['user-agent'] ?? 'undefined'
    if (parameters.kind === 'user') {
      clientServer.uiauthenticate(
        req,
        res,
        registerAllowedFlows,
        'register a new account',
        (obj) => {
          const body = obj as unknown as RegisterRequestBody
          const deviceId = body.device_id ?? randomString(20) // Length chosen arbitrarily
          const username = body.username ?? randomString(9) // Length chosen to match the localpart restrictions for a Matrix userId
          const userId = toMatrixId(username, clientServer.conf.server_name) // Checks for username validity are done in this function
          clientServer.matrixDb
            .get('users', ['name'], {
              name: userId
            })
            .then((rows) => {
              if (rows.length > 0) {
                send(res, 400, errMsg('userInUse'))
              } else {
                clientServer.matrixDb
                  .get('devices', ['display_name', 'user_id'], {
                    device_id: deviceId
                  })
                  .then((deviceRows) => {
                    let initial_device_display_name
                    if (deviceRows.length > 0) {
                      // TODO : Refresh access tokens using refresh tokens and invalidate the previous access_token associated with the device after implementing the /refresh endpoint
                    } else {
                      initial_device_display_name =
                        body.initial_device_display_name ?? randomString(20) // Length chosen arbitrarily
                      createUser(
                        initial_device_display_name,
                        clientServer,
                        userId,
                        accessToken,
                        deviceId,
                        ip,
                        userAgent,
                        body,
                        res,
                        'user',
                        body.password
                      )
                    }
                  })
                  .catch((e) => {
                    // istanbul ignore next
                    clientServer.logger.error(
                      'Error while checking if a device_id is already in use',
                      e
                    )
                    // istanbul ignore next
                    send(res, 500, e)
                  })
              }
            })
            .catch((e) => {
              // istanbul ignore next
              clientServer.logger.error(
                'Error while checking if a username is already in use',
                e
              )
              // istanbul ignore next
              send(res, 500, e)
            })
        }
      )
    } else {
      jsonContent(req, res, clientServer.logger, (obj) => {
        if (parameters.kind !== 'guest') {
          send(
            res,
            400,
            errMsg('invalidParam', 'Kind must be either "guest" or "user"')
          )
          return
        }
        const body = obj as unknown as RegisterRequestBody
        if (parameters.guest_access_token) {
          // Case where the guest user wants to upgrade his account : https://spec.matrix.org/v1.11/client-server-api/#guest-access
          if (!body.username) {
            clientServer.logger.error(
              'Username is required to upgrade a guest account'
            )
            send(res, 400, errMsg('missingParams'))
            return
          }
          const username = body.username
          const userId = toMatrixId(username, clientServer.conf.server_name)
          clientServer.matrixDb
            .get('access_tokens', ['user_id', 'device_id'], {
              token: parameters.guest_access_token
            })
            .then((rows) => {
              if (rows.length === 0) {
                clientServer.logger.error('Unknown guest access token')
                send(res, 401, errMsg('unknownToken'))
                return
              }
              const deviceId = body.device_id ?? (rows[0].device_id as string)
              const updateUsersPromise =
                clientServer.matrixDb.updateWithConditions(
                  'users',
                  { is_guest: 0, user_type: 'user', name: userId },
                  [{ field: 'name', value: rows[0].user_id as string }]
                )
              const updateUserIpsPromise =
                clientServer.matrixDb.updateWithConditions(
                  'user_ips',
                  { user_id: userId },
                  [
                    {
                      field: 'access_token',
                      value: parameters.guest_access_token as string
                    }
                  ]
                )
              const updateDevicePromise =
                clientServer.matrixDb.updateWithConditions(
                  'devices',
                  { user_id: userId, device_id: deviceId },
                  [{ field: 'user_id', value: rows[0].user_id as string }]
                )
              Promise.all([
                updateUsersPromise,
                updateUserIpsPromise,
                updateDevicePromise
              ])
                .then(() => {
                  sendSuccessResponse(body, res, userId, accessToken, deviceId)
                })
                .catch((e) => {
                  // istanbul ignore next
                  clientServer.logger.error(
                    "Error while updating guest's informations",
                    e
                  )
                  // istanbul ignore next
                  send(res, 500, e)
                })
            })
            .catch((e) => {
              // istanbul ignore next
              clientServer.logger.error(
                "Error while getting the guest's old user_id",
                e
              )
              // istanbul ignore next
              send(res, 500, e)
            })
        } else {
          const deviceId = randomString(20) // Length chosen arbitrarily
          const username = randomString(9) // Length chosen to match the localpart restrictions for a Matrix userId
          const initial_device_display_name = body.initial_device_display_name
            ? body.initial_device_display_name
            : randomString(20) // Length chosen arbitrarily
          createUser(
            initial_device_display_name,
            clientServer,
            toMatrixId(username, clientServer.conf.server_name),
            accessToken,
            deviceId,
            ip,
            userAgent,
            body,
            res,
            'guest'
          )
        }
      })
    }
  }
}

export default register
