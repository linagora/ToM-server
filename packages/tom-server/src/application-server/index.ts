import { type ConfigDescription } from '@twake/config-parser'
import { type TwakeLogger } from '@twake/logger'
import MatrixApplicationServer, {
  type AppService,
  type ClientEvent
} from '@twake/matrix-application-server'
import { type DbGetResult } from '@twake/matrix-identity-server'
import lodash from 'lodash'
import fetch from 'node-fetch'
import type TwakeServer from '..'
import defaultConfig from '../config.json'
import { TwakeRoom } from './models/room'
import { extendRoutes } from './routes'
const { groupBy } = lodash

export default class TwakeApplicationServer
  extends MatrixApplicationServer
  implements AppService
{
  constructor(
    parent: TwakeServer,
    confDesc?: ConfigDescription,
    logger?: TwakeLogger
  ) {
    if (confDesc == null) confDesc = defaultConfig
    super(parent.conf, confDesc, logger)
    extendRoutes(this, parent)

    this.on('ephemeral_type: m.presence', (event: ClientEvent) => {
      if (
        event.type === 'm.presence' &&
        'presence' in event.content &&
        event.content.presence === 'online'
      ) {
        const matrixUserId = event.sender
        let ldapUid: string | null = null
        if (matrixUserId != null) {
          const match = matrixUserId.match(/@([^:]+)/)
          if (match != null) {
            ldapUid = match[1]
          }
        }
        if (matrixUserId != null && ldapUid != null && parent.db != null) {
          Promise.all([
            parent.idServer.userDB.get('users', undefined, {
              [parent.conf.ldap_uid_field as string]: ldapUid
            }),
            TwakeRoom.getAllRooms(parent.db),
            parent.matrixDb.get('room_memberships', ['room_id'], {
              user_id: matrixUserId
            })
          ])
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            .then(([user, rooms, roomMemberships]) => {
              if (user.length !== 1) {
                throw new Error(
                  `User with ${parent.conf.ldap_uid_field as string} ${
                    ldapUid as string
                  } not found`
                )
              }

              const membershipsByRoomId = groupBy(
                roomMemberships,
                'room_id'
              ) as Record<string, DbGetResult>

              const forbiddenRooms = Object.keys(membershipsByRoomId)
                .map(
                  (key) =>
                    membershipsByRoomId[key].pop() as Record<
                      string,
                      string | number | Array<string | number>
                    >
                )
                .filter(
                  (membership) =>
                    membership.membership === 'join' ||
                    (membership.membership === 'leave' &&
                      membership.sender !== matrixUserId) ||
                    membership.membership === 'ban'
                )
                .map((membership) => membership.room_id as string)

              return Promise.allSettled(
                rooms
                  .filter(
                    (room) =>
                      room.userDataMatchRoomFilter(user[0]) &&
                      !forbiddenRooms.includes(room.id)
                  )
                  // eslint-disable-next-line @typescript-eslint/promise-function-async
                  .map((room) => {
                    return fetch(
                      encodeURI(
                        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                        `https://${parent.conf.matrix_server}/_matrix/client/v3/join/${room.id}?user_id=${matrixUserId}`
                      ),
                      {
                        method: 'POST',
                        headers: {
                          Authorization: `Bearer ${this.appServiceRegistration.asToken}`
                        }
                      }
                    )
                  })
              )
            })
            .catch((e) => {
              this.logger.error(e)
            })
        }
      }
    })

    this.on('state event | type: m.room.member', (event: ClientEvent) => {
      if (
        event.type === 'm.room.member' &&
        'membership' in event.content &&
        event.content.membership === 'leave'
      ) {
        const matrixUserId = event.sender
        const targetUserId = event.state_key
        if (
          matrixUserId != null &&
          targetUserId != null &&
          targetUserId === matrixUserId
        ) {
          fetch(
            encodeURI(
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              `https://${parent.conf.matrix_server}/_matrix/client/v3/join/${event.room_id}?user_id=${matrixUserId}`
            ),
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${this.appServiceRegistration.asToken}`
              }
            }
          ).catch((e) => {
            // istanbul ignore next
            this.logger.error(e)
          })
        }
      }
    })
  }
}
