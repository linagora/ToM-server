/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake/logger'
import { Router } from 'express'
import { type AuthenticationFunction, type Config } from '../../types'
import authMiddleware from '../../utils/middlewares/auth.middleware'
import SmsApiController from '../controllers'
import SmsApiMiddleware from '../middlewares'
import { type ISmsService } from '../types'

export const PATH = '/_twake/sms'

export default (
  config: Config,
  authenticator: AuthenticationFunction,
  defaultLogger?: TwakeLogger,
  smsService?: ISmsService
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const authenticate = authMiddleware(authenticator, logger)
  const validationMiddleware = new SmsApiMiddleware(logger)
  const smsApiController = new SmsApiController(config, logger, smsService)

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
