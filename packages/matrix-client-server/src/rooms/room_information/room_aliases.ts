import type MatrixClientServer from '../../'
import { type Request } from 'express'
import { errMsg, send, type expressAppHandler } from '@twake/utils'

export const getRoomAliases = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    const roomId: string = (req as Request).params.roomId
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    clientServer.authenticate(req, res, async (data, id) => {
      const userId = data.sub

      try {
        // Check if the user has the rights to access the room aliases
        let accessible = false

        const historyResponse = await clientServer.matrixDb.get(
          'room_stats_state',
          ['history_visibility'],
          { room_id: roomId }
        )
        if (historyResponse.length === 0) {
          send(res, 400, errMsg('invalidParam', 'Invalid room id'))
          throw new Error('Invalid room id')
        }

        if (historyResponse[0]?.history_visibility === 'world_readable') {
          accessible = true
        } else {
          const membershipResponse = await clientServer.matrixDb.get(
            'local_current_membership',
            ['membership'],
            {
              room_id: roomId,
              user_id: userId
            }
          )
          if (
            membershipResponse.length > 0 &&
            membershipResponse[0].membership === 'join'
          ) {
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
            )
          )
          throw new Error(
            'The user is not permitted to retrieve the list of local aliases for the room'
          )
        } else {
          const aliasRows = await clientServer.matrixDb.get(
            'room_aliases',
            ['room_alias'],
            { room_id: roomId }
          )
          const roomAliases = aliasRows.map((row) => row.room_alias)
          send(res, 200, { room_aliases: roomAliases })
        }
      } catch (error) {
        clientServer.logger.error('Error retrieving room aliases:', error)
      }
    })
  }
}
