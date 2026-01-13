import {
  getLogger,
  type TwakeLogger,
  type Config as LoggerConfig
} from '@twake-chat/logger'
import type { AuthenticationFunction, Config } from '../../types.ts'
import { Router } from 'express'
import bodyParser from 'body-parser'
import CreateRoomAPI from './createRoom/index.ts'
import DisplayNameAPI from './displayName/index.ts'

export const PATH = '/_matrix/client/v3'

/**
 * Matrix Client API Router
 *
 * @param {Config} config
 * @param {TwakeLogger} defaultLogger
 * @returns {Router}
 */
export default (
  config: Config,
  authenticator: AuthenticationFunction,
  defaultLogger?: TwakeLogger
): Router => {
  const router = Router()
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const createRoomAPI = CreateRoomAPI(config, authenticator, logger)
  const displayNameAPI = DisplayNameAPI(config, authenticator, logger)

  router.use(bodyParser.json())
  router.use(`${PATH}/createRoom`, createRoomAPI)
  router.use(`${PATH}/profile/:userId/displayname`, displayNameAPI)

  return router
}
