/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router } from 'express'
import { create, deleteNote, get, update } from '../controllers'
import type { IdentityServerDb, Config } from '../../utils'
import authMiddleware from '../middlewares/auth.middleware'
import {
  checkCreationRequirements,
  checkDeleteRequirements,
  checkGetRequirements,
  checkUpdateRequirements
} from '../middlewares/validation.middleware'

export const PATH = '/_twake/private_note'

export default (db: IdentityServerDb, config: Config): Router => {
  const router = Router()
  const authenticate = authMiddleware(db, config)

  router.get(PATH, authenticate, checkGetRequirements, get)
  router.post(PATH, authenticate, checkCreationRequirements, create)
  router.put(PATH, authenticate, checkUpdateRequirements, update)
  router.delete(
    `${PATH}/:id`,
    authenticate,
    checkDeleteRequirements,
    deleteNote
  )

  return router
}
