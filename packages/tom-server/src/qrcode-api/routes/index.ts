/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  getLogger,
  type TwakeLogger,
  type Config as LoggerConfig
} from '@twake-chat/logger'
import type IdServer from '../../identity-server/index.ts'
import { type Config, type ITokenService } from '../../types.ts'
import { Router } from 'express'
import authMiddleware from '../../utils/middlewares/auth.middleware.ts'
import QRCodeApiController from '../controllers/index.ts'

export const PATH = '/_twake/v1/qrcode'

export default (
  idServer: IdServer,
  config: Config,
  defaultLogger?: TwakeLogger,
  tokenService?: ITokenService
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const authenticator = authMiddleware(idServer.authenticate, logger)
  const qrCodeController = new QRCodeApiController(logger, config, tokenService)

  /**
   * @openapi
   * /_twake/v1/qrcode:
   *   get:
   *      tags:
   *        - QR Code
   *      description: Get access QR Code
   *      responses:
   *        200:
   *          description: QR code generated
   *          content:
   *            image/svg+xml:
   *              schema:
   *                type: string
   *        400:
   *          description: Access token is missing
   *        500:
   *          description: Internal server error
   *        401:
   *          description: Unauthorized
   */
  router.get(PATH, authenticator, qrCodeController.get)

  return router
}
