import type { MatrixDBBackend } from '@twake/matrix-identity-server'
import type { IRoomTagsMiddleware } from '../types'
import type { Response, NextFunction } from 'express'
import type { IdentityServerDb, AuthRequest } from '../../types'
import { isMemberOfRoom, userRoomTagExists } from '../utils'

class RoomTagsMiddleware implements IRoomTagsMiddleware {
  constructor(
    private readonly idDb: IdentityServerDb,
    private readonly matrixDb: MatrixDBBackend
  ) {}

  /**
   * Checks if a user can fetch tags for a given room.
   *
   * @param {AuthRequest} req - the request
   * @param {Response} res - the response
   * @param {NextFunction} next - the next handler
   */
  checkFetchRequirements = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req
      const { roomId } = req.params

      if (roomId === undefined) {
        throw new Error('roomId is required')
      }

      if (userId === undefined) {
        throw new Error('user_id is required')
      }
      if (await isMemberOfRoom(this.matrixDb, userId, roomId)) {
        next()
        return
      }

      res.status(403).json({ error: 'user is not a member of this room' })
      return
    } catch (error) {
      res.status(400).json({ message: 'Bad Request', error })
    }
  }

  /**
   * Checks if a user can create a tag for a given room.
   *
   * @param {AuthRequest} req - the request
   * @param {Response} res - the response
   * @param {NextFunction} next - the next handler
   */
  checkCreateRequirements = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req
      const tags = req.body

      if (userId === undefined) {
        throw new Error('user_id is required')
      }

      if (tags === undefined || typeof tags !== 'object') {
        throw new Error('tags is required')
      }
      const { roomId, content } = tags

      if (roomId === undefined || !Array.isArray(content)) {
        throw new Error('invalid data')
      }

      if (content.some((tag) => typeof tag !== 'string')) {
        throw new Error('invalid tags')
      }

      if (await userRoomTagExists(this.idDb, userId, roomId)) {
        throw new Error('user already has a tag for this room')
      }

      if (await isMemberOfRoom(this.matrixDb, userId, roomId)) {
        next()
        return
      }

      res.status(403).json({ error: 'user is not a member of this room' })
      return
    } catch (error) {
      res.status(400).json({ message: 'Bad Request', error })
    }
  }

  /**
   * Checks if a user can update his tag for a given room.
   *
   * @param {AuthRequest} req - the request
   * @param {Response} res - the response
   * @param {NextFunction} next - the next handler
   */
  checkUpdateRequirements = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { roomId } = req.params
      const { userId } = req
      const { content } = req.body

      if (roomId === undefined) {
        throw new Error('roomId is required')
      }

      if (userId === undefined) {
        throw new Error('user_id is required')
      }

      if (
        !Array.isArray(content) ||
        content.some((tag) => typeof tag !== 'string')
      ) {
        throw new Error('invalid data')
      }

      if (!(await isMemberOfRoom(this.matrixDb, userId, roomId))) {
        res.status(403).json({ error: 'user is not a member of this room' })
        return
      }

      if (!(await userRoomTagExists(this.idDb, userId, roomId))) {
        throw new Error('user tag for this room does not exist')
      }

      next()
      return
    } catch (error) {
      res.status(400).json({ message: 'Bad Request', error })
    }
  }

  /**
   * Check if the user can delete his tag for a given room.
   *
   * @param {AuthRequest} req - the request
   * @param {Response} res - the response
   * @param {NextFunction} next - the next handler
   * @returns
   */
  checkDeleteRequirements = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { roomId } = req.params
      const { userId } = req

      if (roomId === undefined) {
        throw new Error('roomId is required')
      }

      if (userId === undefined) {
        throw new Error('user_id is required')
      }

      if (!(await userRoomTagExists(this.idDb, userId, roomId))) {
        throw new Error('user tag for this room does not exist')
      }

      next()
      return
    } catch (error) {
      res.status(400).json({ message: 'Bad Request', error })
    }
  }
}

export default RoomTagsMiddleware
