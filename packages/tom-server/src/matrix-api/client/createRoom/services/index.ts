import type { TwakeLogger } from '@twake/logger'
import type { Config } from '../../../../types'
import type {
  CreateRoomPayload,
  PowerLevelEventContent,
  PresetConfig
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
  private readonly ROOM_DIRECTORY_PATH =
    '/_matrix/client/v3/directory/room/{alias}'
  private readonly BAN_PATH = '/_matrix/client/v3/rooms/{roomId}/ban'
  private readonly LEAVE_PATH = '/_matrix/client/v3/rooms/{roomId}/leave'

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
    this.logger.debug('[RoomService] createroom_proxy config', {
      encryption: this.config.features?.createroom_proxy?.encryption,
      defaultPreset: this.config.features?.createroom_proxy?.default_preset,
      presets: this.validPresets,
      hasIsDirectMask: !!this.config.features?.createroom_proxy?.is_direct_mask
    })
  }

  private get maxRetries(): number {
    return this.config.features?.createroom_proxy?.on_failure?.max_retries ?? 3
  }

  private get nukeRoom(): boolean {
    return this.config.features?.createroom_proxy?.on_failure?.nuke_room ?? true
  }

  private get validPresets(): string[] {
    return (this.config.features?.createroom_proxy?.presets ?? []).map(
      (p) => p.name
    )
  }

  /** Finds a preset config entry by name. */
  private _findPreset = (name: string): PresetConfig | undefined => {
    return (this.config.features?.createroom_proxy?.presets ?? []).find(
      (p) => p.name === name
    )
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
      const { body, ownerDemotionLevel } = this._prepareCreateRoomBody(
        payload,
        roomOwner
      )

      const apiUrl = buildUrl(
        this.config.matrix_internal_host,
        this.CREATE_ROOM_API_PATH
      )

      this.logger.info('Sending room creation request to Matrix API.', {
        url: apiUrl
      })

      // Attempt room creation with retry only on transport-level failures
      let response: Response | undefined
      let roomId: string | undefined
      let lastTransportError: unknown

      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        if (attempt > 0) {
          this.logger.info(`Retrying room creation (attempt ${attempt}).`)

          // Alias guard: if alias provided, check if room was already created
          if (body.room_alias_name) {
            const recovered = await this._recoverRoomByAlias(
              body.room_alias_name,
              authorization
            )
            if (recovered !== undefined) {
              roomId = recovered
              this.logger.info(
                'Room already exists via alias guard, skipping retry.',
                { roomId }
              )
              break
            }
          }
        }

        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: authorization
            },
            body: JSON.stringify(body)
          })

          // Any HTTP response (including 5xx) is not retried
          break
        } catch (transportError) {
          lastTransportError = transportError
          this.logger.warn(
            `Transport error on room creation attempt ${attempt}.`,
            { error: transportError }
          )
          if (attempt === this.maxRetries) {
            this.logger.error(
              'All retries exhausted for room creation due to transport errors.'
            )
            throw transportError
          }
        }
      }

      if (response === undefined && roomId === undefined) {
        throw lastTransportError
      }

      // Room recovered from alias guard — proceed directly to demotion
      if (roomId !== undefined) {
        if (ownerDemotionLevel !== undefined) {
          await this._demoteRoomOwnerWithRetry(
            roomId,
            authorization,
            roomOwner,
            ownerDemotionLevel,
            payload.invite ?? []
          )
        }
        return new Response(JSON.stringify({ room_id: roomId }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (!response!.ok) {
        this.logger.warn(
          'Matrix API responded with an error during room creation.',
          {
            status: response!.status,
            statusText: response!.statusText,
            responseBody: await response!.clone().text()
          }
        )
        return response!
      }

      this.logger.info('Room creation request completed successfully.')

      const createData = (await response!.clone().json()) as {
        room_id: string
      }
      roomId = createData.room_id
      this.logger.info(`Room created with ID: ${roomId}.`)

      if (ownerDemotionLevel !== undefined) {
        this.logger.info(
          `Demoting room owner ${roomOwner} to power level ${ownerDemotionLevel}.`
        )
        await this._demoteRoomOwnerWithRetry(
          roomId,
          authorization,
          roomOwner,
          ownerDemotionLevel,
          payload.invite ?? []
        )
      }

      return response!
    } catch (error: any) {
      this.logger.error(
        'Failed to create room due to an unhandled exception.',
        {
          message: error.message,
          stack: error.stack,
          errorName: error.name,
          originalPayloadKeys: Object.keys(payload || {}),
          authPreview: authorization.substring(0, 15) + '...'
        }
      )
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

    const normalizedPayload = this._normalizePayload(payload)

    this.logger.debug('Payload normalized.', {
      originalPreset: payload.preset,
      normalizedPreset: normalizedPayload.preset,
      normalizedVisibility: normalizedPayload.visibility,
      normalizedIsDirect: normalizedPayload.is_direct
    })

    const matrixPreset = this._mapPresetForMatrix(normalizedPayload.preset)

    if (matrixPreset !== normalizedPayload.preset) {
      this.logger.info('Preset mapped for Matrix server compatibility.', {
        originalPreset: normalizedPayload.preset,
        mappedPreset: matrixPreset
      })
    }

    let body: Partial<CreateRoomPayload> = {
      ...normalizedPayload,
      preset: matrixPreset
    }

    let ownerDemotionLevel: number | undefined

    const defaultPowerLevelContent =
      this._getDefaultPowerLevelContent(normalizedPayload)

    if (defaultPowerLevelContent) {
      const currentPowerLevelContent = deepClone(defaultPowerLevelContent)

      ownerDemotionLevel = this._extractCreatorBecomes(currentPowerLevelContent)
      this.logger.debug('Extracted owner demotion level.', {
        ownerDemotionLevel: ownerDemotionLevel ?? 'N/A'
      })

      const invitedUsers = Array.isArray(payload.invite) ? payload.invite : []
      const initialUsers = currentPowerLevelContent.users || {}

      const updatedUsers = invitedUsers
        .filter((invitedUser) => !(invitedUser in initialUsers))
        .reduce(
          (usersMap, invitedUser) => {
            const level =
              invitedUser === roomOwner
                ? 100
                : currentPowerLevelContent.users_default ?? 0
            return { ...usersMap, [invitedUser]: level }
          },
          { ...initialUsers, [roomOwner]: 100 }
        )

      currentPowerLevelContent.users = updatedUsers

      body = {
        ...body,
        power_level_content_override: currentPowerLevelContent
      }
    } else {
      this.logger.warn(
        'No default power level content determined. Room will use Matrix server defaults.'
      )
    }

    this._applyEncryptionPolicy(body)

    this.logger.debug('[createRoom] Final body to send to Synapse', {
      body: JSON.stringify(body)
    })

    return { body, ownerDemotionLevel }
  }

  /**
   * Enforces the encryption policy from config on the room creation body.
   * - 'enforced': injects m.room.encryption initial state event if not already present
   * - 'disabled': removes any m.room.encryption from initial_state
   * - 'allowed' (default): no-op
   *
   * @param body - The payload to be sent to the homeserver containing the room creation settings
   * @private
   */
  private _applyEncryptionPolicy = (body: Partial<CreateRoomPayload>): void => {
    const policy =
      this.config.features?.createroom_proxy?.encryption ?? 'allowed'

    if (policy === 'allowed') return

    if (policy === 'enforced') {
      const alreadySet = (body.initial_state ?? []).some(
        (e) => e.type === 'm.room.encryption'
      )
      if (!alreadySet) {
        body.initial_state = [
          ...(body.initial_state ?? []),
          {
            type: 'm.room.encryption',
            state_key: '',
            content: { algorithm: 'm.megolm.v1.aes-sha2' }
          }
        ]
        this.logger.info(
          'Encryption enforced: injected m.room.encryption event.'
        )
      }
      return
    }

    if (policy === 'disabled') {
      body.initial_state = (body.initial_state ?? []).filter(
        (e) => e.type !== 'm.room.encryption'
      )
      this.logger.info(
        'Encryption disabled: stripped m.room.encryption from initial_state.'
      )
    }
  }

  /**
   * Demotes the room owner after creation, with retry and optional nuke on failure.
   */
  private _demoteRoomOwnerWithRetry = async (
    roomId: string,
    authorization: string,
    roomOwner: string,
    powerLevel: number,
    invitees: string[]
  ): Promise<void> => {
    let lastError: unknown

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await this._demoteRoomOwner(
          roomId,
          authorization,
          roomOwner,
          powerLevel
        )
        return
      } catch (err) {
        lastError = err
        this.logger.warn(
          `Demotion attempt ${attempt} failed for room ${roomId}.`,
          { err }
        )
      }
    }

    this.logger.error('All demotion retries exhausted.', {
      roomId,
      lastError
    })

    if (this.nukeRoom) {
      this.logger.info('Nuking room: banning invitees and leaving.', {
        roomId
      })
      await this._nukeRoom(roomId, authorization, roomOwner, invitees)
    }

    throw new Error('Impossible to apply requested preset permissions')
  }

  /**
   * Bans all invitees and makes the owner leave the room (nuke on demotion failure).
   */
  private _nukeRoom = async (
    roomId: string,
    authorization: string,
    roomOwner: string,
    invitees: string[]
  ): Promise<void> => {
    const banUrl = buildUrl(
      this.config.matrix_internal_host,
      this.BAN_PATH.replace('{roomId}', encodeURIComponent(roomId))
    )
    const leaveUrl = buildUrl(
      this.config.matrix_internal_host,
      this.LEAVE_PATH.replace('{roomId}', encodeURIComponent(roomId))
    )
    const headers = {
      'Content-Type': 'application/json',
      Authorization: authorization
    }

    for (const userId of invitees) {
      if (userId === roomOwner) continue
      try {
        await fetch(banUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ user_id: userId })
        })
      } catch (err) {
        this.logger.warn(`Failed to ban ${userId} during nuke.`, { err })
      }
    }

    try {
      await fetch(leaveUrl, { method: 'POST', headers, body: '{}' })
    } catch (err) {
      this.logger.warn('Failed to leave room during nuke.', { err })
    }
  }

  /**
   * Demotes the room owner's power level after room creation.
   */
  private _demoteRoomOwner = async (
    roomId: string,
    authorization: string,
    roomOwner: string,
    powerLevel: number
  ): Promise<void> => {
    const powerLevelUrl = buildUrl(
      this.config.matrix_internal_host,
      this.POWER_LEVEL_STATE_PATH.replace(
        '{roomId}',
        encodeURIComponent(roomId)
      )
    )

    const currentPowerLevelsResponse = await fetch(powerLevelUrl, {
      method: 'GET',
      headers: { Authorization: authorization }
    })

    if (!currentPowerLevelsResponse.ok) {
      const errorBody = await currentPowerLevelsResponse.clone().text()
      this.logger.error('Failed to fetch current power levels for demotion.', {
        status: currentPowerLevelsResponse.status,
        statusText: currentPowerLevelsResponse.statusText,
        responseBody: errorBody
      })
      throw new Error(
        `Failed to fetch current room power levels: ${currentPowerLevelsResponse.status} ${currentPowerLevelsResponse.statusText}`
      )
    }

    const currentPowerLevels: PowerLevelEventContent =
      (await currentPowerLevelsResponse.json()) as PowerLevelEventContent

    const demotionContent: PowerLevelEventContent = {
      ...currentPowerLevels,
      users: {
        ...(currentPowerLevels.users || {}),
        [roomOwner]: powerLevel
      }
    }

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
      throw new Error(
        `Demotion PUT failed: ${response.status} ${response.statusText}`
      )
    }

    this.logger.info(
      `Successfully demoted room owner (${roomOwner}) to ${powerLevel}.`
    )
  }

  /**
   * Attempts to recover an existing room's ID via its alias.
   * Returns the room_id if found, undefined otherwise.
   */
  private _recoverRoomByAlias = async (
    roomAlias: string,
    authorization: string
  ): Promise<string | undefined> => {
    try {
      const encodedAlias = encodeURIComponent(`#${roomAlias}`)
      const url = buildUrl(
        this.config.matrix_internal_host,
        this.ROOM_DIRECTORY_PATH.replace('{alias}', encodedAlias)
      )
      const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: authorization }
      })
      if (response.ok) {
        const data = (await response.json()) as { room_id?: string }
        if (data.room_id) {
          return data.room_id
        }
      }
    } catch {
      // Alias lookup failure is non-fatal
    }
    return undefined
  }

  /**
   * Normalizes the room creation payload by applying defaults and enforcing business rules.
   *
   * @param payload - The original room creation payload
   * @returns Normalized payload with preset, visibility, and is_direct set
   * @private
   */
  private _normalizePayload = (
    payload: Partial<CreateRoomPayload>
  ): Partial<CreateRoomPayload> & {
    preset: string
    visibility: 'public' | 'private'
    is_direct: boolean
  } => {
    let preset = payload.preset
    let visibility = payload.visibility
    let is_direct = payload.is_direct

    if (preset && !this.validPresets.includes(preset)) {
      this.logger.warn(
        'Unknown preset value, treating as if no preset was provided.',
        { preset }
      )
      preset = undefined
    }

    if (!visibility && !preset) {
      const defaultPreset =
        this.config.features?.createroom_proxy?.default_preset ?? 'private_chat'
      preset = this.validPresets.includes(defaultPreset)
        ? defaultPreset
        : 'private_chat'
      visibility = this._getVisibilityFromPreset(preset as string)
    } else if (!visibility && preset) {
      visibility = this._getVisibilityFromPreset(preset)
    } else if (visibility && !preset) {
      preset = visibility === 'public' ? 'public_chat' : 'private_chat'
    }

    const presetConfig = preset ? this._findPreset(preset) : undefined
    const allowIsDirect = presetConfig?.allow_is_direct ?? false

    if (is_direct === true && !allowIsDirect) {
      this.logger.warn(
        'is_direct=true not allowed for this preset, forcing to false.',
        { preset, originalIsDirect: is_direct }
      )
    }

    is_direct = allowIsDirect && is_direct === true

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
    try {
      const { preset, is_direct } = payload

      const basePowerLevels = preset ? this._findPreset(preset) : undefined

      if (!basePowerLevels) {
        this.logger.warn(
          'No power level config found for preset, using private_chat fallback.',
          { preset }
        )
        return this._findPreset('private_chat')
      }

      // Apply is_direct overrides only when the preset allows it (per config)
      if (is_direct === true && (basePowerLevels.allow_is_direct ?? false)) {
        this.logger.info('Applying is_direct power level overrides.', {
          preset
        })
        return this._applyDirectChatOverrides(basePowerLevels)
      }

      return basePowerLevels
    } catch (error: any) {
      this.logger.error(
        'Exception occurred while determining power level content.',
        {
          message: error.message,
          stack: error.stack,
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
    powerLevelContent: PowerLevelEventContent & { name?: string }
  ): number => {
    const level = powerLevelContent.creator_becomes ?? 90
    delete powerLevelContent.creator_becomes
    delete powerLevelContent.synapse_preset
    delete powerLevelContent.default_visibility
    delete powerLevelContent.allow_is_direct
    delete powerLevelContent.name
    return level
  }

  /**
   * Derives the visibility setting from a given preset.
   */
  private _getVisibilityFromPreset = (preset: string): 'public' | 'private' => {
    return this._findPreset(preset)?.default_visibility ?? 'private'
  }

  /**
   * Maps a ToM preset name to the Matrix-compatible preset name.
   * Reads synapse_preset from the preset's own config entry; falls back to the preset name itself.
   */
  private _mapPresetForMatrix = (preset: string): string => {
    return this._findPreset(preset)?.synapse_preset ?? preset
  }

  /**
   * Applies is_direct power level overrides from config to the base preset configuration.
   * Only keys present in the is_direct config block override base preset values.
   *
   * @param basePowerLevels - The base power levels from the preset configuration
   * @returns Power levels with is_direct overrides applied
   * @private
   */
  private _applyDirectChatOverrides = (
    basePowerLevels: PowerLevelEventContent
  ): PowerLevelEventContent => {
    const { events: maskEvents, ...topLevelMask } =
      this.config.features?.createroom_proxy?.is_direct_mask ?? {}
    const overriddenLevels = deepClone(basePowerLevels)

    Object.assign(overriddenLevels, topLevelMask)

    if (maskEvents) {
      overriddenLevels.events = { ...overriddenLevels.events, ...maskEvents }
    }

    this.logger.debug('is_direct overrides applied successfully.', {
      originalUsersDefault: basePowerLevels.users_default,
      newUsersDefault: overriddenLevels.users_default
    })

    return overriddenLevels
  }
}
