/* eslint-disable @typescript-eslint/promise-function-async */
import { errMsg, jsonContent, send, type expressAppHandler } from '@twake/utils'
import type MatrixClientServer from '.'
import { validateUserWithUIAuthentication } from './utils/userInteractiveAuthentication'
import { type AuthenticationData } from './types'
import { randomString } from '@twake/crypto'
import pLimit from 'p-limit'
import { verifyArray, verifyAuthenticationData } from './typecheckers'

const MESSAGES_TO_DELETE_BATCH_SIZE = 10

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
    // istanbul ignore if
    if (deviceDisplayNameRow.length === 0) {
      // Since device_display_name has the NOT NULL constraint, we assume that if the device has no display name it has no associated pushers
      // Ideally there should be a device_id field in the pushers table to delete by device_id
      continue
    }
    const pushers = await clientServer.matrixDb.get(
      'pushers',
      ['app_id', 'pushkey'],
      {
        user_name: userId,
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
        { field: 'user_name', value: userId, operator: '=' }
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

export const deleteMessagesBetweenStreamIds = async (
  clientServer: MatrixClientServer,
  userId: string,
  deviceId: string,
  fromStreamId: number,
  upToStreamId: number,
  limit: number
): Promise<number> => {
  const maxStreamId = await clientServer.matrixDb.getMaxStreamId(
    userId,
    deviceId,
    fromStreamId,
    upToStreamId,
    limit
  )
  if (maxStreamId === null) {
    return 0
  }
  await clientServer.matrixDb.deleteWhere('device_inbox', [
    { field: 'user_id', value: userId, operator: '=' },
    { field: 'device_id', value: deviceId, operator: '=' },
    { field: 'stream_id', value: maxStreamId, operator: '<=' },
    { field: 'stream_id', value: fromStreamId, operator: '>' }
  ])
  return maxStreamId
}
const deleteDeviceInbox = async (
  clientServer: MatrixClientServer,
  userId: string,
  deviceId: string,
  upToStreamId: number
): Promise<void> => {
  let fromStreamId = 0
  while (true) {
    // Maybe add a counter to prevent infinite loops if the deletion process is broken
    const maxStreamId = await deleteMessagesBetweenStreamIds(
      clientServer,
      userId,
      deviceId,
      fromStreamId,
      upToStreamId,
      MESSAGES_TO_DELETE_BATCH_SIZE
    )
    if (maxStreamId === 0) {
      break
    }
    fromStreamId = maxStreamId
  }
}

export const deleteDevicesData = async (
  clientServer: MatrixClientServer,
  devices: string[],
  userId: string
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
): Promise<void[]> => {
  // In Synapse's implementation, they also delete account data relative to local notification settings according to this MR : https://github.com/matrix-org/matrix-spec-proposals/pull/3890
  // I did not include it since it is not in the spec
  const deleteTokensPromises = deleteTokens(clientServer, devices, userId)
  const deleteDevicesPromises = deleteDevices(clientServer, devices)
  const deletePushersPromises = await deletePushers(
    clientServer,
    devices,
    userId
  )
  const deleteDeviceInboxPromises = devices.map((deviceId) => {
    return limit(() => deleteDeviceInbox(clientServer, userId, deviceId, 1000)) // TODO : Fix the upToStreamId when stream ordering is implemented. It should be set to avoid deleting non delivered messages
  })
  return await Promise.all([
    ...deleteTokensPromises,
    ...deleteDevicesPromises,
    ...deletePushersPromises,
    ...deleteDeviceInboxPromises
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
          body.auth != null &&
          body.auth !== undefined &&
          !verifyAuthenticationData(body.auth)
        ) {
          send(res, 400, errMsg('invalidParam', 'Invalid auth'))
          return
        } else if (!verifyArray(body.devices, 'string')) {
          send(res, 400, errMsg('invalidParam', 'Invalid devices'))
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
                // istanbul ignore next
                clientServer.logger.error(`Unable to delete devices`, e)
                // istanbul ignore next
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
