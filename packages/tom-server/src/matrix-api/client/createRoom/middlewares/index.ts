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
      res.status(400).send('Missing body')
    }

    if (!body.name) {
      res.status(400).send('Missing name')
    }

    next()
  }
}
