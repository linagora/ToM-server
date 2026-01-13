import { type Config, type AuthRequest } from '../../../../types.ts'
import type { NextFunction, Response } from 'express'
import DisplayNameService from '../services/index.ts'
import { errCodes } from '@twake-chat/utils'
import { type TwakeLogger } from '@twake-chat/logger'

export default class DisplayNameController {
  private readonly displayNameService
  private readonly config: Config
  private readonly logger: TwakeLogger

  constructor(config: Config, logger: TwakeLogger) {
    this.config = config
    this.logger = logger
    // TODO: investigate unused config
    // this.displayNameService = new DisplayNameService(config, logger)
    this.displayNameService = new DisplayNameService(logger)
  }

  /**
   * Update the display name of a user
   *
   * @param {AuthRequest} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  updateDisplayName = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { authorization = undefined } = req.headers

      if (authorization == null) {
        res.status(400).json({
          errcode: errCodes.unAuthorized,
          error: 'Authorization header is required'
        })
        return
      }

      if (!this.config.features.matrix_profile_updates_allowed) {
        res.status(403).json({
          errcode: errCodes.forbidden,
          error: 'Profile fields are managed centrally via Common Settings'
        })
        return
      }

      const userId = req.userId ?? ''
      const paramUserId = req.params.userId
      if (paramUserId !== userId) {
        res.status(403).json({
          errcode: errCodes.forbidden,
          error:
            'You are not allowed to change the display name of another user'
        })
        return
      }
      if (userId.length === 0) {
        res.status(400).json({
          errcode: errCodes.invalidParam,
          error: 'Invalid user id'
        })
        return
      }

      const { displayname } = req.body ?? {}
      if (displayname == null || displayname.length === 0) {
        res.status(400).json({
          errcode: errCodes.missingParams,
          error: "Missing key 'displayname'"
        })
        return
      }

      const operation = await this.displayNameService.update(
        userId,
        displayname
      )

      if (!operation.ok) {
        const errorText = await operation.text()
        this.logger.error(
          `Failed to update display name for user ${userId}`,
          errorText
        )
        res.status(500).json({
          errcode: errCodes.unknown,
          error: 'Failed to update display name'
        })
        return
      }
      res.status(200).json({})
    } catch (error) {
      console.log({ error })
      next(error)
    }
  }
}
