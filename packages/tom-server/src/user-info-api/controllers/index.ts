import type { MatrixDB, UserDB } from '@twake/matrix-identity-server'
import type { IUserInfoService, IUserInfoController } from '../types'
import type { Response, NextFunction } from 'express'
import { type TwakeDB, type AuthRequest, type Config } from '../../types'
import UserInfoService from '../services'
import { errCodes } from '@twake/utils'

class UserInfoController implements IUserInfoController {
  private readonly userInfoService: IUserInfoService

  constructor(
    private readonly userdb: UserDB,
    private readonly db: TwakeDB,
    private readonly matrixDB: MatrixDB,
    private readonly config: Config
  ) {
    this.userInfoService = new UserInfoService(userdb, db, matrixDB, config)
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
      if (userId !== req.userId) {
        res.status(403).json({ error: errCodes.forbidden })
        return
      }

      const info = await this.userInfoService.get(userId)

      if (info === null) {
        res.status(404).json({ error: errCodes.notFound })
        return
      }

      res.status(200).json({ ...info })
    } catch (error) {
      next(error)
    }
  }
}

export default UserInfoController
