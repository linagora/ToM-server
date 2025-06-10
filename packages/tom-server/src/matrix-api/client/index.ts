import {
  getLogger,
  type TwakeLogger,
  type Config as LoggerConfig
} from '@twake/logger'
import type { Config } from '../../types'
import { Router } from 'express'
import bodyParser from 'body-parser'
import CreateRoomAPI from './createRoom'

export const PATH = '/_matrix/client/v3'

/**
 * Matrix Client API Router
 *
 * @param {Config} config
 * @param {TwakeLogger} defaultLogger
 * @returns {Router}
 */
export default (config: Config, defaultLogger?: TwakeLogger): Router => {
  const router = Router()
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const createRoomAPI = CreateRoomAPI(config, logger)

  router.use(bodyParser.json())
  router.use(`${PATH}/createRoom`, createRoomAPI)

  return router
}
