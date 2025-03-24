import type { SendMailOptions } from 'nodemailer'
import { v7 as uuidv7 } from 'uuid'
import { type TwakeLogger } from '@twake/logger'
import type { Config, INotificationService, TwakeDB } from '../../types'
import {
  type Invitation,
  type IInvitationService,
  InvitationPayload,
  RoomCreationResponse,
  RoomCreationPayload,
  medium
} from '../types'
import { buildUrl } from '../../utils'
import NotificationService from '../../utils/services/notification-service'
import { buildEmailBody, buildSmsBody } from '../../utils/helpers'

export default class InvitationService implements IInvitationService {
  private readonly EXPIRATION = 24 * 60 * 60 * 1000 // 24 hours
  private readonly MATRIX_ROOM_PATH = '/_matrix/client/v3/createRoom'

  private notificationService: INotificationService

  constructor(
    private readonly db: TwakeDB,
    private readonly logger: TwakeLogger,
    private readonly config: Config
  ) {
    this.notificationService = new NotificationService(config, logger)
  }

  /**
   * Lists all user invitations
   *
   * @param {string} userId - User ID
   * @returns {Promise<Invitation[]>} - List of invitations
   */
  public list = async (userId: string): Promise<Invitation[]> => {
    try {
      return this._getUserInvitations(userId)
    } catch (error) {
      this.logger.error(`Failed to list invitations`, error)

      throw Error('Failed to list invitations')
    }
  }

  /**
   * Sends an invitation
   *
   * @param {invitationPayload} payload - Invitation payload
   * @returns {Promise<void>}
   */
  public invite = async (payload: InvitationPayload): Promise<void> => {
    try {
      const { medium, recepient, sender } = payload

      const token = await this._createInvitation(payload)
      const link = this._getInvitationUrl(token)

      await this._deliverInvitation(sender, recepient, medium, link)
    } catch (error) {
      this.logger.error(`Failed to send invitation`, error)

      throw Error('Failed to send invitation')
    }
  }

  /**
   * Accepts an invitation by token
   *
   * @param {string} id - Invitation token
   * @param {string} authorization - the auth header
   * @returns {Promise<void>}
   */
  public accept = async (id: string, authorization: string): Promise<void> => {
    try {
      const invitation = await this._getInvitationById(id)
      const { expiration, recepient: threepid } = invitation

      if (parseInt(expiration) < Date.now()) {
        throw Error('Invitation expired')
      }

      await this._processUserInvitations(threepid, authorization)

      await this.db.update('invitations', { accessed: 1 }, 'id', id)
    } catch (error) {
      this.logger.error(`Failed to accept invitation`, error)

      throw Error('Failed to accept invitation')
    }
  }

  /**
   * Generates an invitation link
   *
   * @param {invitationPayload} payload - Invitation payload
   * @returns {Promise<string>} - Invitation link
   */
  public generateLink = async (payload: InvitationPayload): Promise<string> => {
    try {
      const token = await this._createInvitation(payload)

      return this._getInvitationUrl(token)
    } catch (error) {
      this.logger.error(`Failed to generate invitation link`, error)

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
    payload: InvitationPayload
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
      this.logger.error(`Failed to create invitation`, error)

      throw Error('Failed to create invitation')
    }
  }

  /**
   * Creates a private chat between inviter and invitee
   *
   * @param {string} authorization - Authorization token
   * @returns {Promise<string>} - Room ID
   */
  private _createPrivateChat = async (
    authorization: string,
    invitedMxid?: string
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
            preset: 'private_chat',
            ...(invitedMxid ? { invite: [invitedMxid] } : {})
          } satisfies RoomCreationPayload)
        }
      )

      if (response.status !== 200) {
        throw Error('Failed to create room')
      }

      const { room_id } = (await response.json()) as RoomCreationResponse

      return room_id
    } catch (error) {
      this.logger.error(`Failed to create room`, error)

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
      const invitations = (await this.db.get('invitations', ['*'], {
        id
      })) as unknown as Invitation[]

      if (!invitations || !invitations.length) {
        throw Error('Invitation not found')
      }

      return invitations[0]
    } catch (error) {
      this.logger.error(`Failed to get invitation`, error)

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
      const userInvitations = (await this.db.get('invitations', ['*'], {
        sender: userId
      })) as unknown as Invitation[]

      return userInvitations.map((invitation) => ({
        ...invitation,
        accessed: Boolean(invitation.accessed)
      }))
    } catch (error) {
      this.logger.error(`Failed to list invitations`, error)

      throw Error('Failed to list invitations')
    }
  }

  /**
   * Process user all invitations
   *
   * @param {string} address - User address
   * @param {string} authorization - Authorization token
   * @returns {Promise<void>}
   */
  private _processUserInvitations = async (
    address: string,
    authorization: string
  ): Promise<void> => {
    try {
      const invitations = await this._listPendingInvitationToAddress(address)

      for (const { sender, id, expiration } of invitations) {
        try {
          if (parseInt(expiration) < Date.now()) {
            throw Error('Invitation expired')
          }

          await this._createPrivateChat(authorization, sender)
        } catch (error) {
          this.logger.error(`Failed to process invitation: ${id}`, error)
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process invitations`, error)

      throw Error('Failed to process invitations')
    }
  }

  /**
   * List all pending invitations to a user
   *
   * @param {string} address - User address
   * @returns {Promise<Invitation[]>} - List of invitations
   */
  private _listPendingInvitationToAddress = async (
    address: string
  ): Promise<Invitation[]> => {
    try {
      const invitations = (await this.db.get('invitations', ['*'], {
        recepient: address
      })) as unknown as Invitation[]

      return invitations.filter(({ accessed }) => !accessed)
    } catch (error) {
      this.logger.error(`Failed to list invitations`, error)

      throw Error('Failed to list invitations')
    }
  }

  /**
   * Delivers an invitation to the threepid
   *
   * @param {string} to - User address
   * @param {string} medium - Invitation medium
   * @param {string} link - Invitation link
   * @returns {Promise<void>}
   */
  private _deliverInvitation = async (
    sender: string,
    to: string,
    medium: medium,
    link: string
  ): Promise<void> => {
    try {
      if (medium === 'email') {
        const emailTemplatePath = `${this.config.template_dir}/emailInvitation.tpl`

        const text = buildEmailBody(
          emailTemplatePath,
          sender,
          to,
          link,
          this.notificationService.emailFrom
        )

        const emailOptions: SendMailOptions = {
          from: this.notificationService.emailFrom,
          to,
          subject: 'Invitation to join Twake Workplace',
          text
        }

        await this.notificationService.sendEmail(emailOptions)
      } else if (medium === 'phone') {
        const smsTemplatePath = `${this.config.template_dir}/3pidSmsInvitation.tpl`
        const text = buildSmsBody(smsTemplatePath, sender, link)

        if (!text) {
          throw Error('Failed to build SMS body')
        }

        await this.notificationService.sendSMS(to, text)
      }
    } catch (error) {
      this.logger.error(`Failed to deliver invitation`, error)

      throw Error('Failed to deliver invitation')
    }
  }

  /**
   * Gets an invitation URL
   *
   * @param {string} token - Invitation token
   * @returns {string} - Invitation URL
   */
  private _getInvitationUrl = (token: string): string => {
    const url = new URL(this.config.signup_url)
    url.searchParams.set('invitation_token', token)

    return url.toString()
  }
}
