import { Cli, AppServiceRegistration, Logger } from 'matrix-appservice-bridge'
import { CommonSettingsBridge } from './bridge'
import { BridgeConfig } from './types'

const log = new Logger('CLI')

/**
 * Configures the application service registration with tokens and user patterns.
 * This is called by the CLI when generating a new registration file.
 * @param reg - The AppServiceRegistration instance to configure
 */
export function setupRegistration(reg: AppServiceRegistration): void {
  log.info('==========================================')
  log.info('Generating Registration File')
  log.info('==========================================')

  log.debug('Generating tokens...')
  const appServiceId = AppServiceRegistration.generateToken()
  const hsToken = AppServiceRegistration.generateToken()
  const asToken = AppServiceRegistration.generateToken()

  reg.setId(appServiceId)
  reg.setHomeserverToken(hsToken)
  reg.setAppServiceToken(asToken)
  reg.setSenderLocalpart('_common_settings_bridge')
  reg.addRegexPattern('users', '@.*', false)

  log.info('Registration configuration generated')
  log.debug(`App Service ID: ${appServiceId.substring(0, 10)}...`)
  log.debug('Sender localpart: _common_settings_bridge')
  log.debug('User namespace: @.*')
  log.info('==========================================')
}

/**
 * Entry point for starting the bridge from the CLI.
 * Creates and starts the CommonSettingsBridge with the provided configuration.
 * Sets up signal handlers for graceful shutdown.
 * @param port - The port number (unused, bridge runs on port 0)
 * @param config - The bridge configuration loaded from the config file
 */
export function startBridge(
  port: number | null,
  config: Record<string, unknown> | null
): void {
  if (!config) {
    log.error('==========================================')
    log.error('ERROR: No configuration provided')
    log.error('==========================================')
    process.exit(1)
  }

  const bridgeConfig = config as unknown as BridgeConfig

  log.debug('Configuration loaded:')
  log.debug(`  Homeserver: ${bridgeConfig.homeserverUrl}`)
  log.debug(`  Domain: ${bridgeConfig.domain}`)
  log.debug(
    `  Database: ${bridgeConfig.database?.engine} (${bridgeConfig.database?.name})`
  )
  log.debug(
    `  RabbitMQ: ${bridgeConfig.rabbitmq?.host}:${bridgeConfig.rabbitmq?.port}`
  )

  const bridge = new CommonSettingsBridge(bridgeConfig)

  bridge.start().catch((err) => {
    log.error('==========================================')
    log.error('FATAL: Failed to start bridge')
    log.error(err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) {
      log.debug(`Stack trace: ${err.stack}`)
    }
    log.error('==========================================')
    process.exit(1)
  })

  const shutdown = async (): Promise<void> => {
    try {
      await bridge.stop()
      process.exit(0)
    } catch (error) {
      log.error(
        'Error during shutdown:',
        error instanceof Error ? error.message : String(error)
      )
      process.exit(1)
    }
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

/**
 * Runs the CLI interface for the Common Settings Bridge.
 * This is the main entry point when the bridge is run from the command line.
 */
export function runCli(): void {
  new Cli({
    registrationPath: process.env.REGISTRATION_FILE ?? undefined,
    enableRegistration: true,
    bridgeConfig: { schema: {}, defaults: {} },
    generateRegistration: setupRegistration,
    run: startBridge
  }).run()
}
