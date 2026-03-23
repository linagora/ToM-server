import type { TwakeLogger } from '@twake/logger'
import type { IAdminSettingsController, IAdminSettingsService } from '../types'
import type { Config, ITokenService } from '../../types'
import type { NextFunction, Response, Request } from 'express'
import AdminSettingsService from '../services'

export default class AdminSettingsrController
  implements IAdminSettingsController
{
  private readonly adminService: IAdminSettingsService

  constructor(
    config: Config,
    private readonly logger: TwakeLogger,
    tokenService?: ITokenService
  ) {
    this.adminService = new AdminSettingsService(config, logger, tokenService)
  }

  /**
   * Handles the request to update a user profile
   *
   * @param {Request} req - The request object
   * @param {Response} res - The response object
   * @param {NextFunction} next - The next function
   * @returns {Promise<void>}
   */
  public handle = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id: userId } = req.params
      const updatePayload = req.body

      // Validate that the user ID is present
      if (userId.length === 0) {
        res.status(400).json({ message: 'Missing user ID' })
        return
      }

      // Validate that at least one of the fields to update is present
      if (
        updatePayload.displayName === undefined &&
        updatePayload.avatarUrl === undefined
      ) {
        res.status(400).json({ message: 'No valid fields to update' })
        return
      }

      await this.adminService.updateUserInformation(userId, updatePayload)
      res.status(200).json({})
    } catch (error) {
      this.logger.error(`Failed to handle request`, { error })
      next(error)
    }
  }
}
