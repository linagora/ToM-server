import { type TwakeLogger } from '@twake/logger'
import type { NextFunction, Request, Response } from 'express'
import validator from 'validator'
export default class CreateRoomMiddleware {
  constructor(private readonly logger: TwakeLogger) {}

  public checkPayload = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const { body } = req

    if (!body || !Object.keys(body).length) {
      this.logger.error('Missing body')
      res.status(400).send('Missing body')
      return
    }

    try {
      if (!validator.isJSON(JSON.stringify(body))) {
        throw Error('Invalid JSON')
      }
    } catch (error) {
      this.logger.error('Invalid JSON', error)
      res.status(400).send('Invalid JSON')
      return
    }

    next()
  }
}
