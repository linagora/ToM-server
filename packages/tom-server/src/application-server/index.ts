import { type ConfigDescription } from '@twake/config-parser'
import MatrixApplicationServer, {
  type AppService,
  type ClientEvent
} from '@twake/matrix-application-server'
import fetch from 'node-fetch'
import type TwakeServer from '..'
import defaultConfig from '../config.json'
import { TwakeRoom } from './models/room'
import { extendRoutes } from './routes'

export default class TwakeApplicationServer
  extends MatrixApplicationServer
  implements AppService
{
  constructor(parent: TwakeServer, confDesc?: ConfigDescription) {
    if (confDesc == null) confDesc = defaultConfig
    super(parent.conf, confDesc)
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
              const joinedRoomsIds = roomMemberships
                .filter(
                  (roomMembership) => roomMembership.membership === 'join'
                )
                .map((roomMembership) => roomMembership.room_id)

              return Promise.allSettled(
                rooms
                  .filter(
                    (room) =>
                      room.userDataMatchRoomFilter(user[0]) &&
                      !joinedRoomsIds.includes(room.id)
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
              console.error(e)
            })
        }
      }
    })
  }
}
