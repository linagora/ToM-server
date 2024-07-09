import type MatrixClientServer from '../../index'
import { errMsg, send, type expressAppHandler } from '@twake/utils'

export const getJoinedRooms = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (token) => {
      const userId = token.sub
      clientServer.matrixDb
        .get('local_current_membership', ['room_id'], {
          user_id: userId,
          membership: 'join'
        })
        .then((roomsResult) => {
          const roomIds = roomsResult.map((row) => row.room_id) as string[]
          send(res, 200, { joined_rooms: roomIds })
        })
        .catch((e) => {
          /* istanbul ignore next */
          clientServer.logger.error('Error querying joined rooms:', e)
          /* istanbul ignore next */
          send(res, 500, errMsg('unknown', 'Error querying joined rooms'))
        })
    })
  }
}
