/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake/logger'
import type { MatrixDBBackend } from '@twake/matrix-identity-server'
import { Router } from 'express'
import type { AuthenticationFunction, Config } from '../../types'
import authMiddleware from '../../utils/middlewares/auth.middleware'
import errorMiddleware from '../../utils/middlewares/error.middleware'
import MutualRoomsApiController from '../controllers'

export const PATH = '/_twake/mutual_rooms'

export default (
  config: Config,
  matrixdb: MatrixDBBackend,
  authenticator: AuthenticationFunction,
  defaultLogger?: TwakeLogger
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const authenticate = authMiddleware(authenticator, logger)
  const controller = new MutualRoomsApiController(matrixdb)

  /**
   * @openapi
   * components:
   *  parameters:
   *    target_userid:
   *      name: target_userid
   *      in: path
   *      required: true
   *      description: the target user id
   *      schema:
   *        type: string
   *  schemas:
   *    MutualRooms:
   *      type: array
   *      items:
   *        type: object
   *        properties:
   *          roomId:
   *            type: string
   *            description: the room id
   *          name:
   *            type: string
   *            description: the room name
   *          topic:
   *            type: string
   *            description: the room topic
   *          room_type:
   *            type: string
   *            description: the room type
   */

  /**
   * @openapi
   * /_twake/mutual_rooms/{target_userid}:
   *  get:
   *   tags:
   *     - Mutual Rooms
   *   description: Get the list of mutual rooms between two users
   *   parameters:
   *     - $ref: '#/components/parameters/target_userid'
   *   responses:
   *     200:
   *       description: Successful operation
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/MutualRooms'
   *     401:
   *       description: Unauthorized
   *     500:
   *       description: Internal error
   *     404:
   *       description: Not found
   *     400:
   *       description: Bad request
   */
  router.get(`${PATH}/:id`, authenticate, controller.get)
  router.use(errorMiddleware(logger))

  return router
}
