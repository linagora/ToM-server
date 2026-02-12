import type { TwakeLogger } from '@twake/logger'
import type { Config } from '../../../../types'
import type {
  CreateRoomPayload,
  PowerLevelEventContent
} from '../../../../types'
import { buildUrl } from '../../../../utils'

/**
 * Helper function to create a deep copy of an object.
 * This is crucial to prevent unintended side effects when modifying nested objects,
 * especially when working with configuration objects that should remain immutable.
 * @param obj The object to clone.
 * @returns A deep clone of the object.
 */
const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj))

/**
 * RoomService handles Matrix room creation and related power level management.
 * It encapsulates the logic for interacting with the Matrix client API for room operations.
 */
export default class RoomService {
  // API path for creating a new room
  private readonly CREATE_ROOM_API_PATH = '/_matrix/client/v3/createRoom'
  // API path for updating room power levels (state event)
  private readonly POWER_LEVEL_STATE_PATH =
    '/_matrix/client/v3/rooms/{roomId}/state/m.room.power_levels'

  /**
   * Constructs a new RoomService instance.
   * @param config - The application configuration, including Matrix host and room permissions.
   * @param logger - The logger instance for logging messages at various levels.
   */
  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger
  ) {
    this.logger.info('[RoomService] initialized.', {
      matrixHost: this.config.matrix_internal_host
    })
  }

  /**
   * Creates a new Matrix room with the given payload and authorization.
   * This method orchestrates the room creation, initial power level assignments,
   * and subsequent demotion of the room owner's power level.
   *
   * @param payload - The payload for room creation, including invitees and preset.
   * @param authorization - The authorization header (e.g., "Bearer <token>") for the Matrix API.
   * @param roomOwner - The Matrix user ID of the room owner (the user making the request).
   * @returns A Promise that resolves to the Response from the Matrix API.
   * Returns the original Matrix API response on success or API error,
   * or a generic 500 Response on unhandled internal exceptions.
   */
  public create = async (
    payload: Partial<CreateRoomPayload>,
    authorization: string,
    roomOwner: string
  ): Promise<Response> => {
    this.logger.silly('Entering RoomService.create method.', {
      method: 'RoomService.create',
      roomOwner,
      invitees: payload.invite,
      preset: payload.preset
    })

    try {
      // 1. Prepare the request body for room creation, including power level overrides.
      // This step also determines the power level to which the owner will be demoted.
      const { body, ownerDemotionLevel } = this._prepareCreateRoomBody(
        payload,
        roomOwner
      )
      this.logger.debug(
        'Prepared room creation request body and owner demotion level.',
        {
          bodyKeys: Object.keys(body || {}),
          ownerDemotionLevel: ownerDemotionLevel ?? 'N/A'
        }
      )

      // 2. Construct the full API URL for room creation.
      const apiUrl = buildUrl(
        this.config.matrix_internal_host,
        this.CREATE_ROOM_API_PATH
      )
      this.logger.info('Sending room creation request to Matrix API.', {
        url: apiUrl
      })
      this.logger.silly('Performing fetch call for room creation.', {
        method: 'POST',
        url: apiUrl,
        headers: JSON.stringify({
          'Content-Type': 'application/json',
          Authorization: 'Bearer [masked]'
        }), // Masking token for logs
        body: JSON.stringify(body)
      })

      // Execute the API call to create the room.
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization // Use the actual authorization token
        },
        body: JSON.stringify(body)
      })

      // Check if the API call was successful.
      if (!response.ok) {
        this.logger.warn(
          'Matrix API responded with an error during room creation.',
          {
            status: response.status,
            statusText: response.statusText,
            responseBody: await response.clone().text() // Clone to read text without consuming original response
          }
        )
        // Return the non-OK response from the API directly for the caller to handle.
        return response
      }

      this.logger.info('Room creation request completed successfully.')
      this.logger.debug('Received successful response from Matrix API.', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      })

      // 3. Extract the room ID from the successful response and proceed with owner demotion.
      // Clone the response before consuming its body, as the original response needs to be returned.
      const createData = (await response.clone().json()) as { room_id: string }
      const roomId = createData.room_id
      this.logger.info(`Room created with ID: ${roomId}.`)

      // Demote the room owner if a specific demotion level was determined.
      if (ownerDemotionLevel !== undefined) {
        this.logger.info(
          `Demoting room owner ${roomOwner} to power level ${ownerDemotionLevel}.`
        )
        await this._demoteRoomOwner(
          roomId,
          authorization,
          roomOwner,
          ownerDemotionLevel
        )
      } else {
        this.logger.debug(
          'No specific demotion level for room owner determined, skipping demotion.'
        )
      }

      this.logger.silly('Exiting RoomService.create method with API response.')
      return response // Return the original successful response from room creation.
    } catch (error: any) {
      // Catch any unhandled exceptions during the process.
      this.logger.error(
        'Failed to create room due to an unhandled exception.',
        {
          message: error.message,
          stack: error.stack,
          errorName: error.name,
          // Include payload and auth details for debugging, carefully masking sensitive info
          originalPayloadKeys: Object.keys(payload || {}),
          authPreview: authorization.substring(0, 15) + '...'
        }
      )
      // Return a generic 500 response for internal server errors.
      return new Response('Failed to create room due to an internal error.', {
        status: 500
      })
    }
  }

  /**
   * Prepares the request body for room creation, including initial power level overrides.
   * This function normalizes the payload, calculates initial power levels for invited users
   * and the room owner, and determines the owner's demotion level after room creation.
   *
   * @param payload - The initial room creation payload.
   * @param roomOwner - The ID of the room owner.
   * @returns An object containing:
   * - `body`: The modified payload ready for the Matrix `createRoom` API.
   * - `ownerDemotionLevel`: The power level to which the owner should be demoted after room creation.
   * @private
   */
  private _prepareCreateRoomBody = (
    payload: Partial<CreateRoomPayload>,
    roomOwner: string
  ): { body: Partial<CreateRoomPayload>; ownerDemotionLevel?: number } => {
    this.logger.silly('Entering _prepareCreateRoomBody method.', {
      payloadKeys: Object.keys(payload || {}),
      roomOwner
    })

    // STEP 1: Normalize the payload (apply defaults, enforce rules)
    const normalizedPayload = this._normalizePayload(payload)

    this.logger.debug('Payload normalized.', {
      originalPreset: payload.preset,
      normalizedPreset: normalizedPayload.preset,
      normalizedVisibility: normalizedPayload.visibility,
      normalizedIsDirect: normalizedPayload.is_direct
    })

    // STEP 2: Map preset for Matrix server (channels → standard presets)
    const matrixPreset = this._mapPresetForMatrix(normalizedPayload.preset)

    if (matrixPreset !== normalizedPayload.preset) {
      this.logger.info('Preset mapped for Matrix server compatibility.', {
        originalPreset: normalizedPayload.preset,
        mappedPreset: matrixPreset
      })
    }

    // STEP 3: Build initial body with mapped preset for Matrix server
    let body: Partial<CreateRoomPayload> = {
      ...normalizedPayload,
      preset: matrixPreset as any // Use mapped preset
    }

    let ownerDemotionLevel: number | undefined

    // STEP 4: Determine power level content using ORIGINAL preset (before mapping)
    const defaultPowerLevelContent =
      this._getDefaultPowerLevelContent(normalizedPayload)
    this.logger.debug(
      'Determined default power level content for room creation.',
      {
        preset: normalizedPayload.preset,
        is_direct: normalizedPayload.is_direct,
        contentDefined: !!defaultPowerLevelContent
      }
    )

    if (defaultPowerLevelContent) {
      // Deep clone the default power level content from config to allow modification
      // (e.g., deleting creator_becomes) without affecting the original config object.
      const currentPowerLevelContent = deepClone(defaultPowerLevelContent)

      // Extract the 'creator_becomes' level and remove it from the content,
      // as it's a custom field not part of the standard Matrix power_levels event.
      ownerDemotionLevel = this._extractCreatorBecomes(currentPowerLevelContent)
      this.logger.debug('Extracted owner demotion level.', {
        ownerDemotionLevel: ownerDemotionLevel ?? 'N/A'
      })

      // Identify invited users from the payload.
      const invitedUsers = Array.isArray(payload.invite) ? payload.invite : []
      this.logger.debug('Processing invited users for initial power levels.', {
        inviteCount: invitedUsers.length
      })

      // Get the initial users defined in the power level content (if any).
      const initialUsers = currentPowerLevelContent.users || {}
      this.logger.silly('Initial explicit users in power level content.', {
        userCount: Object.keys(initialUsers).length
      })

      // Calculate the updated user power levels for the initial room state.
      // This ensures the room owner starts at 100 and other invited users get default levels.
      const updatedUsers = invitedUsers
        .filter((invitedUser) => !(invitedUser in initialUsers)) // Only process users not already explicitly defined
        .reduce(
          (usersMap, invitedUser) => {
            // Assign power level: 100 for the room owner, default for others.
            const level =
              invitedUser === roomOwner
                ? 100
                : currentPowerLevelContent.users_default ?? 0
            this.logger.silly(
              'Assigning initial power level to invited user.',
              {
                invitedUser,
                level
              }
            )
            return { ...usersMap, [invitedUser]: level }
          },
          { ...initialUsers, [roomOwner]: 100 }
        )

      // Apply the calculated updated user power levels to the content.
      currentPowerLevelContent.users = updatedUsers
      this.logger.debug(
        'Updated power level content with initial user levels.',
        {
          totalUsers: Object.keys(updatedUsers).length
        }
      )

      // Update the main request body with the prepared power level content override.
      body = {
        ...body,
        power_level_content_override: currentPowerLevelContent
      }
      this.logger.info(
        'Final request body prepared with power level overrides.'
      )
    } else {
      this.logger.warn(
        'No default power level content determined. Room will use Matrix server defaults.'
      )
    }

    this.logger.silly('Exiting _prepareCreateRoomBody method.')
    return { body, ownerDemotionLevel }
  }

  /**
   * Demotes the room owner's power level after room creation.
   * This method fetches the current power levels of the room and then sends an update
   * to set the owner's power level to the specified value, preserving other settings.
   *
   * @param roomId - The ID of the created room.
   * @param authorization - The authorization header.
   * @param roomOwner - The Matrix user ID of the room owner.
   * @param powerLevel - The target power level for the room owner.
   * @private
   */
  private _demoteRoomOwner = async (
    roomId: string,
    authorization: string,
    roomOwner: string,
    powerLevel: number
  ): Promise<void> => {
    this.logger.silly('Entering _demoteRoomOwner method.', {
      roomId,
      roomOwner,
      powerLevel
    })

    // Construct the API URL for updating room power levels.
    const powerLevelUrl = buildUrl(
      this.config.matrix_internal_host,
      this.POWER_LEVEL_STATE_PATH.replace(
        '{roomId}',
        encodeURIComponent(roomId)
      )
    )

    try {
      // First, fetch the current power levels to ensure we don't accidentally overwrite
      // other power level settings (e.g., m.room.join_rules, events, etc.).
      this.logger.debug(
        'Fetching current power levels before demotion to ensure safe update.',
        { url: powerLevelUrl }
      )
      const currentPowerLevelsResponse = await fetch(powerLevelUrl, {
        method: 'GET',
        headers: { Authorization: authorization }
      })

      if (!currentPowerLevelsResponse.ok) {
        // If fetching current power levels fails, log an error and throw to stop the demotion.
        const errorBody = await currentPowerLevelsResponse.clone().text()
        this.logger.error(
          'Failed to fetch current power levels for demotion. Cannot proceed with update.',
          {
            status: currentPowerLevelsResponse.status,
            statusText: currentPowerLevelsResponse.statusText,
            responseBody: errorBody
          }
        )
        // Throw an error to indicate a critical failure in fetching necessary state.
        throw new Error(
          `Failed to fetch current room power levels: ${currentPowerLevelsResponse.status} ${currentPowerLevelsResponse.statusText}`
        )
      }

      let currentPowerLevels: PowerLevelEventContent =
        (await currentPowerLevelsResponse.json()) as PowerLevelEventContent
      this.logger.debug('Successfully fetched current power levels.', {
        currentLevels: JSON.stringify(currentPowerLevels)
      })

      // Prepare the content for demotion.
      // This merges the new owner power level with existing power level settings.
      const demotionContent: PowerLevelEventContent = {
        ...currentPowerLevels, // Preserve existing power level settings like `events`, `state_default`, etc.
        users: {
          ...(currentPowerLevels.users || {}), // Preserve existing user-specific power levels
          [roomOwner]: powerLevel // Set the new power level for the owner
        }
      }

      this.logger.debug('Constructed body for owner demotion.', {
        body: JSON.stringify(demotionContent)
      })
      this.logger.info(
        `Sending power level update to demote owner ${roomOwner} to ${powerLevel}.`
      )

      // Send the PUT request to update the room's power levels.
      const response = await fetch(powerLevelUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization
        },
        body: JSON.stringify(demotionContent)
      })

      if (!response.ok) {
        this.logger.warn(
          `Failed to demote room owner (${roomOwner}) after creation.`,
          {
            status: response.status,
            statusText: response.statusText,
            responseBody: await response.clone().text()
          }
        )
      } else {
        this.logger.info(
          `Successfully demoted room owner (${roomOwner}) to ${powerLevel}.`
        )
      }
    } catch (err: any) {
      // Catch any exceptions during the demotion process.
      this.logger.error(`Exception while demoting room owner (${roomOwner}).`, {
        message: err.message,
        stack: err.stack,
        errorName: err.name
      })
      // Re-throw the error to propagate the failure up the call stack if it's a critical issue.
      throw err
    } finally {
      this.logger.silly('Exiting _demoteRoomOwner method.')
    }
  }

  /**
   * Normalizes the room creation payload by applying defaults and enforcing business rules.
   *
   * Default application logic:
   * - No preset, no visibility → preset: private_chat, visibility: private
   * - Only visibility → derive preset from visibility
   * - Only preset → derive visibility from preset
   *
   * Business rules:
   * - is_direct defaults to false when not provided
   * - Channel presets (private_channel, public_channel) force is_direct to false
   * - Unknown preset values are treated as if no preset was given
   *
   * @param payload - The original room creation payload
   * @returns Normalized payload with preset, visibility, and is_direct set
   * @private
   */
  private _normalizePayload = (
    payload: Partial<CreateRoomPayload>
  ): Partial<CreateRoomPayload> & {
    preset:
      | 'private_chat'
      | 'public_chat'
      | 'trusted_private_chat'
      | 'private_channel'
      | 'public_channel'
    visibility: 'public' | 'private'
    is_direct: boolean
  } => {
    this.logger.silly('Entering _normalizePayload method.', {
      originalPreset: payload.preset,
      originalVisibility: payload.visibility,
      originalIsDirect: payload.is_direct
    })

    let preset = payload.preset
    let visibility = payload.visibility
    let is_direct = payload.is_direct

    // Treat unknown preset values as if no preset was given
    const validPresets = [
      'private_chat',
      'public_chat',
      'trusted_private_chat',
      'private_channel',
      'public_channel'
    ]
    if (preset && !validPresets.includes(preset)) {
      this.logger.warn(
        'Unknown preset value, treating as if no preset was provided.',
        { preset }
      )
      preset = undefined
    }

    // Step 1: Apply defaults based on what's missing
    if (!visibility && !preset) {
      this.logger.debug(
        'No preset or visibility provided, applying defaults: preset=private_chat, visibility=private'
      )
      preset = 'private_chat'
      visibility = 'private'
    } else if (!visibility && preset) {
      this.logger.debug(
        'Only preset provided, deriving visibility from preset.'
      )
      visibility = this._getVisibilityFromPreset(preset)
    } else if (visibility && !preset) {
      this.logger.debug(
        'Only visibility provided, deriving preset from visibility.'
      )
      preset = this._getPresetFromVisibility(visibility)
    } else {
      this.logger.debug('Both preset and visibility provided, using as-is.')
    }

    // Step 2: Validate and enforce is_direct restrictions
    const isChannelPreset =
      preset === 'private_channel' || preset === 'public_channel'

    if (isChannelPreset && is_direct === true) {
      this.logger.warn(
        'is_direct=true not allowed for channel presets, forcing to false.',
        {
          preset,
          originalIsDirect: is_direct
        }
      )
      is_direct = false
    } else if (is_direct === undefined) {
      this.logger.debug('is_direct not provided, defaulting to false.')
      is_direct = false
    }

    this.logger.info('Payload normalized successfully.', {
      preset,
      visibility,
      is_direct
    })

    return {
      ...payload,
      preset: preset!,
      visibility: visibility!,
      is_direct
    }
  }

  /**
   * Determines the appropriate power level configuration based on the room preset and is_direct flag.
   *
   * Logic:
   * 1. Select base preset configuration from config
   * 2. If is_direct=true and preset allows it, apply is_direct overrides
   * 3. Channel presets use their specific configurations
   *
   * @param payload - The normalized room creation payload
   * @returns The appropriate PowerLevelEventContent, or undefined on error
   * @private
   */
  private _getDefaultPowerLevelContent = (
    payload: Partial<CreateRoomPayload>
  ): PowerLevelEventContent | undefined => {
    this.logger.silly('Entering _getDefaultPowerLevelContent method.', {
      preset: payload.preset,
      is_direct: payload.is_direct
    })

    try {
      const { preset, is_direct } = payload

      // Step 1: Select base preset configuration
      let basePowerLevels: PowerLevelEventContent | undefined

      switch (preset) {
        case 'trusted_private_chat':
          this.logger.debug(
            'Using trusted_private_chat (private_group_chat) permissions.'
          )
          basePowerLevels = this.config.room_permissions.private_group_chat
          break

        case 'private_chat':
          this.logger.debug(
            'Using private_chat (private_group_chat) permissions.'
          )
          basePowerLevels = this.config.room_permissions.private_group_chat
          break

        case 'public_chat':
          this.logger.debug(
            'Using public_chat (public_group_chat) permissions.'
          )
          basePowerLevels = this.config.room_permissions.public_group_chat
          break

        case 'private_channel':
          this.logger.debug('Using private_channel permissions.')
          basePowerLevels = this.config.room_permissions.private_channel
          break

        case 'public_channel':
          this.logger.debug('Using public_channel permissions.')
          basePowerLevels = this.config.room_permissions.public_channel
          break

        default:
          this.logger.warn(
            'Unknown preset, falling back to private_group_chat.',
            { preset }
          )
          basePowerLevels = this.config.room_permissions.private_group_chat
      }

      if (!basePowerLevels) {
        this.logger.error(
          'Failed to retrieve base power levels from configuration.',
          { preset }
        )
        return undefined
      }

      // Step 2: Apply is_direct overrides if applicable
      const isChannelPreset =
        preset === 'private_channel' || preset === 'public_channel'

      if (is_direct === true && !isChannelPreset) {
        this.logger.info('Applying is_direct power level overrides.', {
          preset
        })
        return this._applyDirectChatOverrides(basePowerLevels)
      }

      this.logger.debug(
        'Returning base preset power levels without is_direct overrides.'
      )
      return basePowerLevels
    } catch (error: any) {
      this.logger.error(
        'Exception occurred while determining power level content.',
        {
          message: error.message,
          stack: error.stack,
          errorName: error.name,
          preset: payload.preset
        }
      )
      return undefined
    }
  }

  /**
   * Extracts the 'creator_becomes' power level from the provided content and removes this property.
   * This is typically used for a custom field in the payload that is not part of the standard
   * Matrix `m.room.power_levels` event content and needs to be processed separately.
   *
   * @param powerLevelContent - The power level content object from which to extract and delete `creator_becomes`.
   * This object will be modified (the `creator_becomes` property will be deleted).
   * @returns The extracted 'creator_becomes' level, or 90 if the property is not found.
   * @private
   */
  private _extractCreatorBecomes = (
    powerLevelContent: PowerLevelEventContent
  ): number => {
    this.logger.silly('Entering _extractCreatorBecomes method.', {
      contentKeys: Object.keys(powerLevelContent || {})
    })

    // Use a nullish coalescing operator to provide a default of 90 if creator_becomes is undefined or null.
    const level = powerLevelContent.creator_becomes ?? 90
    delete powerLevelContent.creator_becomes
    this.logger.debug(
      'Extracted and removed creator_becomes from power level content.',
      { level }
    )
    this.logger.silly('Exiting _extractCreatorBecomes method.')
    return level
  }

  /**
   * Derives the visibility setting from a given preset.
   *
   * @param preset - The room preset
   * @returns The corresponding visibility ('public' or 'private')
   * @private
   */
  private _getVisibilityFromPreset = (preset: string): 'public' | 'private' => {
    this.logger.silly('Deriving visibility from preset.', { preset })

    switch (preset) {
      case 'public_chat':
      case 'public_channel':
        return 'public'
      case 'private_chat':
      case 'trusted_private_chat':
      case 'private_channel':
      default:
        return 'private'
    }
  }

  /**
   * Derives the preset from a given visibility setting.
   *
   * @param visibility - The room visibility
   * @returns The corresponding preset
   * @private
   */
  private _getPresetFromVisibility = (
    visibility: 'public' | 'private'
  ): 'public_chat' | 'private_chat' => {
    this.logger.silly('Deriving preset from visibility.', { visibility })

    return visibility === 'public' ? 'public_chat' : 'private_chat'
  }

  /**
   * Maps ToM Server custom presets to Matrix-compatible presets.
   * Channel presets are not native to Matrix, so they are mapped to standard presets.
   *
   * @param preset - The ToM Server preset
   * @returns The Matrix-compatible preset
   * @private
   */
  private _mapPresetForMatrix = (preset: string): string => {
    this.logger.silly('Mapping preset for Matrix server.', { preset })

    switch (preset) {
      case 'private_channel':
        return 'private_chat'
      case 'public_channel':
        return 'public_chat'
      default:
        return preset
    }
  }

  /**
   * Applies is_direct power level overrides to the base preset configuration.
   * When is_direct is true, certain power levels are overridden to create a
   * more restrictive direct messaging environment.
   *
   * @param basePowerLevels - The base power levels from the preset configuration
   * @returns Power levels with is_direct overrides applied
   * @private
   */
  private _applyDirectChatOverrides = (
    basePowerLevels: PowerLevelEventContent
  ): PowerLevelEventContent => {
    this.logger.silly('Applying is_direct power level overrides.')

    // Deep clone to avoid mutating the config
    const overriddenLevels = deepClone(basePowerLevels)

    // Apply overrides from the is_direct specification
    overriddenLevels.ban = 100
    overriddenLevels.invite = 100
    overriddenLevels.kick = 100
    overriddenLevels.redact = 100
    overriddenLevels.state_default = 10
    overriddenLevels.users_default = 10

    // Override specific events
    overriddenLevels.events = {
      ...overriddenLevels.events,
      'm.room.avatar': 10,
      'm.room.encryption': 10,
      'm.room.name': 100,
      'm.room.server_acl': 100,
      'm.room.tombstone': 10,
      'm.room.topic': 100
    }

    // Override creator_becomes (for demotion)
    overriddenLevels.creator_becomes = 10

    this.logger.debug('is_direct overrides applied successfully.', {
      originalUsersDefault: basePowerLevels.users_default,
      newUsersDefault: overriddenLevels.users_default
    })

    return overriddenLevels
  }
}
