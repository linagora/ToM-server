import {
  getLogger,
  type TwakeLogger,
  type Config as LoggerConfig
} from '@twake/logger'
import type { AuthenticationFunction, Config } from '../../../../types'
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

  // Extract valid presets from config room_permissions
  // Exclude 'roles' and 'direct_chat' as they are not user-selectable presets
  const configPresets = config.room_permissions
    ? Object.keys(config.room_permissions).filter(
        (key) => key !== 'roles' && key !== 'direct_chat'
      )
    : []

  // Standard Matrix presets that map to config presets
  // trusted_private_chat, private_chat, public_chat → use private_group_chat or public_group_chat
  // private_channel, public_channel → use their own config entries
  const validPresets = [
    'trusted_private_chat',
    'private_chat',
    'public_chat',
    ...configPresets
  ]

  const createRoomMiddleware = new CreateRoomMiddleware(logger, validPresets)

  router.post(
    '/',
    authenticate,
    createRoomMiddleware.checkPayload,
    controller.createRoom
  )

  return router
}
