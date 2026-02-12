import { TwakeLogger } from '@twake/logger'
import type { NextFunction, Request, Response } from 'express'
import validator from 'validator'
export default class CreateRoomMiddleware {
  constructor(
    private readonly logger: TwakeLogger,
    private readonly validPresets: string[]
  ) {}

  /**
   * Validates that the preset value (if provided) is one of the allowed presets.
   * @param preset - The preset value to validate
   * @returns True if preset is valid or undefined, false otherwise
   */
  private validatePreset = (preset: unknown): preset is string => {
    if (preset === undefined) {
      return true // Preset is optional
    }

    return typeof preset === 'string' && this.validPresets.includes(preset)
  }

  public checkPayload = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const { body } = req

    if (!body || !Object.keys(body).length) {
      this.logger.error('Missing request body')
      res.status(400).send('Missing body')
      return
    }

    try {
      if (!validator.isJSON(JSON.stringify(body))) {
        throw Error('Invalid JSON')
      }
    } catch (error) {
      this.logger.error('Invalid JSON in request body', { error })
      res.status(400).send('Invalid JSON')
      return
    }

    // Validate preset if provided
    if (!this.validatePreset(body.preset)) {
      this.logger.error('Invalid preset value provided', {
        preset: body.preset,
        validPresets: this.validPresets
      })
      res.status(400).send('Invalid preset value')
      return
    }

    next()
  }
}
