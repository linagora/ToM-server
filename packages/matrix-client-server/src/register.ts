/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import {
  jsonContent,
  errMsg,
  type expressAppHandler,
  send,
  epoch
} from '@twake/utils'
import { type AuthenticationData } from './types'
import { randomString } from '@twake/crypto'
import type MatrixClientServer from '.'

interface parameters {
  kind: 'guest' | 'user'
  guest_access_token?: string // If a guest wants to upgrade his account, from spec : https://spec.matrix.org/v1.11/client-server-api/#guest-access
}

interface registerRequestBody {
  auth: AuthenticationData
  device_id: string
  inhibit_login: boolean
  initial_device_display_name: string
  password: string
  refresh_token: boolean
  username: string
}

const localPartRe = /^[a-z0-9._=/+-]+$/

const register = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    // @ts-expect-error req.query exists
    const prms = req.query as parameters

    if (prms.kind === 'user') {
      clientServer.uiauthenticate(req, res, (obj) => {
        const body = obj as unknown as registerRequestBody
        // @ts-expect-error req.headers exists
        const ip = req.headers['x-forwarded-for'] ?? req.ip
        const accessToken = randomString(64)
        const userAgent = req.headers['user-agent']

        const deviceId = body.device_id ? body.device_id : randomString(20) // Length chosen arbitrarily
        const username = body.username ? body.username : randomString(9) // Length chosen to match the localpart restrictions for a Matrix userId
        const userId = `@${username}:${clientServer.conf.server_name}`

        if (!localPartRe.test(username)) {
          send(res, 400, errMsg('invalidUsername'))
          return
        }

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
                  const userPromise = clientServer.matrixDb.insert('users', {
                    name: userId,
                    creation_ts: epoch(),
                    is_guest: 0,
                    user_type: 'user',
                    shadow_banned: 0
                  })
                  const userIpPromise = clientServer.matrixDb.insert(
                    'user_ips',
                    {
                      user_id: userId,
                      access_token: accessToken,
                      device_id: deviceId,
                      ip,
                      user_agent: userAgent as string,
                      last_seen: epoch()
                    }
                  )
                  let initial_device_display_name
                  if (deviceRows.length > 0) {
                    // TODO : Refresh access tokens using refresh tokens and invalidate the previous access_token associated with the device
                  } else {
                    initial_device_display_name =
                      body.initial_device_display_name
                        ? body.initial_device_display_name
                        : randomString(20) // Length chosen arbitrarily
                    const newDevicePromise = clientServer.matrixDb.insert(
                      'devices',
                      {
                        user_id: userId,
                        device_id: deviceId,
                        display_name: initial_device_display_name,
                        last_seen: epoch(),
                        ip,
                        user_agent: userAgent as string
                      }
                    )
                    Promise.all([newDevicePromise, userPromise, userIpPromise])
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
                        clientServer.logger.error(
                          'Error while registering a user',
                          e
                        )
                        // istanbul ignore next
                        send(res, 500, {
                          error: 'Error while registering a user'
                        })
                      })
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
        // @ts-expect-error req.headers exists
        const ip = req.headers['x-forwarded-for'] ?? req.ip
        const accessToken = randomString(64)
        const userAgent = req.headers['user-agent']

        const deviceId = randomString(20) // Length chosen arbitrarily
        const username = randomString(9) // Length chosen to match the localpart restrictions for a Matrix userId

        const initial_device_display_name = body.initial_device_display_name
          ? body.initial_device_display_name
          : randomString(20) // Length chosen arbitrarily

        const devicePromise = clientServer.matrixDb.insert('devices', {
          user_id: `@${username}:${clientServer.conf.server_name}`,
          device_id: deviceId,
          display_name: initial_device_display_name,
          last_seen: epoch(),
          ip,
          user_agent: userAgent as string
        })

        const userPromise = clientServer.matrixDb.insert('users', {
          name: `@${username}:${clientServer.conf.server_name}`,
          creation_ts: epoch(),
          is_guest: 1,
          user_type: 'guest',
          shadow_banned: 0
        })

        const userIpPromise = clientServer.matrixDb.insert('user_ips', {
          user_id: `@${username}:${clientServer.conf.server_name}`,
          access_token: accessToken,
          device_id: deviceId,
          ip,
          user_agent: userAgent as string,
          last_seen: epoch()
        })

        Promise.all([devicePromise, userPromise, userIpPromise])
          .then(() => {
            if (body.inhibit_login) {
              send(res, 200, {
                user_id: `@${username}:${clientServer.conf.server_name}`
              })
            } else {
              send(res, 200, {
                access_token: accessToken,
                device_id: deviceId,
                user_id: `@${username}:${clientServer.conf.server_name}`,
                expires_in_ms: 60000 // Arbitrary value, should probably be defined in the server config
              })
            }
          })
          .catch((e) => {
            // istanbul ignore next
            clientServer.logger.error('Error while registering a guest', e)
            // istanbul ignore next
            send(res, 500, { error: 'Error while registering a guest' })
          })
      })
    }
  }
}

export default register
