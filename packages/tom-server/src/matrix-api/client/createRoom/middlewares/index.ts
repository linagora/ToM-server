import { TwakeLogger } from '@twake/logger'
import type { NextFunction, Request, Response } from 'express'

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
      JSON.parse(JSON.stringify(body))
    } catch (error) {
      this.logger.error('Invalid JSON', error)
      res.status(400).send('Invalid JSON')
      return
    }

    next()
  }
}
