import type { TwakeLogger } from '@twake/logger'
import type { Config } from '../../../../types'
import type {
  CreateRoomPayload,
  PowerLevelEventContent
} from '../../../../types'
import { buildUrl } from '../../../../utils'

export default class RoomService {
  private readonly CREATE_ROOM_API_PATH = '/_matrix/client/v3/createRoom'

  /**
   * @constructor
   *
   * @param {Config} config
   * @param {TwakeLogger} logger
   */
  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger
  ) {}

  /**
   * Creates a room
   *
   * @param {CreateRoomPayload} payload - the request body.
   * @param {string} authorization - the authorization header.
   * @returns {Promise<void>}
   */
  public create = async (
    payload: CreateRoomPayload,
    authorization: string
  ): Promise<Response> => {
    try {
      let body = payload
      const defaultPowerLevelContent = this.getDefaultPowerLevelContent(payload)

      if (defaultPowerLevelContent) {
        body = {
          ...body,
          power_level_content_override: defaultPowerLevelContent
        }
      }

      return await fetch(
        buildUrl(this.config.matrix_internal_host, this.CREATE_ROOM_API_PATH),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authorization
          },
          body: JSON.stringify(body)
        }
      )
    } catch (error) {
      this.logger.error(`Failed to create room`, error)

      return new Response('Failed to create room', { status: 500 })
    }
  }

  /**
   * Determines the default power level content
   *
   * @param {CreateRoomPayload} payload - the request body.
   * @returns {PowerLevelEventContent | undefined} - the power level content.
   */
  private getDefaultPowerLevelContent = (
    payload: CreateRoomPayload
  ): PowerLevelEventContent | undefined => {
    try {
      const { preset } = payload

      if (payload.invite.length < 2) {
        return this.config.room_permissions.direct_chat
      } else if (preset === 'public_chat') {
        return this.config.room_permissions.public_group_chat
      }

      return this.config.room_permissions.private_group_chat
    } catch (error) {
      this.logger.error(`Failed to get default power level content`, error)
    }
  }
}
