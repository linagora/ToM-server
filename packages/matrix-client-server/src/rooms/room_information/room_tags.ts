/*
 * This file defines handlers for managing room tags in the Matrix client-server API :
 * https://spec.matrix.org/v1.11/client-server-api/#client-behaviour-15
 * It includes three main functions:
 *
 * 1. `getUserRoomTags`: Retrieves tags associated with a user's room.
 *
 * 2. `addUserRoomTag`: Adds a new tag to a user's room.
 *
 * 3. `removeUserRoomTag`: Removes a tag from a user's room.
 *
 * The only part that is not specified in the Matrix Protocol is the access control logic.
 * Following Synapse's implementation, we will allow a user to view, add, and remove their tags only.
 *
 * For now, it remains possible to add tags to a room you are not part of.
 *
 * Maximum lengths:
 * - `room_tag`: 255 characters
 */

import type MatrixClientServer from '../../'
import {
  errMsg,
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

    // Check if userId and roomId are valid
    const userIdRegex = /^@[a-zA-Z0-9._=-]+:[a-zA-Z0-9.-]+$/
    const roomIdRegex = /^![a-zA-Z0-9]+:[a-zA-Z0-9.-]+$/

    if (!userIdRegex.test(userId)) {
      send(res, 400, errMsg('invalidParam', 'Invalid userId'))
      return
    }
    if (!roomIdRegex.test(roomId)) {
      send(res, 400, errMsg('invalidParam', 'Invalid roomId'))
      return
    }

    clientServer.authenticate(req, res, (token) => {
      const requesterUserId = token.sub

      if (requesterUserId !== userId) {
        send(
          res,
          403,
          errMsg('forbidden', 'You are not allowed to view these tags')
        )
        return
      }

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
              send(
                res,
                500,
                errMsg('unknown', 'Error parsing room tag content'),
                clientServer.logger
              )
            }
          })
          send(res, 200, { tags: _tags }, clientServer.logger)
        })
        .catch((e) => {
          /* istanbul ignore next */
          send(
            res,
            500,
            errMsg('unknown', 'Error querying room tags'),
            clientServer.logger
          )
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

    // Check if userId and roomId are valid
    const userIdRegex = /^@[a-zA-Z0-9._=-]+:[a-zA-Z0-9.-]+$/
    const roomIdRegex = /^![a-zA-Z0-9]+:[a-zA-Z0-9.-]+$/

    if (!userIdRegex.test(userId)) {
      send(res, 400, errMsg('invalidParam', 'Invalid userId'))
      return
    }
    if (!roomIdRegex.test(roomId)) {
      send(res, 400, errMsg('invalidParam', 'Invalid roomId'))
      return
    }
    if (_tag.length > 255) {
      send(
        res,
        400,
        errMsg('invalidParam', 'The tag must be less than 255 characters')
      )
      return
    }

    clientServer.authenticate(req, res, (token) => {
      const requesterUserId = token.sub
      if (requesterUserId !== userId) {
        send(res, 403, errMsg('forbidden', 'You are not allowed to add tags'))
        return
      }

      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(res, schema, obj, clientServer.logger, (obj) => {
          const order = obj as { order: number }
          if (typeof order.order !== 'number' || order.order <= 0) {
            send(
              res,
              400,
              errMsg('invalidParam', 'The order must be greater than 0')
            )
            return
          }
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
              /* istanbul ignore next */
              send(res, 500, errMsg('unknown', 'Error inserting room tag'))
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

    // Check if userId and roomId are valid
    const userIdRegex = /^@[a-zA-Z0-9._=-]+:[a-zA-Z0-9.-]+$/
    const roomIdRegex = /^![a-zA-Z0-9]+:[a-zA-Z0-9.-]+$/

    if (!userIdRegex.test(userId)) {
      send(res, 400, errMsg('invalidParam', 'Invalid userId'))
      return
    }
    if (!roomIdRegex.test(roomId)) {
      send(res, 400, errMsg('invalidParam', 'Invalid roomId'))
      return
    }

    clientServer.authenticate(req, res, (token) => {
      const requesterUserId = token.sub
      if (requesterUserId !== userId) {
        send(
          res,
          403,
          errMsg('forbidden', 'You are not allowed to remove tags')
        )
        return
      }

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
          /* istanbul ignore next */
          send(res, 500, errMsg('unknown', 'Error deleting room tag'))
        })
    })
  }
}
