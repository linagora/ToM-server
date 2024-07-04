/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake/logger'
import { Router } from 'express'
import type { AuthenticationFunction, Config, TwakeDB } from '../../types'
import authMiddleware from '../../utils/middlewares/auth.middleware'
import PrivateNoteApiController from '../controllers'
import PrivateNoteApiValidationMiddleware from '../middlewares/validation.middleware'

export const PATH = '/_twake/private_note'

export default (
  db: TwakeDB,
  config: Config,
  authenticator: AuthenticationFunction,
  defaultLogger?: TwakeLogger
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const authenticate = authMiddleware(authenticator, logger)
  const privateNoteApiController = new PrivateNoteApiController(db)
  const validationMiddleware = new PrivateNoteApiValidationMiddleware(db)

  /**
   * @openapi
   * components:
   *  parameters:
   *    user_id:
   *      name: user_id
   *      in: query
   *      description: the author user id
   *      required: true
   *      schema:
   *        type: string
   *    target_user_id:
   *      name: target_user_id
   *      in: query
   *      description: the target user id
   *      required: true
   *      schema:
   *        type: string
   *    private_note_id:
   *      name: private_note_id
   *      in: path
   *      description: the private note id
   *      required: true
   *      schema:
   *        type: string
   *  schemas:
   *    PrivateNote:
   *      type: object
   *      properties:
   *        id:
   *          type: string
   *          description: The private note id
   *        content:
   *          type: string
   *          description: The private note content
   *        authorId:
   *          type: string
   *          description: The author user id
   *        targetId:
   *          type: string
   *          description: The target user id
   *    CreatePrivateNote:
   *      type: object
   *      properties:
   *        content:
   *          type: string
   *          description: The private note content
   *        authorId:
   *          type: string
   *          description: The author user id
   *        targetId:
   *          type: string
   *          description: The target user id
   *    UpdatePrivateNote:
   *      type: object
   *      properties:
   *        id:
   *          type: string
   *          description: The private note id
   *        content:
   *          type: string
   *          description: The private note content
   *  responses:
   *    NotFound:
   *      description: Private note not found
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
   * /_twake/private_note:
   *  get:
   *   tags:
   *     - Private Note
   *   description: Get the private note made by the user for a target user
   *   parameters:
   *     - $ref: '#/components/parameters/user_id'
   *     - $ref: '#/components/parameters/target_user_id'
   *   responses:
   *     200:
   *       description: Private note found
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/PrivateNote'
   *     404:
   *       description: Private note not found
   *     500:
   *       description: Internal error
   *     400:
   *       description: Bad request
   *     401:
   *       description: user is unauthorized
   */
  router.get(
    PATH,
    authenticate,
    validationMiddleware.checkGetRequirements,
    privateNoteApiController.get
  )

  /**
   * @openapi
   * /_twake/private_note:
   *  post:
   *   tags:
   *     - Private Note
   *   description: Create a private note for a target user
   *   requestBody:
   *     content:
   *       application/json:
   *         schema:
   *           $ref: '#/components/schemas/CreatePrivateNote'
   *   responses:
   *     201:
   *       description: Private note created
   *     500:
   *       description: Internal error
   *     400:
   *       description: Bad request
   *     401:
   *       description: user is unauthorized
   */
  router.post(
    PATH,
    authenticate,
    validationMiddleware.checkCreationRequirements,
    privateNoteApiController.create
  )

  /**
   * @openapi
   * /_twake/private_note:
   *  put:
   *   tags:
   *     - Private Note
   *   description: Update a private note
   *   requestBody:
   *     content:
   *       application/json:
   *         schema:
   *           $ref: '#/components/schemas/UpdatePrivateNote'
   *   responses:
   *     204:
   *       description: Private note created
   *     500:
   *       description: Internal error
   *     400:
   *       description: Bad request
   *     401:
   *       description: user is unauthorized
   */
  router.put(
    PATH,
    authenticate,
    validationMiddleware.checkUpdateRequirements,
    privateNoteApiController.update
  )

  /**
   * @openapi
   * /_twake/private_note/{private_note_id}:
   *  delete:
   *   tags:
   *     - Private Note
   *   description: Delete a private note
   *   parameters:
   *     - $ref: '#/components/parameters/private_note_id'
   *   responses:
   *     204:
   *       description: Private note deleted
   *     500:
   *       description: Internal error
   *     400:
   *       description: Bad request
   *     401:
   *       description: user is unauthorized
   */
  router.delete(
    `${PATH}/:id`,
    authenticate,
    validationMiddleware.checkDeleteRequirements,
    privateNoteApiController.deleteNote
  )

  return router
}
