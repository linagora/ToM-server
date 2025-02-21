import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake/logger'
import type IdServer from '../../identity-server'
import type { Config } from '../../types'
import { Router } from 'express'
import authMiddleware from '../../utils/middlewares/auth.middleware'

export const PATH = '/_twake/addressbook'

export default (
  idServer: IdServer,
  config: Config,
  defaultLogger?: TwakeLogger
): Router => {
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const authenticator = authMiddleware(idServer.authenticate, logger)

  return router
}
