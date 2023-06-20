import type { userDB } from '@twake/matrix-identity-server'
import type { IUserInfoService, IUserInfoController } from '../types'
import type { Response, NextFunction } from 'express'
import { type AuthRequest } from '../../types'
import UserInfoService from '../services'

class UserInfoController implements IUserInfoController {
  private readonly userInfoService: IUserInfoService

  constructor(private readonly userdb: userDB) {
    this.userInfoService = new UserInfoService(userdb)
  }

  /**
   * Fetches the user info for a given user id
   *
   * @param {AuthRequest} req the request object
   * @param {Response} res the response object
   * @param {NextFunction} next the next handler
   */
  get = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req.params

      const info = await this.userInfoService.get(userId)

      if (info === null) {
        res.status(404).json({ error: 'User not found' })
        return
      }

      res.status(200).json({ info })
    } catch (error) {
      next(error)
    }
  }
}

export default UserInfoController
