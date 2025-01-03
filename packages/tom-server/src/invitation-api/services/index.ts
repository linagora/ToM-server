import { type TwakeLogger } from '@twake/logger'
import { Config, type TwakeDB } from '../../types'
import {
  type Invitation,
  type IInvitationService,
  invitationPayload
} from '../types'
import { v7 as uuidv7 } from 'uuid'
import { PATH } from '../routes'

export default class InvitationService implements IInvitationService {
  private readonly EXPIRATION = 24 * 60 * 60 * 1000 // 24 hours
  private readonly MATRIX_INVITE_PATH = '/_matrix/identity/v2/store-invite'

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
      const userInvitations = (await this.db.get(
        'invitations',
        ['id', 'sender', 'recepient', 'medium', 'expiration', 'accessed'],
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

  /**
   * Sends an invitation
   *
   * @param {invitationPayload} payload - Invitation payload
   * @returns {Promise<void>}
   */
  invite = async (
    payload: invitationPayload,
    authorization: string
  ): Promise<void> => {
    try {
      await this.db.insert('invitations', {
        ...payload,
        expiration: Date.now() + this.EXPIRATION,
        accessed: 0
      })

      await fetch(`${this.config.matrix_server}/${this.MATRIX_INVITE_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization
        },
        body: JSON.stringify({
          medium: payload.medium,
          address: payload.recepient,
          sender: payload.sender
          // TODO: add room_id
        })
      })
    } catch (error) {
      this.logger.error(`Failed to send invitation`, { error })

      throw Error('Failed to send invitation')
    }
  }

  /**
   * Accepts an invitation by token
   *
   * @param {string} token - Invitation token
   * @returns {Promise<void>}
   */
  accept = async (token: string): Promise<void> => {
    try {
      const invitations = (await this.db.get(
        'invitations',
        ['id', 'sender', 'recepient', 'medium', 'expiration', 'accessed'],
        { id: token }
      )) as unknown as Invitation[]

      if (!invitations || !invitations.length) {
        throw Error('Invitation not found')
      }

      const { expiration } = invitations[0]

      if (expiration < Date.now()) {
        throw Error('Invitation expired')
      }

      await this.db.update('invitations', { accessed: 1 }, 'id', token)
    } catch (error) {
      this.logger.error(`Failed to accept invitation`, { error })

      throw Error('Failed to accept invitation')
    }
  }

  /**
   * Generates an invitation link
   *
   * @param {invitationPayload} payload - Invitation payload
   * @returns {Promise<string>} - Invitation link
   */
  generateLink = async (payload: invitationPayload): Promise<string> => {
    try {
      const token = await this._createInvitation(payload)

      return `${this.config.base_url}/${PATH}/${token}`
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
    payload: invitationPayload
  ): Promise<string> => {
    try {
      const token = uuidv7()

      await this.db.insert('invitations', {
        ...payload,
        id: token,
        expiration: Date.now() + this.EXPIRATION,
        accessed: 0
      })

      return token
    } catch (error) {
      this.logger.error(`Failed to create invitation`, { error })

      throw Error('Failed to create invitation')
    }
  }
}
