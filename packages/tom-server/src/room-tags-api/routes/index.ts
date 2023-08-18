/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake/logger'
import type { MatrixDBBackend } from '@twake/matrix-identity-server'
import { Router } from 'express'
import type { Config, IdentityServerDb } from '../../types'
import authMiddleware from '../../utils/middlewares/auth.middleware'
import RoomTagsController from '../controllers'
import RoomTagsMiddleware from '../middlewares'

export const PATH = '/_twake/v1/room_tags'

export default (
  db: IdentityServerDb,
  maxtrixDb: MatrixDBBackend,
  config: Config,
  defaultLogger?: TwakeLogger
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const authenticator = authMiddleware(db, config, logger)
  const roomTagsController = new RoomTagsController(db)
  const roomTagsMiddleware = new RoomTagsMiddleware(db, maxtrixDb)

  /**
   * @openapi
   * components:
   *  parameters:
   *    roomId:
   *      in: path
   *      name: roomId
   *      description: the room id
   *      required: true
   *      schema:
   *        type: string
   *  schemas:
   *    RoomTags:
   *      type: object
   *      properties:
   *        tags:
   *          description: the room tags list
   *          type: array
   *          items:
   *            type: string
   *    RoomTagCreation:
   *      type: object
   *      properties:
   *        content:
   *          type: array
   *          description: the room tags strings
   *          items:
   *            type: string
   *        roomId:
   *          type: string
   *          description: the room id
   *    RoomTagsUpdate:
   *      type: object
   *      properties:
   *        content:
   *          type: array
   *          description: the room tags strings
   *          items:
   *            type: string
   *  responses:
   *    InternalError:
   *      description: Internal error
   *    BadRequest:
   *      description: Bad request
   *    Created:
   *      description: Created
   *    Unauthorized:
   *      description: Unauthorized
   *    NoContent:
   *      description: operation successful and no content returned
   */

  /**
   * @openapi
   * /_twake/v1/room_tags/{roomId}:
   *  get:
   *    tags:
   *      - Room tags
   *    description: Get room tags
   *    parameters:
   *      - $ref: '#/components/parameters/roomId'
   *    responses:
   *      200:
   *        description: Room tags found
   *        content:
   *          application/json:
   *            schema:
   *              $ref: '#/components/schemas/RoomTags'
   *      500:
   *        description: Internal error
   *      400:
   *        description: Bad request
   *      401:
   *        description: user is unauthorized
   */
  router.get(
    `${PATH}/:roomId`,
    authenticator,
    roomTagsMiddleware.checkFetchRequirements,
    roomTagsController.get
  )

  /**
   * @openapi
   * /_twake/v1/room_tags:
   *  post:
   *    tags:
   *      - Room tags
   *    description: Create room tags
   *    requestBody:
   *      content:
   *        application/json:
   *          schema:
   *            $ref: '#/components/schemas/RoomTagCreation'
   *    responses:
   *      201:
   *        description: Room tags created
   *      500:
   *        description: Internal error
   *      400:
   *        description: Bad request
   *      401:
   *        description: user is unauthorized
   */
  router.post(
    PATH,
    authenticator,
    roomTagsMiddleware.checkCreateRequirements,
    roomTagsController.create
  )

  /**
   * @openapi
   * /_twake/v1/room_tags/{roomId}:
   *  put:
   *    tags:
   *      - Room tags
   *    description: Update room tags
   *    parameters:
   *      - $ref: '#/components/parameters/roomId'
   *    requestBody:
   *      content:
   *        application/json:
   *          schema:
   *            $ref: '#/components/schemas/RoomTagsUpdate'
   *    responses:
   *      204:
   *        description: Room tags updated
   *      500:
   *        description: Internal error
   *      400:
   *        description: Bad request
   *      401:
   *        description: user is unauthorized
   */
  router.put(
    `${PATH}/:roomId`,
    authenticator,
    roomTagsMiddleware.checkUpdateRequirements,
    roomTagsController.update
  )

  /**
   * @openapi
   * /_twake/v1/room_tags/{roomId}:
   *  delete:
   *    tags:
   *      - Room tags
   *    description: delete tags for a room
   *    parameters:
   *      - $ref: '#/components/parameters/roomId'
   *    responses:
   *      204:
   *        description: Room tags deleted
   *      500:
   *        description: Internal error
   *      400:
   *        description: Bad request
   *      401:
   *        description: user is unauthorized
   */
  router.delete(
    `${PATH}/:roomId`,
    authenticator,
    roomTagsMiddleware.checkDeleteRequirements,
    roomTagsController.delete
  )

  return router
}
