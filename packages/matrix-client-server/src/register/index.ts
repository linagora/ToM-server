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
import { type AuthenticationData } from '../types'
import { Hash, randomString } from '@twake/crypto'
import type MatrixClientServer from '..'
import {
  type DbGetResult,
  getUrlsFromPolicies,
  computePolicy
} from '@twake/matrix-identity-server'
import type { ServerResponse } from 'http'
import type e from 'express'
import { getRegisterAllowedFlows } from '../utils/userInteractiveAuthentication'

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

interface InsertedData {
  name: string
  creation_ts: number
  is_guest: number
  shadow_banned: number
  user_type?: string
}
const setupPolicies = (
  userId: string,
  clientServer: MatrixClientServer,
  accepted: number
): Promise<DbGetResult[]> => {
  const promises: Array<Promise<DbGetResult>> = []
  Object.keys(
    getUrlsFromPolicies(computePolicy(clientServer.conf, clientServer.logger))
  ).forEach((policyName) => {
    promises.push(
      clientServer.db.insert('userPolicies', {
        policy_name: policyName,
        user_id: userId,
        accepted
      })
    )
  })
  return Promise.all(promises)
}

const sendSuccessResponse = (
  body: RegisterRequestBody,
  res: e.Response | ServerResponse,
  userId: string,
  accessToken: string,
  refreshToken: string,
  deviceId: string
): void => {
  if (body.inhibit_login) {
    send(res, 200, { user_id: userId })
  } else {
    if (body.refresh_token && typeof body.refresh_token !== 'boolean') {
      send(res, 400, errMsg('invalidParam', 'Refresh token must be a boolean'))
      return
    }
    if (!body.refresh_token) {
      // No point sending a refresh token to the client if it does not support it
      send(res, 200, {
        access_token: accessToken,
        device_id: deviceId,
        user_id: userId,
        expires_in_ms: 60000 // Arbitrary value, should probably be defined in the server config // TODO : Add this in the config
      })
    } else {
      send(res, 200, {
        access_token: accessToken,
        device_id: deviceId,
        user_id: userId,
        expires_in_ms: 60000, // Arbitrary value, should probably be defined in the server config // TODO : Add this in the config
        refresh_token: refreshToken
      })
    }
  }
}

const verifyParameters = (
  deviceId: string,
  device_display_name?: string,
  password?: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (
      password !== null &&
      password !== undefined &&
      (typeof password !== 'string' || password.length > 512)
    ) {
      reject(errMsg('invalidParam', 'Invalid password'))
    } else if (
      device_display_name !== null &&
      device_display_name !== undefined &&
      (typeof device_display_name !== 'string' ||
        device_display_name.length > 512)
    ) {
      reject(errMsg('invalidParam', 'Invalid initial_device_display_name'))
    } else if (typeof deviceId !== 'string' || deviceId.length > 512) {
      reject(errMsg('invalidParam', 'Invalid device_id'))
    } else {
      resolve()
    }
  })
}

// NB : It might be necessary to fill the "profiles" table with the displayname set as the username given in the request body
// We did not use it yet so we are not sure whether to fill it here or not
const registerAccount = (
  device_display_name: string,
  clientServer: MatrixClientServer,
  userId: string,
  deviceId: string,
  ip: string,
  userAgent: string,
  body: RegisterRequestBody,
  res: e.Response | ServerResponse,
  kind: string,
  password?: string,
  upgrade?: boolean
): void => {
  const accessToken = randomString(64)
  const refreshToken = randomString(64)
  const refreshTokenId = randomString(64)
  verifyParameters(deviceId, device_display_name, password)
    .then(() => {
      const createUserPromise = (): Promise<DbGetResult> => {
        const commonUserData: InsertedData = {
          name: userId,
          creation_ts: epoch(),
          is_guest: kind === 'guest' ? 1 : 0,
          shadow_banned: 0
        }
        if (kind === 'guest') {
          commonUserData.user_type = 'guest' // User type is NULL for normal users
        }
        if (password) {
          const hash = new Hash()
          return hash.ready.then(() => {
            return clientServer.matrixDb.insert('users', {
              ...commonUserData,
              password_hash: hash.sha256(password) // TODO: Handle other hashing algorithms
            })
          })
        } else {
          return clientServer.matrixDb.insert('users', { ...commonUserData })
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
            display_name: device_display_name,
            last_seen: epoch(),
            ip,
            user_agent: userAgent
          })
          const fillPoliciesPromise = setupPolicies(userId, clientServer, 0) // 0 means the user hasn't accepted the policies yet, used in Identity Server
          const refreshTokenPromise = clientServer.matrixDb.insert(
            'refresh_tokens',
            {
              id: refreshTokenId,
              user_id: userId,
              device_id: deviceId,
              token: refreshToken // TODO : maybe add expiry_ts here
            }
          )
          const accessTokenPromise = clientServer.matrixDb.insert(
            'access_tokens',
            {
              id: randomString(64), // To be fixed later
              user_id: userId,
              token: accessToken,
              device_id: deviceId,
              valid_until_ms: 0,
              refresh_token_id: refreshTokenId
            }
          ) // TODO : Add a token_lifetime in the config, replace the id with a correct one, and fill the 'puppets_user_id' row with the right value
          const promisesToExecute = body.inhibit_login
            ? [userIpPromise, userPromise, fillPoliciesPromise]
            : [
                userIpPromise,
                userPromise,
                fillPoliciesPromise,
                refreshTokenPromise,
                accessTokenPromise,
                newDevicePromise
              ]
          return Promise.all(promisesToExecute)
        })
        .then(() => {
          sendSuccessResponse(
            body,
            res,
            userId,
            accessToken,
            refreshToken,
            deviceId
          )
        })
        .catch((e) => {
          // istanbul ignore next
          clientServer.logger.error('Error while registering a user', e)
          // istanbul ignore next
          send(res, 500, {
            error: 'Error while registering a user'
          })
        })
    })
    .catch((e) => {
      send(res, 400, e, clientServer.logger)
    })
}

const upgradeGuest = (
  clientServer: MatrixClientServer,
  oldUserId: string,
  newUserId: string,
  accessToken: string,
  refreshTokenId: string,
  deviceId: string,
  body: RegisterRequestBody,
  res: e.Response | ServerResponse,
  password?: string
): void => {
  verifyParameters(deviceId)
    .then(() => {
      const commonUserData = {
        is_guest: 0,
        user_type: 'user',
        name: newUserId
      }
      const hash = new Hash()
      const updateUsersPromise = password
        ? hash.ready.then(() => {
            return clientServer.matrixDb.updateWithConditions(
              'users',
              {
                ...commonUserData,
                password_hash: hash.sha256(password) // TODO: Handle other hashing algorithms
              },
              [{ field: 'name', value: oldUserId }]
            )
          })
        : clientServer.matrixDb.updateWithConditions('users', commonUserData, [
            { field: 'name', value: oldUserId }
          ])

      const updateUserIpsPromise = clientServer.matrixDb.updateWithConditions(
        'user_ips',
        { user_id: newUserId },
        [
          {
            field: 'access_token',
            value: accessToken
          }
        ]
      )

      const updateDevicePromise = clientServer.matrixDb.updateWithConditions(
        'devices',
        { user_id: newUserId, device_id: deviceId },
        [{ field: 'user_id', value: oldUserId }]
      )

      const getRefreshTokenPromise = clientServer.matrixDb.get(
        'refresh_tokens',
        ['token'],
        { id: refreshTokenId }
      )
      Promise.all([
        getRefreshTokenPromise,
        updateUsersPromise,
        updateUserIpsPromise,
        updateDevicePromise
      ])
        .then((rows) => {
          sendSuccessResponse(
            body,
            res,
            newUserId,
            accessToken,
            rows[0][0].token as string,
            deviceId
          )
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
      send(res, 400, e, clientServer.logger)
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
    const userAgent = req.headers['user-agent'] ?? 'undefined'
    if (parameters.kind === 'user') {
      clientServer.uiauthenticate(
        req,
        res,
        getRegisterAllowedFlows(clientServer.conf),
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
                      registerAccount(
                        initial_device_display_name,
                        clientServer,
                        userId,
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
            .get(
              'access_tokens',
              ['user_id', 'device_id', 'refresh_token_id'],
              {
                token: parameters.guest_access_token
              }
            )
            .then((rows) => {
              if (rows.length === 0) {
                clientServer.logger.error('Unknown guest access token')
                send(res, 401, errMsg('unknownToken'))
                return
              }
              const deviceId = body.device_id ?? (rows[0].device_id as string)
              upgradeGuest(
                clientServer,
                rows[0].user_id as string,
                userId,
                parameters.guest_access_token as string,
                rows[0].refresh_token_id as string,
                deviceId,
                body,
                res,
                body.password
              )
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
          registerAccount(
            initial_device_display_name,
            clientServer,
            toMatrixId(username, clientServer.conf.server_name),
            deviceId,
            ip,
            userAgent,
            { initial_device_display_name }, // All parameters must be ignored for guest registration except for initial_device_display_name as per the spec
            res,
            'guest'
          )
        }
      })
    }
  }
}

export default register
