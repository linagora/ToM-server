import type MatrixClientServer from '../../'
import { type Request } from 'express'
import {
  errMsg,
  isRoomIdValid,
  send,
  type expressAppHandler
} from '@twake/utils'

export const getRoomAliases = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    const roomId: string = (req as Request).params.roomId
    if (!isRoomIdValid(roomId)) {
      send(res, 400, errMsg('invalidParam', 'Invalid room id'))
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    clientServer.authenticate(req, res, async (token) => {
      const userId = token.sub

      try {
        // Check the history visibility of the room
        const historyResponse = await clientServer.matrixDb.get(
          'room_stats_state',
          ['history_visibility'],
          { room_id: roomId }
        )

        if (historyResponse.length === 0) {
          send(
            res,
            400,
            errMsg('invalidParam', 'Invalid room id'),
            clientServer.logger
          )
          return
        }

        let accessible = false
        if (historyResponse[0].history_visibility === 'world_readable') {
          accessible = true
        } else {
          // Check if the user is a member of the room
          const membershipResponse = await clientServer.matrixDb.get(
            'room_memberships',
            ['event_id'],
            {
              room_id: roomId,
              user_id: userId,
              membership: 'join',
              forgotten: 0
            }
          )

          if (membershipResponse.length > 0) {
            accessible = true
          }
        }

        if (!accessible) {
          send(
            res,
            403,
            errMsg(
              'forbidden',
              'The user is not permitted to retrieve the list of local aliases for the room'
            ),
            clientServer.logger
          )
        } else {
          // Fetch the room aliases
          const aliasRows = await clientServer.matrixDb.get(
            'room_aliases',
            ['room_alias'],
            { room_id: roomId }
          )
          const roomAliases = aliasRows.map((row) => row.room_alias)
          send(res, 200, { aliases: roomAliases }, clientServer.logger)
        }
      } catch (e) {
        /* istanbul ignore next */
        send(res, 500, errMsg('unknown', e as string), clientServer.logger)
      }
    })
  }
}
