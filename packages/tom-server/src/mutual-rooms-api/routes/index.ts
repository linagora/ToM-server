/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router } from 'express'
import type { Config, IdentityServerDb } from '../../types'
import authMiddleware from '../../utils/middlewares/auth.middleware'
import MutualRoomsApiController from '../controllers'
import errorMiddleware from '../../utils/middlewares/error.middleware'
import type { MatrixDBBackend } from '@twake/matrix-identity-server'

export const PATH = '/_twake/mutual_rooms'

export default (
  db: IdentityServerDb,
  config: Config,
  matrixdb: MatrixDBBackend
): Router => {
  const router = Router()
  const authenticate = authMiddleware(db, config)
  const controller = new MutualRoomsApiController(matrixdb)

  router.get(`${PATH}/:id`, authenticate, controller.get)
  router.use(errorMiddleware)

  return router
}
