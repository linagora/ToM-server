import { errMsg } from '@twake/matrix-identity-server'
import MatrixClientServer from '..'
import {
  send,
  type expressAppHandler
} from '@twake/matrix-identity-server/dist/utils'
import { type RoomMember } from '../types'

const GetJoinedMembers = (
  ClientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const roomId: string = (req as Request).params as string
    if (roomId?.length != null) {
      ClientServer.authenticate(req, res, (data, id) => {
        // Check if the user has permission to retrieve this event
        const userId = data.sub as string
        ClientServer.matrixDb
          .get('local_current_membership', ['user_id'], {
            user_id: userId,
            room_id: roomId
          })
          .then((rows) => {
            if (rows.length === 0 || rows[0].membership !== 'join') {
              send(
                res,
                404,
                errMsg(
                  'notFound',
                  'User not in the room - cannot retrieve members'
                )
              )
              return
            }
            ClientServer.matrixDb
              .get(
                'room_memberships',
                ['user_id', 'avatar_url', 'display_name'],
                {
                  room_id: roomId,
                  membership: 'join'
                }
              )
              .then((rows) => {
                const joined: { [key: string]: RoomMember } = {}
                for (const row of rows) {
                  joined[row.user_id as string] = {
                    avatar_url: row.avatar_url as string,
                    display_name: row.display_name as string
                  }
                }
                send(res, 200, { joined: joined })
              })
              .catch((err) => {
                /* istanbul ignore next */
                ClientServer.logger.error(err)
                /* istanbul ignore next */
                send(res, 500, errMsg('unknown', err))
              })
          })
          .catch((err) => {
            /* istanbul ignore next */
            ClientServer.logger.error(err)
            /* istanbul ignore next */
            send(res, 500, errMsg('unknown', err))
          })
      })
    } else {
      send(res, 400, errMsg('missingParams'))
    }
  }
}

export default GetJoinedMembers
