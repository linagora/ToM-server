import type MatrixClientServer from '../../'
import {
  send,
  type expressAppHandler,
  jsonContent,
  validateParameters
} from '@twake/utils'
import { type Request } from 'express'

export const getUserRoomTags = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    const userId = (req as Request).params.userId
    const roomId = (req as Request).params.roomId

    clientServer.authenticate(req, res, (data, id) => {
      clientServer.matrixDb
        .get('room_tags', ['tag', 'content'], {
          user_id: userId,
          room_id: roomId
        })
        .then((tagRows) => {
          const _tags: Record<string, { order?: number }> = {}
          tagRows.forEach((row) => {
            try {
              const content = JSON.parse(row.content as string)
              /* istanbul ignore else */
              if (content.order !== undefined) {
                _tags[row.tag as string] = { order: content.order }
              } else {
                _tags[row.tag as string] = {}
              }
            } catch (error) {
              /* istanbul ignore next */
              clientServer.logger.error(
                'Error parsing room tag content:',
                error
              )
            }
          })

          send(res, 200, { tags: _tags })
        })
        .catch((e) => {
          /* istanbul ignore next */
          clientServer.logger.error('Error querying room tags:', e)
        })
    })
  }
}

const schema = {
  order: true
}

export const addUserRoomTag = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    const userId = (req as Request).params.userId
    const roomId = (req as Request).params.roomId
    const _tag = (req as Request).params.tag

    clientServer.authenticate(req, res, (data, id) => {
      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(res, schema, obj, clientServer.logger, (obj) => {
          const order = obj as { order: number }
          clientServer.matrixDb
            .insert('room_tags', {
              user_id: userId,
              room_id: roomId,
              tag: _tag,
              content: JSON.stringify(order)
            })
            .then(() => {
              send(res, 200, {})
            })
            .catch((e) => {
              /* istanbul ignore next */
              clientServer.logger.error('Error inserting room tag:', e)
            })
        })
      })
    })
  }
}

export const removeUserRoomTag = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    const userId = (req as Request).params.userId
    const roomId = (req as Request).params.roomId
    const _tag = (req as Request).params.tag

    clientServer.authenticate(req, res, (data, id) => {
      clientServer.matrixDb
        .deleteWhere('room_tags', [
          { field: 'user_id', operator: '=', value: userId },
          { field: 'room_id', operator: '=', value: roomId },
          { field: 'tag', operator: '=', value: _tag }
        ])
        .then(() => {
          send(res, 200, {})
        })
        .catch((e) => {
          /* istanbul ignore next */
          clientServer.logger.error('Error deleting room tag:', e)
        })
    })
  }
}
