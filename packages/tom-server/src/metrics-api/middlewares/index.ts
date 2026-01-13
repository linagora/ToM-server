import { type MatrixDBBackend } from '@twake-chat/matrix-identity-server'
import { type AuthRequest } from '../../types.ts'
import { type NextFunction, type Response } from 'express'
import { type TwakeLogger } from '@twake-chat/logger'

export default class MetricsApiMiddleware {
  constructor(
    private readonly matrixDb: MatrixDBBackend,
    private readonly logger: TwakeLogger
  ) {}

  /**
   * Checks if the user is an admin
   *
   * @param {AuthRequest} req - request object
   * @param {Response} res - response object
   * @param {NextFunction} next - next function
   */
  checkPermissions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req

      if (userId === undefined) {
        throw new Error('Unauthenticated', {
          cause: 'userId is missing'
        })
      }

      const isAdmin = await this._checkAdmin(userId)

      if (!isAdmin) {
        this.logger.warn('User is not an admin', { userId })
        res.status(403).json({ message: 'Forbidden' })

        return
      }

      next()
    } catch (err) {
      res.status(400).json({ message: 'Bad Request' })
    }
  }

  /**
   * checks if the user is an admin
   *
   * @param {string} userId - the user id to check
   * @returns {Promise<boolean>} - true if the user is an admin, false otherwise
   */
  private readonly _checkAdmin = async (userId: string): Promise<boolean> => {
    try {
      const user = await this.matrixDb.get('users', ['name'], {
        name: userId,
        admin: 1
      })

      if (user.length === 0) {
        this.logger.warn('User is not an admin', { userId })

        return false
      }

      return true
    } catch (error) {
      this.logger.error('Failed to check if user is admin', { error })

      return false
    }
  }
}
