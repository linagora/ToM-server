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
      const { authorization = undefined } = req.headers

      if (!authorization) {
        res.status(400).json({ message: 'Authorization header is required' })
        return
      }

      const roomOwner = req.userId ?? ''

      if (roomOwner.length === 0) {
        this.logger.error(`Missing room owner`)
        res.status(400).json({ message: 'Missing room owner' })
        return
      }

      const operation = await this.roomService.create(
        req.body,
        authorization,
        roomOwner
      )
      const data = await operation.json()

      res.status(operation.status).json(data)
    } catch (error) {
      console.log({ error })
      this.logger.error(`Failed to create room`, error)

      next(error)
    }
  }
}
