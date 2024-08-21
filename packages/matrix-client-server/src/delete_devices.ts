/* eslint-disable @typescript-eslint/promise-function-async */
import { errMsg, jsonContent, send, type expressAppHandler } from '@twake/utils'
import type MatrixClientServer from '.'
import { validateUserWithUIAuthentication } from './utils/userInteractiveAuthentication'
import { type AuthenticationData } from './types'
import { randomString } from '@twake/crypto'
import pLimit from 'p-limit'
import { verifyArray, verifyAuthenticationData } from './typecheckers'

interface RequestBody {
  auth?: AuthenticationData
  devices: string[]
}
const maxPromisesToExecuteConcurrently = 10
const limit = pLimit(maxPromisesToExecuteConcurrently)

const deleteDevices = (
  clientServer: MatrixClientServer,
  devices: string[]
): Array<Promise<void>> => {
  const devicePromises: Array<Promise<void>> = []
  for (const deviceId of devices) {
    devicePromises.push(
      limit(() =>
        clientServer.matrixDb.deleteWhere('devices', [
          { field: 'device_id', value: deviceId, operator: '=' }
        ])
      )
    )
    devicePromises.push(
      limit(() =>
        clientServer.matrixDb.deleteWhere('device_auth_providers', [
          { field: 'device_id', value: deviceId, operator: '=' }
        ])
      )
    )
    devicePromises.push(
      limit(() =>
        clientServer.matrixDb.deleteWhere('e2e_device_keys_json', [
          { field: 'device_id', value: deviceId, operator: '=' }
        ])
      )
    )
    devicePromises.push(
      limit(() =>
        clientServer.matrixDb.deleteWhere('e2e_one_time_keys_json', [
          { field: 'device_id', value: deviceId, operator: '=' }
        ])
      )
    )
    devicePromises.push(
      limit(() =>
        clientServer.matrixDb.deleteWhere('dehydrated_devices', [
          { field: 'device_id', value: deviceId, operator: '=' }
        ])
      )
    )
    devicePromises.push(
      limit(() =>
        clientServer.matrixDb.deleteWhere('e2e_fallback_keys_json', [
          { field: 'device_id', value: deviceId, operator: '=' }
        ])
      )
    )
  }
  return devicePromises
}

const deletePushers = async (
  clientServer: MatrixClientServer,
  devices: string[],
  userId: string
): Promise<Array<Promise<void>>> => {
  let insertDeletedPushersPromises: Array<Promise<void>> = []
  for (const deviceId of devices) {
    const deviceDisplayNameRow = await clientServer.matrixDb.get(
      'devices',
      ['display_name'],
      { device_id: deviceId }
    )
    if (deviceDisplayNameRow.length === 0) {
      continue
    }
    const pushers = await clientServer.matrixDb.get(
      'pushers',
      ['app_id', 'pushkey'],
      {
        user_id: userId,
        device_display_name: deviceDisplayNameRow[0].display_name
      }
    )
    await clientServer.matrixDb.deleteWhere(
      // We'd like to delete by device_id but there is no device_id field in the pushers table
      'pushers',
      [
        {
          field: 'device_display_name',
          value: deviceDisplayNameRow[0].display_name as string,
          operator: '='
        },
        { field: 'user_id', value: userId, operator: '=' }
      ]
    )
    insertDeletedPushersPromises = pushers.map(async (pusher) => {
      await limit(() =>
        clientServer.matrixDb.insert('deleted_pushers', {
          stream_id: randomString(64), // TODO: Update when stream ordering is implemented since the stream_id has to keep track of the order of operations
          app_id: pusher.app_id as string,
          pushkey: pusher.pushkey as string,
          user_id: userId
        })
      )
    })
  }
  return insertDeletedPushersPromises
}

const deleteTokens = (
  clientServer: MatrixClientServer,
  devices: string[],
  userId: string
): Array<Promise<void>> => {
  const deleteTokensPromises: Array<Promise<void>> = []
  for (const deviceId of devices) {
    deleteTokensPromises.push(
      limit(() =>
        clientServer.matrixDb.deleteWhere('access_tokens', [
          { field: 'user_id', value: userId, operator: '=' },
          { field: 'device_id', value: deviceId, operator: '=' }
        ])
      )
    )
    deleteTokensPromises.push(
      limit(() =>
        clientServer.matrixDb.deleteWhere('refresh_tokens', [
          { field: 'user_id', value: userId, operator: '=' },
          { field: 'device_id', value: deviceId, operator: '=' }
        ])
      )
    )
  }
  return deleteTokensPromises
}

export const deleteDevicesData = async (
  clientServer: MatrixClientServer,
  devices: string[],
  userId: string
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
): Promise<void[]> => {
  // Delete access tokens
  const deleteTokensPromises = deleteTokens(clientServer, devices, userId)
  // Delete devices
  const deleteDevicesPromises = deleteDevices(clientServer, devices)
  // Refer to MSC3890
  // Delete device messages by batches // Why by batches ? Should code a new SQL method to delete by batch if we need to do so
  // Remove pushers
  const deletePushersPromises = await deletePushers(
    clientServer,
    devices,
    userId
  )
  return await Promise.all([
    ...deleteTokensPromises,
    ...deleteDevicesPromises,
    ...deletePushersPromises
  ])
}

const deleteDevicesHandler = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (data) => {
      jsonContent(req, res, clientServer.logger, (obj) => {
        const body = obj as unknown as RequestBody
        if (
          !verifyArray(body.devices, 'string') ||
          (body.auth != null &&
            body.auth !== undefined &&
            !verifyAuthenticationData(body.auth))
        ) {
          send(
            res,
            400,
            errMsg('invalidParam', 'devices must be an array of strings')
          )
          return
        }
        validateUserWithUIAuthentication(
          clientServer,
          req,
          res,
          data.sub,
          'remove device(s) from your account',
          obj,
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          (obj, userId) => {
            deleteDevicesData(
              clientServer,
              (obj as RequestBody).devices,
              userId as string
            )
              .then(() => {
                send(res, 200, {})
              })
              .catch((e) => {
                clientServer.logger.error(`Unable to delete devices`, e)
                send(
                  res,
                  500,
                  errMsg('unknown', e.toString()),
                  clientServer.logger
                )
              })
          }
        )
      })
    })
  }
}

export default deleteDevicesHandler
