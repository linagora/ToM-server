import type { TwakeLogger } from '@twake/logger'
import type { Config } from '../../../../types'
import type {
  CreateRoomPayload,
  PowerLevelEventContent
} from '../../../../types'
import { buildUrl } from '../../../../utils'

export default class RoomService {
  private readonly CREATE_ROOM_API_PATH = '/_matrix/client/v3/createRoom'

  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger
  ) {
    this.logger.debug('RoomService initialized with matrix_internal_host', { matrixHost: this.config.matrix_internal_host })
  }

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
    this.logger.debug('RoomService.create called with:', {
      payloadKeys: Object.keys(payload || {}),
      authPreview: authorization.substring(0, 15) + '...'
    })

    try {
      let body = payload
      this.logger.debug('Initial request body for room creation:', {
        initialBodyKeys: Object.keys(body || {})
      })

      const defaultPowerLevelContent = this.getDefaultPowerLevelContent(payload)
      this.logger.debug('Determined default power level content:', {
        preset: payload.preset,
        resolvedContent: JSON.stringify(defaultPowerLevelContent)
      })

      const invitedUsers = Array.isArray(payload.invite) ? payload.invite : []
      this.logger.debug('Extracted invited users from payload:', {
        count: invitedUsers.length,
        invitedUsers: JSON.stringify(invitedUsers)
      })

      if (defaultPowerLevelContent) {
        this.logger.silly('Default power level content found, proceeding to modify users.')
        const initialUsers = defaultPowerLevelContent.users || {}
        this.logger.debug('Initial power level users:', { initialUsers: JSON.stringify(initialUsers) })

        const updatedUsers = invitedUsers
          .filter(invitedUser => {
            const isAlreadyPresent = invitedUser in initialUsers
            this.logger.silly('Filtering invited user:', {
              invitedUser,
              isAlreadyPresent
            })
            return !isAlreadyPresent
          })
          .reduce((users, invitedUser) => {
            const isOwner = invitedUser === roomOwner
            const level = isOwner ? 100 : defaultPowerLevelContent.users_default
            this.logger.debug('Assigning power level for user:', {
              invitedUser,
              isOwner,
              assignedLevel: level
            })
            return { ...users, [invitedUser]: level }
          }, { ...initialUsers, [roomOwner]: 100 })

        this.logger.debug('Updated users power levels for initial_state:', {
          updatedUsers: JSON.stringify(updatedUsers)
        })

        defaultPowerLevelContent.users = updatedUsers

        body = {
          ...body,
          power_level_content_override: defaultPowerLevelContent
        }
        this.logger.debug('Final request body with power_level_content_override:', {
          powerLevelKeys: JSON.stringify(body.power_level_content_override?.users || {})
        })
      } else {
        this.logger.warn('No default power level content determined, proceeding without override.')
      }

      const apiUrl = buildUrl(this.config.matrix_internal_host, this.CREATE_ROOM_API_PATH)
      this.logger.debug('Constructed Matrix API URL:', { url: apiUrl })
      this.logger.info('Sending room creation request to Matrix API.')
      this.logger.silly('Performing fetch call with:', {
        method: 'POST',
        url: apiUrl,
        headers: JSON.stringify({ 'Content-Type': 'application/json', Authorization: 'Bearer [masked]' }),
        body: JSON.stringify(body)
      })

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization
        },
        body: JSON.stringify(body)
      })

      this.logger.debug('Received response from Matrix API:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      })
      this.logger.info('Room creation request completed.')
      this.logger.silly('Exiting RoomService.create method with API response.')
      return response
    } catch (error: any) {
      this.logger.error('Failed to create room due to an exception:', {
        message: error.message,
        stack: error.stack
      })
      this.logger.silly('RoomService.create method caught an error, returning 500 response.')
      return new Response('Failed to create room', { status: 500 })
    }
  }

  private getDefaultPowerLevelContent = (
    payload: Partial<CreateRoomPayload>
  ): PowerLevelEventContent | undefined => {
    this.logger.silly('Entering getDefaultPowerLevelContent method.', {
      payloadKeys: Object.keys(payload || {}),
      inviteLength: payload.invite?.length || 0,
      preset: payload.preset
    })

    try {
      const { preset = undefined } = payload
      const isDirect = payload.invite && payload.invite.length < 2
      this.logger.debug('Checking conditions for default power level content:', {
        preset,
        isDirect
      })

      if (isDirect) {
        this.logger.silly('Returning direct_chat permissions.')
        return this.config.room_permissions.direct_chat
      } else if (preset === 'public_chat') {
        this.logger.silly('Returning public_group_chat permissions.')
        return this.config.room_permissions.public_group_chat
      }

      this.logger.silly('Returning private_group_chat permissions.')
      return this.config.room_permissions.private_group_chat
    } catch (error: any) {
      this.logger.error('Failed to get default power level content:', {
        message: error.message,
        stack: error.stack
      })
      this.logger.silly('getDefaultPowerLevelContent method caught an error, returning undefined.')
      return undefined
    }
  }
}
