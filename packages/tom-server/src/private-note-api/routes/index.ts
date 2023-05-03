/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router } from 'express'
import PrivateNoteApiController from '../controllers'
import type { IdentityServerDb, Config } from '../../utils'
import authMiddleware from '../middlewares/auth.middleware'
import PrivateNoteApiValidationMiddleware from '../middlewares/validation.middleware'

export const PATH = '/_twake/private_note'

export default (db: IdentityServerDb, config: Config): Router => {
  const router = Router()
  const authenticate = authMiddleware(db, config)
  const privateNoteApiController = new PrivateNoteApiController(db)
  const validationMiddleware = new PrivateNoteApiValidationMiddleware(db)

  router.get(
    PATH,
    authenticate,
    validationMiddleware.checkGetRequirements,
    privateNoteApiController.get
  )

  router.post(
    PATH,
    authenticate,
    validationMiddleware.checkCreationRequirements,
    privateNoteApiController.create
  )

  router.put(
    PATH,
    authenticate,
    validationMiddleware.checkUpdateRequirements,
    privateNoteApiController.update
  )

  router.delete(
    `${PATH}/:id`,
    authenticate,
    validationMiddleware.checkDeleteRequirements,
    privateNoteApiController.deleteNote
  )

  return router
}
