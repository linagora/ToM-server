import { TwakeLogger } from '@twake/logger'
import { Config } from '../../../../types'
import type { NextFunction, Request, Response } from 'express'

export default class CreateRoomMiddleware {
  constructor(config: Config, private readonly logger: TwakeLogger) {}

  public checkPayload = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const { body } = req

    if (!body) {
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
