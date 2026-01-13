import type { MatrixDBBackend } from '@twake-chat/matrix-identity-server'
import type { IdeactivateUserMiddleware } from '../types'
import type { Request, Response, NextFunction } from 'express'
import type { Config } from '../../types'
import type { TwakeLogger } from '@twake-chat/logger'

export default class DeactivateUserMiddleware
  implements IdeactivateUserMiddleware
{
  constructor(
    private readonly config: Config,
    private readonly db: MatrixDBBackend,
    private readonly logger: TwakeLogger
  ) {}

  /**
   * Checks the access token
   *
   * @param {Request} req - the request
   * @param {Response} res - the response
   * @param {NextFunction} next - the next function
   */
  checkAccessToken = (req: Request, res: Response, next: NextFunction) => {
    const accessToken = req.headers?.['x-access-token']

    if (!accessToken || accessToken !== this.config.admin_access_token) {
      this.logger.error('Unauthorized: invalid or missing access_token')
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    next()
  }

  /**
   * Checks if the user exists
   *
   * @param {Request} req - the request
   * @param {Response} res - the response
   * @param {NextFunction} next - the next function
   */
  checkUserExists = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params?.id

    if (!userId) {
      this.logger.error('Missing user ID')
      res.status(400).json({ message: 'Missing user ID' })
      return
    }

    const erasedUserQueryResult = await this.db.get('erased_users', ['*'], {
      user_id: userId
    })

    if (erasedUserQueryResult.length) {
      this.logger.error('User is already marked as erased')
      res.status(400).json({ message: 'User is already erased' })
      return
    }

    const fetchUserQueryResult = await this.db.get('users', ['deactivated'], {
      name: userId
    })

    if (!fetchUserQueryResult.length) {
      this.logger.error('User not found')
      res.status(404).json({ message: 'User not found' })
      return
    }

    const user = fetchUserQueryResult[0]

    if (user.deactivated === 1) {
      this.logger.error('User is already deactivated')
      res.status(400).json({ message: 'User is already deactivated' })
      return
    }

    next()
  }
}
