/* eslint-disable @typescript-eslint/promise-function-async */
import {
  errMsg,
  type expressAppHandler,
  getAccessToken,
  jsonContent,
  send
} from '@twake/utils'
import type MatrixClientServer from '..'
import { type TokenContent } from '../utils/authenticate'
import {
  getParams,
  validateUserWithUIAuthentication
} from '../utils/userInteractiveAuthentication'
import {
  type AuthenticationFlowContent,
  type AuthenticationData,
  Membership,
  RoomEventTypes,
  type ClientEvent
} from '../types'
import type { ServerResponse } from 'http'
import type e from 'express'
import { isAdmin } from '../utils/utils'
import { SafeClientEvent } from '../utils/event'
import { delete3pid, type DeleteResponse } from './3pid/delete'
import { randomString } from '@twake/crypto'
import pLimit from 'p-limit'
import {
  verifyAuthenticationData,
  verifyBoolean,
  verifyString
} from '../typecheckers'

const maxPromisesToExecuteConcurrently = 10
const limit = pLimit(maxPromisesToExecuteConcurrently)

interface RequestBody {
  auth?: AuthenticationData
  erase?: boolean
  id_server?: string
}

const allowedFlows: AuthenticationFlowContent = {
  // Those can be changed. Synapse's implementation only includes m.login.email.identity but
  // I think it's relevant to also include m.login.msisdn and m.login.password
  flows: [
    {
      stages: ['m.login.email.identity']
    },
    {
      stages: ['m.login.msisdn']
    },
    {
      stages: ['m.login.password']
    }
  ],
  params: {
    'm.login.email.identity': getParams('m.login.email.identity'),
    'm.login.msisdn': getParams('m.login.msisdn'),
    'm.login.password': getParams('m.login.password')
  }
}

// We return an array of promises wrapped in a limiter so that at most maxPromisesToExecuteConcurrently promises are executed
// at the same time in the promise.all in realMethod
const deleteUserDirectory = (
  clientServer: MatrixClientServer,
  userId: string
): Array<Promise<void>> => {
  const deleteFromDirectory = clientServer.matrixDb.deleteEqual(
    'user_directory',
    'user_id',
    userId
  )
  const deleteDirectorySearch = clientServer.matrixDb.deleteEqual(
    'user_directory_search',
    'user_id',
    userId
  )
  const deletePublicRooms = clientServer.matrixDb.deleteEqual(
    'users_in_public_rooms',
    'user_id',
    userId
  )
  const deletePrivateRooms = clientServer.matrixDb.deleteEqual(
    'users_who_share_private_rooms',
    'user_id',
    userId
  )
  const deletePrivateRooms2 = clientServer.matrixDb.deleteEqual(
    'users_who_share_private_rooms',
    'other_user_id',
    userId
  )
  return [
    limit(() => deleteFromDirectory),
    limit(() => deleteDirectorySearch),
    limit(() => deletePublicRooms),
    limit(() => deletePrivateRooms),
    limit(() => deletePrivateRooms2)
  ]
}

// We return an array of promises wrapped in a limiter so that at most maxPromisesToExecuteConcurrently promises are executed
// at the same time in the promise.all in realMethod
const deleteAllPushers = async (
  clientServer: MatrixClientServer,
  userId: string
): Promise<Array<Promise<void>>> => {
  const pushers = await clientServer.matrixDb.get(
    'pushers',
    ['app_id', 'pushkey'],
    {
      user_name: userId
    }
  )

  await clientServer.matrixDb.deleteEqual('pushers', 'user_name', userId)

  const insertDeletedPushersPromises = pushers.map(async (pusher) => {
    await limit(() =>
      clientServer.matrixDb.insert('deleted_pushers', {
        stream_id: randomString(64), // TODO: Update when stream ordering is implemented since the stream_id has to keep track of the order of operations
        app_id: pusher.app_id as string,
        pushkey: pusher.pushkey as string,
        user_id: userId
      })
    )
  })

  return insertDeletedPushersPromises
}

// We return an array of promises wrapped in a limiter so that at most maxPromisesToExecuteConcurrently promises are executed
// at the same time in the promise.all in realMethod
const deleteAllRooms = async (
  clientServer: MatrixClientServer,
  userId: string,
  shouldErase: boolean = false
): Promise<Array<Promise<void>>> => {
  const rooms = await clientServer.matrixDb.get(
    'current_state_events',
    ['room_id'],
    {
      state_key: userId,
      type: RoomEventTypes.Member,
      membership: Membership.JOIN
    }
  )
  const deleteRoomsPromises: Array<Promise<void>> = []
  for (const room of rooms) {
    if (shouldErase) {
      // Delete the expiry timestamp associated with this event from the database.
      const membershipEventIds = await clientServer.matrixDb.get(
        'room_memberships',
        ['event_id'],
        { room_id: room.room_id, user_id: userId }
      )

      membershipEventIds.forEach((membershipEventId) => {
        deleteRoomsPromises.push(
          limit(async () => {
            const eventRows = await clientServer.matrixDb.get('events', ['*'], {
              event_id: membershipEventId.event_id
            })
            if (eventRows.length === 0) {
              // istanbul ignore next
              throw new Error('Event not found')
            }
            await clientServer.matrixDb.deleteEqual(
              'event_expiry',
              'event_id',
              membershipEventId.event_id as string
            )
            // Redact the Event
            // I added default values for the fields that don't have the NOT NULL constraint in the db but are required in the event object
            const event: ClientEvent = {
              content:
                eventRows[0].content !== null &&
                eventRows[0].content !== undefined
                  ? JSON.parse(eventRows[0].content as string)
                  : {},
              event_id: eventRows[0].event_id as string,
              origin_server_ts:
                eventRows[0].origin_server_ts !== null &&
                eventRows[0].origin_server_ts !== undefined
                  ? (eventRows[0].origin_server_ts as number)
                  : 0, // TODO : Discuss default value
              room_id: eventRows[0].room_id as string,
              sender:
                eventRows[0] !== null && eventRows[0] !== undefined
                  ? (eventRows[0].sender as string)
                  : '', // TODO : Discuss default value
              state_key: eventRows[0].state_key as string,
              type: eventRows[0].type as string,
              unsigned:
                eventRows[0].unsigned !== null &&
                eventRows[0].unsigned !== undefined
                  ? JSON.parse(eventRows[0].unsigned as string)
                  : undefined
            }
            const safeEvent = new SafeClientEvent(event)
            safeEvent.redact()
            const redactedEvent = safeEvent.getEvent()
            // Update the event_json table with the redacted event
            await clientServer.matrixDb.updateWithConditions(
              'event_json',
              { json: JSON.stringify(redactedEvent.content) },
              [
                {
                  field: 'event_id',
                  value: membershipEventId.event_id as string
                }
              ]
            )
          })
        )
      })
    }
    //   await updateMembership(room, userId, Membership.LEAVE)
    // TODO : Replace this after implementing method to update room membership from the spec
    // https://spec.matrix.org/v1.11/client-server-api/#mroommember
    // or after implementing the endpoint '/_matrix/client/v3/rooms/{roomId}/leave'
  }
  return deleteRoomsPromises
}

const rejectPendingInvitesAndKnocks = async (
  clientServer: MatrixClientServer,
  userId: string
): Promise<void> => {
  // TODO : Implement this after implementing endpoint '/_matrix/client/v3/rooms/{roomId}/leave' from the spec at : https://spec.matrix.org/v1.11/client-server-api/#post_matrixclientv3roomsroomidleave
}

// We return an array of promises wrapped in a limiter so that at most maxPromisesToExecuteConcurrently promises are executed
// at the same time in the promise.all in realMethod
const purgeAccountData = (
  clientServer: MatrixClientServer,
  userId: string
): Array<Promise<void>> => {
  const deleteAccountData = clientServer.matrixDb.deleteEqual(
    'account_data',
    'user_id',
    userId
  )
  const deleteRoomAccountData = clientServer.matrixDb.deleteEqual(
    'room_account_data',
    'user_id',
    userId
  )
  // We have never used all below tables in other endpoints as of yet, so these promises are useless for now, but we can keep them for future use
  // As they are present in Synapse's implementation
  const deleteIgnoredUsers = clientServer.matrixDb.deleteEqual(
    'ignored_users',
    'ignorer_user_id',
    userId
  ) // We only delete the users that were ignored by the deactivated user, so that when the user is reactivated he is still ignored by the users who wanted to ignore him.
  const deletePushRules = clientServer.matrixDb.deleteEqual(
    'push_rules',
    'user_name',
    userId
  )
  const deletePushRulesEnable = clientServer.matrixDb.deleteEqual(
    'push_rules_enable',
    'user_name',
    userId
  )
  const deletePushRulesStream = clientServer.matrixDb.deleteEqual(
    'push_rules_stream',
    'user_id',
    userId
  )
  return [
    limit(() => deleteAccountData),
    limit(() => deleteRoomAccountData),
    limit(() => deleteIgnoredUsers),
    limit(() => deletePushRules),
    limit(() => deletePushRulesEnable),
    limit(() => deletePushRulesStream)
  ]
}

const deleteDevices = (
  clientServer: MatrixClientServer,
  userId: string
): Array<Promise<void>> => {
  const deleteDevicesPromise = limit(() =>
    clientServer.matrixDb.deleteWhere('devices', [
      { field: 'user_id', value: userId, operator: '=' }
    ])
  )
  const deleteDevicesAuthProvidersPromise = limit(() =>
    clientServer.matrixDb.deleteWhere('device_auth_providers', [
      { field: 'user_id', value: userId, operator: '=' }
    ])
  )
  const deleteEndToEndDeviceKeys = limit(() =>
    clientServer.matrixDb.deleteWhere('e2e_device_keys_json', [
      { field: 'user_id', value: userId, operator: '=' }
    ])
  )
  const deleteEndToEndOneTimeKeys = limit(() =>
    clientServer.matrixDb.deleteWhere('e2e_one_time_keys_json', [
      { field: 'user_id', value: userId, operator: '=' }
    ])
  )
  const deleteDehydratedDevices = limit(() =>
    clientServer.matrixDb.deleteWhere('dehydrated_devices', [
      { field: 'user_id', value: userId, operator: '=' }
    ])
  )
  const deleteEndToEndFallbackKeys = limit(() =>
    clientServer.matrixDb.deleteWhere('e2e_fallback_keys_json', [
      { field: 'user_id', value: userId, operator: '=' }
    ])
  )
  return [
    deleteDevicesPromise,
    deleteDevicesAuthProvidersPromise,
    deleteEndToEndDeviceKeys,
    deleteEndToEndOneTimeKeys,
    deleteDehydratedDevices,
    deleteEndToEndFallbackKeys
  ]
}
// Main method to deactivate the account. Uses several submethods to delete the user's data from multiple places in the database.
// Some of those submethods are yet to be implemented as they would require implementing other endpoints from the spec
// We don't remove the user from the user_ips table here since Synapse don't do it. Maybe this is intentional but it isn't removed elsewhere
// Even though we fill this table in the /register endpoint
const realMethod = async (
  res: e.Response | ServerResponse,
  clientServer: MatrixClientServer,
  body: RequestBody,
  userId: string
): Promise<void> => {
  const byAdmin = await isAdmin(clientServer, userId)
  let allowed = clientServer.conf.capabilities.enable_3pid_changes ?? true
  if (!byAdmin && !allowed) {
    send(
      res,
      403,
      errMsg('forbidden', 'Cannot add 3pid as it is not allowed by server'),
      clientServer.logger
    )
    return
  }
  allowed = clientServer.conf.capabilities.enable_set_avatar_url ?? true
  if ((body.erase ?? false) && !byAdmin && !allowed) {
    send(
      res,
      403,
      errMsg(
        'forbidden',
        'Cannot erase account as it is not allowed by server'
      ),
      clientServer.logger
    )
    return
  }
  const threepidRows = await clientServer.matrixDb.get(
    'user_threepids',
    ['medium', 'address'],
    { user_id: userId }
  )

  const threepidDeletePromises: Array<Promise<DeleteResponse>> = []
  threepidRows.forEach((row) => {
    threepidDeletePromises.push(
      limit(() =>
        delete3pid(
          row.address as string,
          row.medium as string,
          clientServer,
          userId,
          body.id_server
        )
      )
    )
  })
  const deleteDevicesPromises = deleteDevices(clientServer, userId)
  const deleteAccessTokensPromise = limit(() =>
    clientServer.matrixDb.deleteWhere('access_tokens', [
      { field: 'user_id', value: userId, operator: '=' }
    ])
  )
  const deleteRefreshTokensPromise = limit(() =>
    clientServer.matrixDb.deleteWhere('refresh_tokens', [
      { field: 'user_id', value: userId, operator: '=' }
    ])
  )
  const removePasswordPromise = limit(() =>
    clientServer.matrixDb.updateWithConditions(
      'users',
      { password_hash: null },
      [{ field: 'name', value: userId }]
    )
  )
  const deleteUserDirectoryPromises = deleteUserDirectory(clientServer, userId)
  const deleteAllPushersPromises = await deleteAllPushers(clientServer, userId)
  // Synapse's implementation first populates the "user_pending_deactivation" table, parts the user from joined rooms then deletes the user from that table
  // Maybe this is because they have many workers and they want to prevent concurrent workers accessing the db at the same time
  // If that's the case then we can just directly deleteAllRooms at the same time as all other operations in Promise.all
  // And don't need to worry about the "user_pending_deactivation" and the order of operations
  const deleteAllRoomsPromise = await deleteAllRooms(
    clientServer,
    userId,
    body.erase
  )
  const rejectPendingInvitesAndKnocksPromise = rejectPendingInvitesAndKnocks(
    clientServer,
    userId
  )
  const purgeAccountDataPromises = purgeAccountData(clientServer, userId)
  const deleteRoomKeysPromise = limit(() =>
    clientServer.matrixDb.deleteEqual('e2e_room_keys', 'user_id', userId)
  )
  const deleteRoomKeysVersionsPromise = limit(() =>
    clientServer.matrixDb.deleteEqual(
      'e2e_room_keys_versions',
      'user_id',
      userId
    )
  )

  const promisesToExecute = [
    ...threepidDeletePromises, // We put the threepid delete promises first so that we can check if all threepids were successfully unbound from the associated id-servers
    ...deleteDevicesPromises,
    deleteAccessTokensPromise,
    deleteRefreshTokensPromise,
    removePasswordPromise,
    rejectPendingInvitesAndKnocksPromise,
    deleteRoomKeysPromise,
    deleteRoomKeysVersionsPromise,
    ...deleteAllRoomsPromise,
    ...deleteAllPushersPromises,
    ...deleteUserDirectoryPromises,
    ...purgeAccountDataPromises
  ]
  if (body.erase ?? false) {
    promisesToExecute.push(
      limit(() =>
        clientServer.matrixDb.updateWithConditions(
          'profiles',
          { avatar_url: '', displayname: '' },
          [{ field: 'user_id', value: userId }]
        )
      )
    )
    promisesToExecute.push(
      limit(() =>
        clientServer.matrixDb.insert('erased_users', { user_id: userId })
      )
    )
  }
  // This is not present in the spec but is present in Synapse's implementation so I included it for more flexibility
  if (clientServer.conf.capabilities.enable_account_validity ?? true) {
    promisesToExecute.push(
      limit(() =>
        clientServer.matrixDb.deleteEqual('account_validity', 'user_id', userId)
      )
    )
  }
  Promise.all(promisesToExecute)
    .then(async (rows) => {
      // Synapse's implementation calls a callback function not specified in the spec before sending the response. I didn't include it here since it is not in the spec
      // eslint-disable-next-line @typescript-eslint/naming-convention
      let id_server_unbind_result = 'success'
      for (let i = 0; i < threepidDeletePromises.length; i++) {
        // Check if all threepids were successfully unbound from the associated id-servers
        const success = (rows[i] as DeleteResponse).success
        if (!success) {
          id_server_unbind_result = 'no-support'
          break
        }
      }
      // Mark the user deactivated after all operations are successful
      await clientServer.matrixDb.updateWithConditions(
        'users',
        { deactivated: 1 },
        [{ field: 'name', value: userId }]
      )
      send(res, 200, { id_server_unbind_result })
    })
    .catch((e) => {
      // istanbul ignore next
      clientServer.logger.error('Error while deleting user 3pids')
      // istanbul ignore next
      send(res, 500, errMsg('unknown', e.toString()), clientServer.logger)
    })
}

// There should be a method to reactivate the account to match this one but it isn't implemented yet
const deactivate = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    jsonContent(req, res, clientServer.logger, (obj) => {
      const body = obj as unknown as RequestBody
      if (
        body.auth !== null &&
        body.auth !== undefined &&
        !verifyAuthenticationData(body.auth)
      ) {
        clientServer.logger.error('Invalid auth')
        send(res, 400, errMsg('invalidParam'), clientServer.logger)
        return
      } else if (
        body.id_server !== null ||
        body.id_server !== undefined ||
        !verifyString(body.id_server)
      ) {
        clientServer.logger.error('Invalid id_server')
        send(res, 400, errMsg('invalidParam'), clientServer.logger)
        return
      } else if (
        body.erase !== null &&
        body.erase !== undefined &&
        !verifyBoolean(body.erase)
      ) {
        clientServer.logger.error('Invalid erase')
        send(res, 400, errMsg('invalidParam'), clientServer.logger)
        return
      }
      const token = getAccessToken(req)
      if (token != null) {
        clientServer.authenticate(req, res, (data: TokenContent) => {
          validateUserWithUIAuthentication(
            clientServer,
            req,
            res,
            data.sub,
            'deactivate your account',
            obj,
            (obj, userId) => {
              realMethod(
                res,
                clientServer,
                obj as RequestBody,
                userId as string
              ).catch((e) => {
                // istanbul ignore next
                clientServer.logger.error('Error while deactivating account')
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
      } else {
        clientServer.uiauthenticate(
          req,
          res,
          allowedFlows,
          'deactivate your account',
          obj,
          (obj, userId) => {
            realMethod(
              res,
              clientServer,
              obj as RequestBody,
              userId as string
            ).catch((e) => {
              // istanbul ignore next
              clientServer.logger.error('Error while changing password')
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
      }
    })
  }
}
export default deactivate
