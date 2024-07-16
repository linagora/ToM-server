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
import { randomString } from '@twake/crypto'
import type MatrixClientServer from '..'
import { type DbGetResult } from '@twake/matrix-identity-server'
import type { ServerResponse } from 'http'
import type e from 'express'
import { registerAllowedFlows } from '../utils/userInteractiveAuthentication'

interface Parameters {
  kind: 'guest' | 'user'
  guest_access_token?: string // If a guest wants to upgrade his account, from spec : https://spec.matrix.org/v1.11/client-server-api/#guest-access
}

interface registerRequestBody {
  auth?: AuthenticationData
  device_id?: string
  inhibit_login?: boolean
  initial_device_display_name?: string
  password?: string
  refresh_token?: boolean
  username?: string
}

const createUser = (
  otherPromise: Promise<DbGetResult>,
  clientServer: MatrixClientServer,
  userId: string,
  accessToken: string,
  deviceId: string,
  ip: string,
  userAgent: string,
  body: registerRequestBody,
  res: e.Response | ServerResponse,
  kind: string
): void => {
  const userPromise = clientServer.matrixDb.insert('users', {
    name: userId,
    creation_ts: epoch(),
    is_guest: kind === 'guest' ? 1 : 0,
    user_type: kind,
    shadow_banned: 0
  })
  const userIpPromise = clientServer.matrixDb.insert('user_ips', {
    user_id: userId,
    access_token: accessToken,
    device_id: deviceId,
    ip,
    user_agent: userAgent,
    last_seen: epoch()
  })
  Promise.all([otherPromise, userPromise, userIpPromise])
    .then(() => {
      if (body.inhibit_login) {
        send(res, 200, { user_id: userId })
      } else {
        send(res, 200, {
          access_token: accessToken,
          device_id: deviceId,
          user_id: userId,
          expires_in_ms: 60000 // Arbitrary value, should probably be defined in the server config
        })
      }
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
      clientServer.uiauthenticate(req, res, registerAllowedFlows, (obj) => {
        const body = obj as unknown as registerRequestBody
        const deviceId = body.device_id ?? randomString(20) // Length chosen arbitrarily
        const username = body.username ?? randomString(9) // Length chosen to match the localpart restrictions for a Matrix userId
        const userId = toMatrixId(username, clientServer.conf.server_name)
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
                    // TODO : Refresh access tokens using refresh tokens and invalidate the previous access_token associated with the device after implementing the /refresh
                  } else {
                    initial_device_display_name =
                      body.initial_device_display_name ?? randomString(20) // Length chosen arbitrarily
                    const newDevicePromise = clientServer.matrixDb.insert(
                      'devices',
                      {
                        user_id: userId,
                        device_id: deviceId,
                        display_name: initial_device_display_name,
                        last_seen: epoch(),
                        ip,
                        user_agent: userAgent
                      }
                    )
                    createUser(
                      newDevicePromise,
                      clientServer,
                      userId,
                      accessToken,
                      deviceId,
                      ip,
                      userAgent,
                      body,
                      res,
                      'user'
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
      })
    } else {
      jsonContent(req, res, clientServer.logger, (obj) => {
        const body = obj as unknown as registerRequestBody
        const deviceId = randomString(20) // Length chosen arbitrarily
        const username = randomString(9) // Length chosen to match the localpart restrictions for a Matrix userId
        const initial_device_display_name = body.initial_device_display_name
          ? body.initial_device_display_name
          : randomString(20) // Length chosen arbitrarily

        const devicePromise = clientServer.matrixDb.insert('devices', {
          user_id: toMatrixId(username, clientServer.conf.server_name),
          device_id: deviceId,
          display_name: initial_device_display_name,
          last_seen: epoch(),
          ip,
          user_agent: userAgent
        })
        createUser(
          devicePromise,
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
      })
    }
  }
}

export default register
