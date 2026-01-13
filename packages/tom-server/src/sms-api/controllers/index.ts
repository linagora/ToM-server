import { type Response, type NextFunction } from 'express'
import { type Config, type AuthRequest } from '../../types'
import { type ISmsService, type ISmsApiController } from '../types'
import SmsService from '../services'
import { type TwakeLogger } from '@twake-chat/logger'

export default class SmsApiController implements ISmsApiController {
  smsService: ISmsService

  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger,
    smsService?: ISmsService
  ) {
    this.smsService = smsService ?? new SmsService(this.config, this.logger)
  }

  /**
   * Sends an SMS to a single or multiple numbers.
   *
   * @param {Request} req - request object
   * @param {Response} res - response object
   * @param {NextFunction} next - next function
   * @returns {Promise<void>}
   */
  send = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { to: destination, text } = req.body

      if (destination === undefined || text === undefined) {
        throw new Error('missing data', {
          cause: 'missing required data'
        })
      }

      const to = Array.isArray(destination) ? destination : [destination]

      await this.smsService.send({ to, text })

      res.status(200).json({ message: 'SMS sent successfully' })
    } catch (error) {
      next(error)
    }
  }
}
