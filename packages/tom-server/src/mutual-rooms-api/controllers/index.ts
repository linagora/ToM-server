import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../../types'
import type { IMutualRoomsApiController, IMutualRoomsService } from '../types'
import type { MatrixDBBackend } from '@twake/matrix-identity-server'
import MutualRoomsService from '../services'

export default class MutualRoomsApiController
  implements IMutualRoomsApiController
{
  mutualRoomsService: IMutualRoomsService

  constructor(private readonly db: MatrixDBBackend) {
    this.mutualRoomsService = new MutualRoomsService(db)
  }

  /**
   * Fetches the list of the mutual rooms of two users.
   *
   * the first user is the currently connected user.
   * the second user is the provided in the url params.
   *
   * @param {AuthRequest} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  get = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const connectedUserId = req.userId
      const targetUserId = req.params.id

      /* istanbul ignore if */
      if (connectedUserId === undefined || targetUserId === undefined) {
        throw new Error('Missing parameters')
      }

      const rooms = await this.mutualRoomsService.fetchMutualRooms(
        connectedUserId,
        targetUserId
      )

      res.status(200).json({ rooms })
    } catch (err) {
      next(err)
    }
  }
}
