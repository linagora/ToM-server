/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake-chat/logger'
import { type AuthenticationFunction, type Config } from '../../types'
import { type MatrixDBBackend } from '@twake-chat/matrix-identity-server'
import { Router } from 'express'
import authMiddleware from '../../utils/middlewares/auth.middleware'
import MetricsApiController from '../controllers'
import MetricsApiMiddleware from '../middlewares'

export const PATH = '/_twake/v1/metrics'

export default (
  config: Config,
  matrixDb: MatrixDBBackend,
  authenticator: AuthenticationFunction,
  defaultLogger?: TwakeLogger
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const authenticate = authMiddleware(authenticator, logger)
  const controller = new MetricsApiController(matrixDb, logger)
  const middleware = new MetricsApiMiddleware(matrixDb, logger)

  /**
   * @openapi
   * components:
   *   schemas:
   *     ActivityMetric:
   *      type: object
   *      properties:
   *       dailyActiveUsers:
   *        type: number
   *       weeklyActiveUsers:
   *        type: number
   *       monthlyActiveUsers:
   *        type: number
   *       weeklyNewUsers:
   *        type: number
   *       monthlyNewUsers:
   *        type: number
   *     MessageMetric:
   *       type: array
   *       items:
   *        type: object
   *        properties:
   *          user_id:
   *            type: string
   *          message_count:
   *            type: number
   */

  /**
   * @openapi
   * /_twake/v1/metrics/activity:
   *   get:
   *      tags:
   *        - Metrics
   *      description: Get user activity metrics
   *      responses:
   *        200:
   *          description: Activity metrics found
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                $ref: '#/components/schemas/ActivityMetric'
   *        500:
   *          description: Internal error
   *        400:
   *          description: Bad request
   *        403:
   *          description: Forbidden
   */
  router.get(
    `${PATH}/activity`,
    authenticate,
    middleware.checkPermissions,
    controller.getActivityStats
  )

  /**
   * @openapi
   * /_twake/v1/metrics/messages:
   *   get:
   *      tags:
   *        - Metrics
   *      description: Get user messages metrics
   *      responses:
   *        200:
   *          description: Messages metrics found
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                $ref: '#/components/schemas/MessageMetric'
   *        500:
   *          description: Internal error
   *        400:
   *          description: Bad request
   *        403:
   *          description: Forbidden
   */
  router.get(
    `${PATH}/messages`,
    authenticate,
    middleware.checkPermissions,
    controller.getMessageStats
  )

  return router
}
