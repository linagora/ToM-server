import {
  Bridge,
  Cli,
  AppServiceRegistration,
  Request,
  WeakEvent,
  Logger
} from 'matrix-appservice-bridge'

// 1. Configure the logger
Logger.configure({ console: 'debug' })
const log = new Logger('App')

enum SynapseAdminRetryMode {
  DISABLED = 'disabled', // Nerver tries to update using synapse admin API
  FALLBACK = 'fallback', // Tries to update using synapse admin API, if normal update fails
  EXCLUSIVE = 'exclusive' // Only tries to update using synapse admin API
}

/*
 * Updates user' s display name using Synapse admin API
 */
const updateDisplayNameAdmin = async (
  userId: string,
  bridge: Bridge,
  newDisplayname: string
): Promise<void> => {
  const botUserId = bridge.getBot().getUserId()
  const botIntent = bridge.getIntent(botUserId)
  const botMatrixClient = botIntent.matrixClient
  const botToken = botMatrixClient.accessToken

  if (!botToken) {
    throw new Error('Bot access token is not available for admin API calls.')
  }
  log.debug(`Using bot token: ${botToken}`)

  const adminApis = botMatrixClient.adminApis
  if (!adminApis || !adminApis.synapse) {
    throw new Error('Synapse admin APIs are not available.')
  }

  const botIsAdmin = botIntent.matrixClient.adminApis.synapse.isSelfAdmin()
  if (!botIsAdmin) {
    throw new Error(
      'Bot user does not have admin privileges to use Synapse admin API.'
    )
  }

  try {
    log.info(`Attempting to update display name for ${userId} via admin API...`)
    await adminApis.synapse.upsertUser(userId, { displayname: newDisplayname })
    log.info(`Successfully updated display name for ${userId} via admin API.`)
  } catch (err) {
    log.error(`Failed to update display name for ${userId} via admin API.`)
    throw err
  }
}

/**
 * Updates user's display name if needed
 */
const updateDisplayName = async (
  userId: string,
  bridge: Bridge,
  newDisplayname: string,
  adminRetryMode: SynapseAdminRetryMode = SynapseAdminRetryMode.DISABLED
): Promise<void> => {
  if (!newDisplayname) {
    log.warn(`No new display name provided for ${userId}. Skipping update.`)
    return
  }

  if (adminRetryMode === SynapseAdminRetryMode.EXCLUSIVE) {
    log.info(
      `Admin retry mode is EXCLUSIVE. Attempting admin update for ${userId}.`
    )
    await updateDisplayNameAdmin(userId, bridge, newDisplayname)
    return
  }

  const intent = bridge.getIntent(userId)

  // Fetch current profile to see if update is actually needed
  try {
    const profile = await intent.getProfileInfo(userId)
    const currentName = profile.displayname
    log.debug(
      `User ${userId} - Current: '${currentName}', Target: '${newDisplayname}'`
    )
    if (currentName == newDisplayname) {
      log.info(
        `User ${userId} already has the correct display name. Skipping update.`
      )
      return
    }
  } catch (err) {
    // Log the full error object for debugging, but a clean message for info
    log.error(`Failed to update profile for ${userId}`)
    log.error(err)
    throw err
  }

  try {
    log.info(`Display name mismatch for ${userId}. Updating...`)
    await intent.setDisplayName(newDisplayname)
    log.info(`Successfully updated display name for ${userId}`)
  } catch (err: any) {
    log.error(`Failed to update profile using intent for ${userId}`)
    if (
      err?.errcode === 'M_FORBIDDEN' &&
      adminRetryMode === SynapseAdminRetryMode.FALLBACK
    ) {
      log.info(`Attempting admin update...`)
      await updateDisplayNameAdmin(userId, bridge, newDisplayname)
      return
    } else {
      log.info(
        `Synapse Admin fallback not enabled or not applicable. Aborting.`
      )
      throw err
    }
  }
}

/**
 * Processes incoming Matrix events
 */
const handleEvent = async (
  request: Request<WeakEvent>,
  bridge: Bridge,
  config: Record<string, unknown>
): Promise<void> => {
  const event = request.getData()
  const { type, content, sender, room_id } = event
  const eventId = event.event_id

  log.debug(`Received event ${eventId} [${type}] from ${sender} in ${room_id}`)

  // Filter 1: Must be a message
  if (type !== 'm.room.message') {
    log.debug(`Skipping event ${eventId}: Not an m.room.message (type=${type})`)
    return
  }

  // Filter 2: Must have body
  if (!content?.body) {
    log.debug(`Skipping event ${eventId}: No content body`)
    return
  }

  // Filter 3: Don't react to self (infinite loop prevention)
  if (sender === bridge.getBot().getUserId()) {
    log.debug(`Skipping event ${eventId}: Sender is the bridge bot`)
    return
  }

  log.info(`Processing message from ${sender} in ${room_id}`)

  try {
    await updateDisplayName(
      sender,
      bridge,
      `${
        (
          await bridge.getIntent(sender).getProfileInfo(sender)
        ).displayname
      } bridged`,
      (config as any).synapse.adminRetryMode === 'exclusive'
        ? SynapseAdminRetryMode.EXCLUSIVE
        : (config as any).synapse.adminRetryMode === 'fallback'
        ? SynapseAdminRetryMode.FALLBACK
        : SynapseAdminRetryMode.DISABLED
    )
  } catch (err) {
    log.error(
      `Error processing event ${eventId} from ${sender}:`,
      err instanceof Error ? err.message : err
    )
  }
}

/**
 * Creates registration configuration
 */
const setupRegistration = (reg: AppServiceRegistration): void => {
  log.info('Generating new registration file...')
  reg.setId(AppServiceRegistration.generateToken())
  reg.setHomeserverToken(AppServiceRegistration.generateToken())
  reg.setAppServiceToken(AppServiceRegistration.generateToken())
  reg.setSenderLocalpart('profile-bot')
  reg.addRegexPattern('users', '@.*', false)
  log.info('Registration configuration generated.')
}

/**
 * Initializes and runs the bridge
 */
const startBridge = (
  port: number | null,
  config: Record<string, unknown> | null
): void => {
  log.info('Initializing bridge instance...')
  if (!config) {
    log.error('No configuration provided to startBridge.')
    process.exit(1)
  }
  log.info(
    `Configuration: Homeserver=${config.homeserverUrl}, Domain=${config.domain}`
  )

  const bridge: Bridge = new Bridge({
    homeserverUrl: config.homeserverUrl as string,
    domain: config.domain as string,
    registration: config.registrationPath as string,
    disableStores: true,
    controller: {
      onEvent: (req) => handleEvent(req, bridge, config),
      onLog: (text, isError) => {
        // Optional: Forward internal library logs to our logger if needed
        if (isError) log.error(`Bridge Lib: ${text}`)
        else log.debug(`Bridge Lib: ${text}`)
      }
    }
  })

  const runPort = port ?? 9000
  log.info(`Starting listener on port ${runPort}...`)

  bridge
    .run(runPort)
    .then(async () => {
      log.info('Bridge started successfully.')
      log.info(`Bridge is now running on port ${runPort}`)

      // --- NEW STARTUP LOGIC ---
      try {
        const botId = bridge.getBot().getUserId()
        log.info(`Ensuring bridge bot user (${botId}) is registered...`)
        const botIntent = bridge.getIntent(botId)

        // This ensures the bot user (e.g. @profile-bot:domain) exists in Synapse
        await botIntent.ensureRegistered()

        // Check if Bot is Admin
        const isAdmin =
          await botIntent.matrixClient.adminApis.synapse.isSelfAdmin()
        if (isAdmin) {
          log.info(`Bridge bot user ${botId} has admin privileges.`)
        } else {
          log.warn(`Bridge bot user ${botId} does NOT have admin privileges.`)
        }

        log.debug(
          'Synapse Admin Retry Mode:',
          (config as any).synapse.adminRetryMode
        )

        log.info(`Bridge bot user (${botId}) is registered and ready.`)
      } catch (err) {
        log.error('Failed to register bridge bot user at startup:', err)
      }
      // -------------------------
    })
    .catch((err) => {
      log.error('Failed to start bridge:', err)
      process.exit(1)
    })
}

/**
 * Entry point
 */
new Cli({
  registrationPath: process.env.REGISTRATION_FILE ?? undefined,
  enableRegistration: true,
  bridgeConfig: { schema: {}, defaults: {} },
  generateRegistration: setupRegistration,
  run: startBridge
}).run()
