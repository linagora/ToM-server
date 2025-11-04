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
    this.logger.debug('RoomService initialized.', {
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
   * This function calculates initial power levels for invited users and the room owner,
   * and determines the owner's demotion level after room creation.
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

    // Start with a deep clone of the original payload to avoid modifying the input object.
    let body: Partial<CreateRoomPayload> = deepClone(payload)
    let ownerDemotionLevel: number | undefined

    // Determine the base power level content based on room preset or direct chat status.
    const defaultPowerLevelContent = this._getDefaultPowerLevelContent(payload)
    this.logger.debug(
      'Determined default power level content for room creation.',
      {
        preset: payload.preset,
        content: defaultPowerLevelContent
          ? JSON.stringify(defaultPowerLevelContent)
          : 'undefined'
      }
    )

    if (defaultPowerLevelContent) {
      // Deep clone the default power level content from config to allow modification
      // (e.g., deleting creator_becomes) without affecting the original config object.
      const currentPowerLevelContent = deepClone(defaultPowerLevelContent)

      // Extract the 'creator_becomes' level and remove it from the content,
      // as it's a custom field not part of the standard Matrix power_levels event.
      ownerDemotionLevel = this._extractCreatorBecomes(currentPowerLevelContent)
      this.logger.debug(
        'Extracted owner demotion level from power level content.',
        { level: ownerDemotionLevel }
      )

      // Identify invited users from the payload.
      const invitedUsers = Array.isArray(payload.invite) ? payload.invite : []
      this.logger.debug(
        'Identified invited users for initial power level assignment.',
        { count: invitedUsers.length }
      )

      // Get the initial users defined in the power level content (if any).
      const initialUsers = currentPowerLevelContent.users || {}
      this.logger.silly('Initial explicit users in power level content.', {
        users: JSON.stringify(initialUsers)
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
                : currentPowerLevelContent.users_default ?? 0 // Use users_default or 0 if not defined
            this.logger.silly(
              'Assigning initial power level to invited user.',
              { invitedUser, level }
            )
            return { ...usersMap, [invitedUser]: level }
          },
          { ...initialUsers, [roomOwner]: 100 }
        ) // Ensure room owner is explicitly set to 100

      // Apply the calculated updated user power levels to the content.
      currentPowerLevelContent.users = updatedUsers
      this.logger.debug(
        'Updated power level content with initial user levels.',
        {
          updatedUsers: JSON.stringify(updatedUsers)
        }
      )

      // Update the main request body with the prepared power level content override.
      // The original code used `power_level_content_override` directly on the payload.
      body = {
        ...body,
        power_level_content_override: currentPowerLevelContent
      }
      this.logger.debug(
        'Final request body updated with power_level_content_override.',
        {
          powerLevelContent: JSON.stringify(currentPowerLevelContent)
        }
      )
    } else {
      this.logger.warn(
        'No default power level content determined. Room will be created without explicit power level overrides from preset.'
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
   * Determines the default power level content based on the room creation payload's preset
   * or whether it's a direct chat.
   *
   * @param payload - The room creation payload.
   * @returns The appropriate PowerLevelEventContent object from the configuration,
   * or `undefined` if an error occurs during determination.
   * @private
   */
  private _getDefaultPowerLevelContent = (
    payload: Partial<CreateRoomPayload>
  ): PowerLevelEventContent | undefined => {
    this.logger.silly('Entering _getDefaultPowerLevelContent method.', {
      payloadKeys: Object.keys(payload || {}),
      inviteLength: payload.invite?.length || 0,
      preset: payload.preset
    })

    try {
      const { preset } = payload
      // A direct chat is typically defined as having exactly one invitee (the other user).
      const isDirect =
        payload.invite && payload.is_direct && payload.invite.length === 1
      this.logger.debug(
        'Checking conditions for default power level content.',
        {
          preset,
          isDirect
        }
      )

      if (isDirect) {
        this.logger.silly('Returning direct_chat permissions from config.')
        return this.config.room_permissions.direct_chat
      } else if (preset === 'public_chat') {
        this.logger.silly(
          'Returning public_group_chat permissions from config.'
        )
        return this.config.room_permissions.public_group_chat
      }

      // Default to private_group_chat permissions if no other conditions are met.
      this.logger.silly(
        'Returning private_group_chat permissions (default) from config.'
      )
      return this.config.room_permissions.private_group_chat
    } catch (error: any) {
      this.logger.error(
        'Failed to get default power level content due to an exception.',
        {
          message: error.message,
          stack: error.stack,
          errorName: error.name
        }
      )
      // Returning undefined allows the calling function to proceed without a power level override,
      // relying on Matrix server defaults.
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
}
