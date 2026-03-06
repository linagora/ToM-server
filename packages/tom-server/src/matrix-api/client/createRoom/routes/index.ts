import {
  getLogger,
  type TwakeLogger,
  type Config as LoggerConfig
} from '@twake/logger'
import type {
  AuthenticationFunction,
  Config,
  PresetConfig
} from '../../../../types'
import { Router } from 'express'
import CreateRoomController from '../controllers'
import CreateRoomMiddleware from '../middlewares'
import authMiddleware from '../../../../utils/middlewares/auth.middleware'

/**
 * Create room route
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
  const logger = defaultLogger ?? getLogger(config as unknown as LoggerConfig)
  const router = Router()
  const controller = new CreateRoomController(config, logger)
  const authenticate = authMiddleware(authenticator, logger)

  // Extract valid preset names from the config array
  const validPresets = (config.features?.createroom_proxy?.presets ?? []).map(
    (p: PresetConfig) => p.name
  )

  const createRoomMiddleware = new CreateRoomMiddleware(
    logger,
    validPresets,
    config.matrix_internal_host ?? ''
  )

  router.post(
    '/',
    authenticate,
    createRoomMiddleware.checkPayload,
    createRoomMiddleware.bypassIfSpace,
    createRoomMiddleware.validatePreset,
    controller.createRoom
  )

  return router
}
