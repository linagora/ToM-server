import type { TwakeLogger } from '@twake/logger'
import type { IAdminService, IDeactivateUserController } from '../types'
import type { Config } from '../../types'
import type { NextFunction, Response, Request } from 'express'
import AdminService from '../services'

export default class DeactivateUserController
  implements IDeactivateUserController
{
  private adminService: IAdminService

  constructor(
    config: Config,
    private readonly logger: TwakeLogger
  ) {
    this.adminService = new AdminService(config, logger)
  }

  /**
   * Handles the request to deactivate a user
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
      const userId = req.params.id

      if (!userId) {
        res.status(400).json({ message: 'Missing user ID' })
        return
      }

      await this.adminService.removeAccount(userId)

      res.status(200).json({ message: 'User deactivated' })
    } catch (error) {
      this.logger.error(`Failed to handle request`, { error })
      next(error)
    }
  }
}
