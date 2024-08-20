import type MatrixClientServer from '../..'
import { errMsg, send, type expressAppHandler } from '@twake/utils'
import { type RoomMember } from '../../types'

// TODO : Manage the case where it is an Application Service, in which case any of the AS’s users must be in the room for it to work.
// cf https://spec.matrix.org/v1.11/client-server-api/#get_matrixclientv3roomsroomidjoined_members

interface parameters {
  roomId: string
}

const GetJoinedMembers = (
  ClientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const roomId: string = ((req as Request).params as parameters).roomId
    ClientServer.authenticate(req, res, (data) => {
      // Check if the user has permission to retrieve this event
      const userId: string = data.sub
      ClientServer.matrixDb
        .get('local_current_membership', ['membership'], {
          user_id: userId,
          room_id: roomId
        })
        .then((rows) => {
          if (rows.length === 0 || rows[0].membership !== 'join') {
            send(
              res,
              403,
              errMsg(
                'notFound',
                'User not in the room - cannot retrieve members'
              ),
              ClientServer.logger
            )
            return
          }
          ClientServer.matrixDb
            .getJoin(
              ['local_current_membership', 'profiles'],
              [
                'profiles.user_id',
                'profiles.avatar_url',
                'profiles.displayname'
              ],
              {
                'local_current_membership.room_id': roomId,
                'local_current_membership.membership': 'join'
              },
              { 'local_current_membership.user_id': 'profiles.user_id' }
            )
            .then((rows) => {
              const joined: Record<string, RoomMember> = {}
              for (const row of rows) {
                joined[row.profiles_user_id as string] = {
                  avatar_url: row.profiles_avatar_url as string,
                  display_name: row.profiles_displayname as string
                }
              }
              send(res, 200, { joined })
            })
            .catch((err) => {
              /* istanbul ignore next */
              send(
                res,
                500,
                errMsg('unknown', err.toString()),
                ClientServer.logger
              )
            })
        })
        .catch((err) => {
          /* istanbul ignore next */
          send(res, 500, errMsg('unknown', err.toString()), ClientServer.logger)
        })
    })
  }
}

export default GetJoinedMembers
