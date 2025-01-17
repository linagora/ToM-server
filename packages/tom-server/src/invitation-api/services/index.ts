import { type TwakeLogger } from '@twake/logger'
import { Config, type TwakeDB } from '../../types'
import {
  type Invitation,
  type IInvitationService,
  InvitationPayload,
  RoomCreationResponse,
  RoomCreationPayload,
  InsertInvitationPayload
} from '../types'
import { v7 as uuidv7 } from 'uuid'
import { PATH } from '../routes'
import { buildUrl } from '../../utils'

export default class InvitationService implements IInvitationService {
  private readonly EXPIRATION = 24 * 60 * 60 * 1000 // 24 hours
  private readonly MATRIX_INVITE_PATH = '/_matrix/identity/v2/store-invite'
  private readonly MATRIX_ROOM_PATH = '/_matrix/client/v3/createRoom'

  constructor(
    private readonly db: TwakeDB,
    private readonly logger: TwakeLogger,
    private readonly config: Config
  ) {}

  /**
   * Lists all user invitations
   *
   * @param {string} userId - User ID
   * @returns {Promise<Invitation[]>} - List of invitations
   */
  list = async (userId: string): Promise<Invitation[]> => {
    try {
      return this._getUserInvitations(userId)
    } catch (error) {
      this.logger.error(`Failed to list invitations`, { error })

      throw Error('Failed to list invitations')
    }
  }

  /**
   * Sends an invitation
   *
   * @param {invitationPayload} payload - Invitation payload
   * @returns {Promise<void>}
   */
  invite = async (
    payload: InvitationPayload,
    authorization: string
  ): Promise<void> => {
    try {
      const room_id = await this._createPrivateRoom(authorization)

      if (!room_id) {
        throw Error('Failed to create room')
      }

      await this._storeMatrixInvite(payload, authorization, room_id)
      await this._createInvitation({ ...payload, room_id })
    } catch (error) {
      this.logger.error(`Failed to send invitation`, { error })

      throw Error('Failed to send invitation')
    }
  }

  /**
   * Accepts an invitation by token
   *
   * @param {string} id - Invitation token
   * @param {string} authorization - Authorization token
   * @returns {Promise<void>}
   */
  accept = async (id: string): Promise<void> => {
    try {
      const invitation = await this._getInvitationById(id)

      const { expiration } = invitation

      if (parseInt(expiration) < Date.now()) {
        throw Error('Invitation expired')
      }

      await this.db.update('invitations', { accessed: 1 }, 'id', id)
    } catch (error) {
      this.logger.error(`Failed to accept invitation`, { error })

      throw Error('Failed to accept invitation')
    }
  }

  /**
   * Generates an invitation link
   *
   * @param {invitationPayload} payload - Invitation payload
   * @param {string} authorization - Authorization token
   * @returns {Promise<string>} - Invitation link
   */
  generateLink = async (
    payload: InvitationPayload,
    authorization: string
  ): Promise<string> => {
    try {
      const room_id = await this._createPrivateRoom(authorization)

      if (!room_id) {
        throw Error('Failed to create room')
      }

      await this._storeMatrixInvite(payload, authorization, room_id)
      const token = await this._createInvitation(payload)

      return buildUrl(this.config.base_url, `${PATH}/${token}`)
    } catch (error) {
      this.logger.error(`Failed to generate invitation link`, { error })

      throw Error('Failed to generate invitation link')
    }
  }

  /**
   * Creates an invitation
   *
   * @param {invitationPayload} payload - Invitation payload
   * @returns {Promise<string>} - Invitation token
   */
  private _createInvitation = async (
    payload: InsertInvitationPayload
  ): Promise<string> => {
    try {
      const token = uuidv7()

      await this.db.insert('invitations', {
        ...payload,
        id: token,
        expiration: `${Date.now() + this.EXPIRATION}`,
        accessed: 0
      })

      return token
    } catch (error) {
      this.logger.error(`Failed to create invitation`, { error })

      throw Error('Failed to create invitation')
    }
  }

  /**
   * Creates a private room
   *
   * @param {string} authorization - Authorization token
   * @returns {Promise<string>} - Room ID
   */
  private _createPrivateRoom = async (
    authorization: string
  ): Promise<string> => {
    try {
      const response = await fetch(
        buildUrl(this.config.matrix_server, this.MATRIX_ROOM_PATH),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authorization
          },
          body: JSON.stringify({
            is_direct: true,
            preset: 'private_chat'
          } satisfies RoomCreationPayload)
        }
      )

      if (response.status !== 200) {
        throw Error('Failed to create room')
      }

      const { room_id } = (await response.json()) as RoomCreationResponse

      return room_id
    } catch (error) {
      this.logger.error(`Failed to create room`, { error })

      throw Error('Failed to create room')
    }
  }

  /**
   * Gets an invitation by ID
   *
   * @param {string} id - Invitation ID
   * @returns {Promise<Invitation>} - Invitation
   */
  private _getInvitationById = async (id: string): Promise<Invitation> => {
    try {
      const invitations = (await this.db.get(
        'invitations',
        ['id', 'sender', 'recepient', 'medium', 'expiration', 'accessed'],
        { id }
      )) as unknown as Invitation[]

      if (!invitations || !invitations.length) {
        throw Error('Invitation not found')
      }

      return invitations[0]
    } catch (error) {
      this.logger.error(`Failed to get invitation`, { error })

      throw Error('Failed to get invitation')
    }
  }

  /**
   * Gets all user invitations
   *
   * @param {string} userId - User ID
   * @returns {Promise<Invitation[]>} - List of invitations
   */
  private _getUserInvitations = async (
    userId: string
  ): Promise<Invitation[]> => {
    try {
      const userInvitations = (await this.db.get(
        'invitations',
        [
          'id',
          'sender',
          'recepient',
          'medium',
          'expiration',
          'accessed',
          'room_id'
        ],
        { sender: userId }
      )) as unknown as Invitation[]

      return userInvitations.map((invitation) => ({
        ...invitation,
        accessed: Boolean(invitation.accessed)
      }))
    } catch (error) {
      this.logger.error(`Failed to list invitations`, { error })

      throw Error('Failed to list invitations')
    }
  }

  private _storeMatrixInvite = async (
    payload: InvitationPayload,
    authorization: string,
    room_id: string
  ) => {
    try {
      const medium = payload.medium === 'phone' ? 'msisdn' : payload.medium

      await fetch(
        buildUrl(this.config.base_url, this.MATRIX_INVITE_PATH),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authorization
          },
          body: JSON.stringify({
            medium,
            address: payload.recepient,
            phone: payload.recepient,
            sender: payload.sender,
            room_id
          })
        }
      )
    } catch (error) {
      console.error({ error })
      this.logger.error(`Failed to store matrix invite`, { error })

      throw Error('Failed to store matrix invite')
    }
  }
}
