import type { TwakeLogger } from '@twake/logger'
import type { IAdminSettingsController, IAdminSettingsService } from '../types'
import type { Config } from '../../types'
import type { NextFunction, Response, Request } from 'express'
import AdminService from '../services'

export default class AdminSettingsrController
  implements IAdminSettingsController
{
  private readonly adminService: IAdminSettingsService

  constructor(config: Config, private readonly logger: TwakeLogger) {
    this.adminService = new AdminService(config, logger)
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
      const { displayName, avatarUrl } = req.body
      if (userId.length === 0 || displayName.length === 0) {
        res.status(400).json({ message: 'Missing user ID or display name' })
        return
      }
      await this.adminService.updateUserInformation(userId, {
        displayName,
        avatarUrl
      })
      res.status(200).json({})
    } catch (error) {
      this.logger.error(`Failed to handle request`, { error })
      next(error)
    }
  }
}
