import { TwakeLogger } from '@twake/logger'
import type { NextFunction, Request, Response } from 'express'
import validator from 'validator'
import { buildUrl } from '../../../../utils'

const SPACE_ROOM_TYPE = 'm.space'
const CREATE_ROOM_API_PATH = '/_matrix/client/v3/createRoom'

export default class CreateRoomMiddleware {
  constructor(
    private readonly logger: TwakeLogger,
    private readonly validPresets: string[],
    private readonly matrixInternalHost: string
  ) {}

  /**
   * Detects if the room being created is a Matrix space (creation_content.type === 'm.space').
   * If so, forwards the request directly to the homeserver, bypassing preset processing.
   * Otherwise calls next() to continue the middleware chain.
   */
  public bypassIfSpace = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const roomType = req.body?.creation_content?.type

    this.logger.debug('[createRoom] bypassIfSpace', { roomType })

    if (roomType !== SPACE_ROOM_TYPE) {
      next()
      return
    }

    this.logger.info(
      '[createRoom] Space room detected, bypassing preset processing'
    )

    try {
      const { authorization } = req.headers
      const apiUrl = buildUrl(this.matrixInternalHost, CREATE_ROOM_API_PATH)

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization as string
        },
        body: JSON.stringify(req.body)
      })

      const data = await response.json()
      res.status(response.status).json(data)
    } catch (error) {
      this.logger.error(
        '[createRoom] Failed to forward space room creation',
        error
      )
      next(error)
    }
  }

  /**
   * Validates that the request body is present and valid JSON.
   * Sets res status to 400 M_NOT_JSON if validation fails.
   */
  public checkPayload = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const { body } = req

    this.logger.debug('[createRoom] checkPayload', body)

    if (!body || !Object.keys(body).length) {
      this.logger.error('Missing request body')
      res.status(400).json({ errcode: 'M_NOT_JSON', error: 'Missing body' })
      return
    }

    try {
      if (!validator.isJSON(JSON.stringify(body))) {
        throw Error('Invalid JSON')
      }
    } catch (error) {
      this.logger.error('Invalid JSON in request body', error)
      res.status(400).json({ errcode: 'M_NOT_JSON', error: 'Invalid JSON' })
      return
    }

    next()
  }

  /**
   * Validates that the preset value (if provided) is one of the allowed presets.
   * Sets res status to 400 M_BAD_JSON if preset is unrecognized.
   */
  public validatePreset = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const preset = req.body?.preset

    this.logger.debug('[createRoom] validatePreset', {
      preset,
      validPresets: this.validPresets
    })

    if (preset !== undefined && !this.validPresets.includes(preset)) {
      this.logger.error('Invalid preset value provided', {
        preset,
        validPresets: this.validPresets
      })
      res
        .status(400)
        .json({ errcode: 'M_BAD_JSON', error: 'Invalid preset value' })
      return
    }

    next()
  }
}
