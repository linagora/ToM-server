import {
  errMsg,
  type expressAppHandler,
  getAccessToken,
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
  Membership
} from '../types'
import type { ServerResponse } from 'http'
import type e from 'express'
import { isAdmin } from '../utils/utils'
import { SafeClientEvent } from '../utils/event'
import delete3pid from './3pid/delete'

interface ThreepidUnbindResponse {
  id_server_unbind_result: 'success' | 'no-support'
}
interface RequestBody {
  auth: AuthenticationData
  erase: boolean
  id_server: string
}

const requestBodyReference = {
  erase: 'boolean',
  id_server: 'string'
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
    deleteFromDirectory,
    deleteDirectorySearch,
    deletePublicRooms,
    deletePrivateRooms,
    deletePrivateRooms2
  ]
}

const deleteAllPushers = async (
  clientServer: MatrixClientServer,
  userId: string
): Promise<void> => {
  try {
    const pushers = await clientServer.matrixDb.get(
      'pushers',
      ['app_id', 'pushkey'],
      {
        user_id: userId
      }
    )

    await clientServer.matrixDb.deleteEqual('pushers', 'user_id', userId)

    const insertDeletedPushersPromises = pushers.map(
      async (pusher) =>
        await clientServer.matrixDb.insert('deleted_pushers', {
          stream_id: 0, // TODO: Update as needed
          instance_name: 'main', // TODO: This value may be changed
          app_id: pusher.app_id as string,
          pushkey: pusher.pushkey as string,
          user_id: userId
        })
    )

    await Promise.all(insertDeletedPushersPromises)
  } catch (e) {
    clientServer.logger.error('Error while handling pushers:', e)
    throw e
  }
}

const deleteAllRooms = async (
  clientServer: MatrixClientServer,
  userId: string,
  shouldErase: boolean = false
): Promise<void> => {
  try {
    const rooms = await clientServer.matrixDb.get(
      'current_state_events',
      ['room_id'],
      {
        state_key: userId,
        type: 'm.room.member', // TODO : Create EventTypes enum from the spec to prevent hardcoding strings
        membership: Membership.JOIN
      }
    )
    const deleteRoomsPromises = rooms.map(async (room) => {
      if (shouldErase) {
        // Delete the expiry timestamp associated with this event from the database.
        const membershipEventIds = await clientServer.matrixDb.get(
          'room_memberships',
          ['event_id'],
          { room_id: room.room_id, user_id: userId }
        )
        return membershipEventIds.map(async (membershipEventId) => {
          const event = await clientServer.matrixDb.get('events', ['*'], {
            event_id: membershipEventId.event_id
          })
          await clientServer.matrixDb.deleteEqual(
            'event_expiry',
            'event_id',
            membershipEventId.event_id as string
          )
          // Redact the event
          const safeEvent = new SafeClientEvent(event[0])
          safeEvent.redact()
          const redactedEvent = safeEvent.getEvent()
          // Update the event_json table with the redacted event
          await clientServer.matrixDb.updateWithConditions(
            'event_json',
            { json: JSON.stringify(redactedEvent.content) },
            [{ field: 'event_id', value: membershipEventId.event_id as string }]
          )
        })
      }
      //   return updateMembership(room, userId, Membership.LEAVE)
      // TODO : Replace this after implementing method to update room membership from the spec
      // https://spec.matrix.org/v1.11/client-server-api/#mroommember
      // or after implementing the endpoint '/_matrix/client/v3/rooms/{roomId}/leave'
    })
    await Promise.all(deleteRoomsPromises)
  } catch (e) {
    clientServer.logger.error('Error while deleting rooms:', e)
    throw e
  }
}

const rejectPendingInvitesAndKnocks = async (
  clientServer: MatrixClientServer,
  userId: string
): Promise<void> => {
  // TODO : Implement this after implementing endpoint '/_matrix/client/v3/rooms/{roomId}/leave' from the spec at : https://spec.matrix.org/v1.11/client-server-api/#post_matrixclientv3roomsroomidleave
}

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
    'user_id',
    userId
  )
  const deletePushRules = clientServer.matrixDb.deleteEqual(
    'push_rules',
    'user_id',
    userId
  )
  const deletePushRulesEnable = clientServer.matrixDb.deleteEqual(
    'push_rules_enable',
    'user_id',
    userId
  )
  const deletePushRulesStream = clientServer.matrixDb.deleteEqual(
    'push_rules_stream',
    'user_id',
    userId
  )
  return [
    deleteAccountData,
    deleteRoomAccountData,
    deleteIgnoredUsers,
    deletePushRules,
    deletePushRulesEnable,
    deletePushRulesStream
  ]
}

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
  // 1) Get all users 3pids and call the endpoint /delete to delete the bindings from the ID server and the 3pid associations from the homeserver
  clientServer.matrixDb
    .get('user_threepids', ['medium', 'address'], { user_id: userId })
    .then((rows) => {
      const threepidDeletePromises: Array<Promise<Response>> = []
      rows.forEach((row) => {
        threepidDeletePromises.push(
          // What if the user has 10000 3pids ? Will this get rate limited or create a bottleneck ? Should we do this sequentially or by batches ?
          delete3pid(clientServer)()
        )
      })
      const deleteDevicesPromise = clientServer.matrixDb.deleteWhere(
        'devices',
        [{ field: 'user_id', value: userId, operator: '=' }]
      )
      const deleteTokenPromise = clientServer.matrixDb.deleteWhere(
        'access_tokens',
        [{ field: 'user_id', value: userId, operator: '=' }]
      )
      const removePasswordPromise = clientServer.matrixDb.updateWithConditions(
        'users',
        { password_hash: null, deactivated: 1 },
        [{ field: 'id', value: userId }]
      )
      const deleteUserDirectoryPromises = deleteUserDirectory(
        clientServer,
        userId
      )
      const deleteAllPushersPromise = deleteAllPushers(clientServer, userId)
      // Synapse's implementation first populates the "user_pending_deactivation" table, parts the user from joined rooms then deletes the user from that table
      // Maybe this is because they have many workers and they want to prevent concurrent workers accessing the db at the same time
      // If that's the case then we can just directly deleteAllRooms at the same time as all other operations in Promise.all
      // And don't need to worry about the "user_pending_deactivation" and the order of operations
      // TODO : Check with Xavier
      const deleteAllRoomsPromise = deleteAllRooms(
        clientServer,
        userId,
        body.erase
      )
      const rejectPendingInvitesAndKnocksPromise =
        rejectPendingInvitesAndKnocks(clientServer, userId)
      const purgeAccountDataPromises = purgeAccountData(clientServer, userId)
      const deleteRoomKeysPromise = clientServer.matrixDb.deleteEqual(
        'e2e_room_keys',
        'user_id',
        userId
      )
      const deleteRoomKeysVersionsPromise = clientServer.matrixDb.deleteEqual(
        'e2e_room_keys_versions',
        'user_id',
        userId
      )
      const promisesToExecute = [
        ...threepidDeletePromises,
        deleteDevicesPromise,
        deleteTokenPromise,
        removePasswordPromise,
        deleteAllPushersPromise,
        deleteAllRoomsPromise,
        rejectPendingInvitesAndKnocksPromise,
        deleteRoomKeysPromise,
        deleteRoomKeysVersionsPromise,
        ...deleteUserDirectoryPromises,
        ...purgeAccountDataPromises
      ]
      if (body.erase) {
        allowed = clientServer.conf.capabilities.enable_set_avatar_url ?? true
        if (!byAdmin && !allowed) {
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
        promisesToExecute.push(
          clientServer.matrixDb.updateWithConditions(
            'profiles',
            { avatar_url: '', display_name: '' },
            [{ field: 'user_id', value: userId }]
          )
        )
        promisesToExecute.push(
          clientServer.matrixDb.insert('erased_users', { user_id: userId })
        )
      }
      if (clientServer.conf.capabilities.enable_account_validity ?? true) {
        // TODO : Add this in config after understanding what it does from Synapse's code
        promisesToExecute.push(
          clientServer.matrixDb.deleteEqual(
            'account_validity',
            'user_id',
            userId
          )
        )
      }
      Promise.all(promisesToExecute)
        .then(async (rows) => {
          // Synapse's implementation calls a callback function not specified in the spec before sending the response
          // eslint-disable-next-line @typescript-eslint/naming-convention
          let id_server_unbind_result = 'success'
          for (let i = 0; i < threepidDeletePromises.length; i++) {
            // Check if all threepids were successfully unbound from the associated id-servers
            const response = (await (
              rows[i] as Response
            ).json()) as ThreepidUnbindResponse
            if (response.id_server_unbind_result !== 'success') {
              id_server_unbind_result = 'no-support'
              break
            }
          }
          send(res, 200, { id_server_unbind_result })
        })
        .catch((e) => {
          // istanbul ignore next
          clientServer.logger.error('Error while deleting user 3pids')
          // istanbul ignore next
          send(res, 500, errMsg('unknown', e), clientServer.logger)
        })
    })
    .catch((e) => {
      // istanbul ignore next
      clientServer.logger.error('Error while getting user 3pids')
      // istanbul ignore next
      send(res, 500, errMsg('unknown', e), clientServer.logger)
    })
}

const deactivate = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    const token = getAccessToken(req)
    if (token != null) {
      clientServer.authenticate(req, res, (data: TokenContent) => {
        validateUserWithUIAuthentication(
          clientServer,
          req,
          res,
          requestBodyReference,
          data.sub,
          'deactivate your account',
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
              send(res, 500, errMsg('unknown', e), clientServer.logger)
            })
          }
        )
      })
    } else {
      clientServer.uiauthenticate(
        req,
        res,
        requestBodyReference,
        allowedFlows,
        'deactivate your account',
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
            send(res, 500, errMsg('unknown', e), clientServer.logger)
          })
        }
      )
    }
  }
}
export default deactivate
