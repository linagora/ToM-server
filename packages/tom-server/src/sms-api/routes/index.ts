/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router } from 'express'
import { type Config, type IdentityServerDb } from '../../types'
import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake/logger'
import authMiddleware from '../../utils/middlewares/auth.middleware'
import SmsApiMiddleware from '../middlewares'
import SmsApiController from '../controllers'

export const PATH = '/_twake/sms'

export default (
  db: IdentityServerDb,
  config: Config,
  defaultLogger?: TwakeLogger
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const authenticate = authMiddleware(db, config, logger)
  const validationMiddleware = new SmsApiMiddleware(logger)
  const smsApiController = new SmsApiController(config, logger)

  /**
   * @openapi
   * components:
   *  schemas:
   *    sms:
   *      type: object
   *      properties:
   *        to:
   *          oneOf:
   *            - type: string
   *            - type: array
   *              items:
   *                type: string
   *        text:
   *          type: string
   */

  /**
   * @openapi
   * /_twake/sms:
   *  post:
   *    requestBody:
   *      description: SMS object
   *      required: true
   *      content:
   *        application/json:
   *          schema:
   *            $ref: '#/components/schemas/sms'
   *    tags:
   *      - SMS
   *    description: Send an SMS to a phone number
   *    responses:
   *      200:
   *        description: SMS sent successfully
   *      400:
   *        description: Invalid request
   *      401:
   *        description: Unauthorized
   *      500:
   *        description: Internal server error
   */
  router.post(
    PATH,
    authenticate,
    validationMiddleware.checkSendRequirements,
    validationMiddleware.validateMobilePhone,
    smsApiController.send
  )

  return router
}
