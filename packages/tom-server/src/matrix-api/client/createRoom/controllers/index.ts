import { TwakeLogger } from '@twake/logger'
import { AuthRequest, Config } from '../../../../types'
import type { NextFunction, Response } from 'express'
import RoomService from '../services'

export default class CreateRoomController {
  private roomService

  constructor(config: Config, private readonly logger: TwakeLogger) {
    this.roomService = new RoomService(config, logger)
  }

  /**
   * Creates a room
   *
   * @param {AuthRequest} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  createRoom = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { authorization } = req.headers

      if (!authorization) {
        res.status(400).json({ message: 'Authorization header is required' })
        return
      }

      return this.roomService.create(req.body, authorization)
    } catch (error) {
      this.logger.error(`Failed to create room`, error)

      next(error)
    }
  }
}
