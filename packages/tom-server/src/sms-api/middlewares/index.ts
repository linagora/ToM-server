import { type Response, type NextFunction } from 'express'
import { type AuthRequest } from '../../types.ts'
import { type ISmsApiMiddleware } from '../types.ts'
import validator from 'validator'
import { type TwakeLogger } from '@twake-chat/logger'

export default class SmsApiMiddleware implements ISmsApiMiddleware {
  constructor(private readonly logger: TwakeLogger) {}
  /**
   * Check the SMS send requirements
   *
   * @param {AuthRequest} req - the request
   * @param {Response} res - the response
   * @param {NextFunction} next - the next function
   * @returns {void}
   */
  public checkSendRequirements = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      const { to, text } = req.body

      if (to === undefined || text === undefined || text.length === 0) {
        throw new Error('Missing destination or text')
      }

      next()
    } catch (error) {
      this.logger.debug('Missing destination or text', { error })
      res.status(400).json({ message: 'Bad Request' })
    }
  }

  /**
   * Validates the destination phone
   */
  public validateMobilePhone = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      const { to } = req.body

      const destinations: string[] = Array.isArray(to) ? to : [to]

      destinations.forEach((destination: string) => {
        if (!validator.isMobilePhone(destination)) {
          throw new Error('Invalid destination phone', {
            cause: `Invalid phone ${destination}`
          })
        }
      })

      next()
    } catch (error) {
      this.logger.debug('Invalid phone number provided', { error })
      res.status(400).json({ message: 'Invalid phone number' })
    }
  }
}
