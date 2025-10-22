import { type Config, type AuthRequest, TwakeDB } from '../../../../types'
import type { NextFunction, Response } from 'express'
import ProfileService from '../services'
import { errCodes } from '@twake/utils'
import { type TwakeLogger } from '@twake/logger'

export default class DisplayNameController {
  private readonly logPrefix = '[matrix-api/client][ProfileController]'
  private readonly profileService
  private readonly config: Config
  private readonly logger: TwakeLogger

  constructor(config: Config, logger: TwakeLogger, db: TwakeDB) {
    this.config = config
    this.logger = logger
    this.profileService = new ProfileService(config, logger, db)
  }

  /**
   * Get the user profile
   *
   * @param {AuthRequest} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next handler
   */
  get = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { userId } = req.params
    const viewer = req.userId

    if (!viewer) {
      res.status(400).json({
        errcode: errCodes.unAuthorized,
        error: 'Authorization is required'
      })
      return
    }

    if (!userId) {
      res.status(400).json({
        errcode: errCodes.invalidParam,
        error: 'Missing userId parameter'
      })
      return
    }

    this.logger.debug(`${this.logPrefix} Fetching profile for ${userId}`)

    try {
      const profile = await this.profileService.get(userId, userId)

      res.status(200).json(profile)
    } catch (error: any) {
      this.logger.error(
        `${this.logPrefix} Failed to fetch profile for ${userId}:`,
        error
      )

      // Handle known errors gracefully
      if (error.message?.includes('401')) {
        res.status(401).json({
          errcode: errCodes.unAuthorized,
          error: 'Unauthorized to access Matrix profile'
        })
      } else if (error.message?.includes('404')) {
        res.status(404).json({
          errcode: errCodes.notFound,
          error: 'User profile not found'
        })
      } else {
        res.status(500).json({
          errcode: errCodes.internalError,
          error: 'Failed to fetch user profile'
        })
      }

      next(error)
    }
  }

  /**
   * Get the user displayname
   *
   * @param {AuthRequest} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next handler
   */
  getDisplayName = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { userId } = req.params
    const viewer = req.userId

    if (!viewer) {
      res.status(400).json({
        errcode: errCodes.unAuthorized,
        error: 'Authorization is required'
      })
      return
    }

    if (!userId) {
      res.status(400).json({
        errcode: errCodes.invalidParam,
        error: 'Missing userId parameter'
      })
      return
    }

    this.logger.debug(`${this.logPrefix} Fetching profile for ${userId}`)

    try {
      const profile = await this.profileService.getDisplayName(userId, userId)

      res.status(200).json(profile)
    } catch (error: any) {
      this.logger.error(
        `${this.logPrefix} Failed to fetch profile for ${userId}:`,
        error
      )

      // Handle known errors gracefully
      if (error.message?.includes('401')) {
        res.status(401).json({
          errcode: errCodes.unAuthorized,
          error: 'Unauthorized to access Matrix profile'
        })
      } else if (error.message?.includes('404')) {
        res.status(404).json({
          errcode: errCodes.notFound,
          error: 'User profile not found'
        })
      } else {
        res.status(500).json({
          errcode: errCodes.internalError,
          error: 'Failed to fetch user profile'
        })
      }

      next(error)
    }
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

      const operation = await this.profileService.updateDisplayName(userId, displayname)

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
