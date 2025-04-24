import type { SendMailOptions } from 'nodemailer'
import { v7 as uuidv7 } from 'uuid'
import type { TwakeLogger } from '@twake/logger'
import type { Config, INotificationService, TwakeDB } from '../../types'
import type {
  Invitation,
  IInvitationService,
  InvitationPayload,
  RoomCreationResponse,
  RoomCreationPayload,
  medium,
  GenerateInvitationLinkResponse,
  InvitationResponse,
  GenerateInvitationLinkPayload
} from '../types'
import { buildUrl } from '../../utils'
import NotificationService from '../../utils/services/notification-service'
import { buildEmailBody, buildSmsBody } from '../../utils/helpers'

export default class InvitationService implements IInvitationService {
  private readonly INVITATION_TABLE = 'invitations'
  private readonly EXPIRATION = 24 * 60 * 60 * 1000 // 24 hours
  private readonly MATRIX_ROOM_PATH = '/_matrix/client/v3/createRoom'
  private readonly MATRIX_USER_PATH = '/_matrix/client/v3/user'

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
   * @returns {Promise<InvitationResponse[]>} - List of invitations
   */
  public list = async (userId: string): Promise<InvitationResponse[]> => {
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
  public invite = async (payload: InvitationPayload): Promise<string> => {
    let token: string | undefined

    try {
      const { medium, recipient, sender } = payload

      token = await this._createInvitation(payload)
      const link = this._getInvitationUrl(token)

      await this._deliverInvitation(sender, recipient, medium, link)

      return token
    } catch (error) {
      this.logger.error(`Failed to send invitation`, error)

      if (token) {
        await this._removeInvitation(token)
      }

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
  public accept = async (
    id: string,
    userId: string,
    authorization: string
  ): Promise<void> => {
    try {
      const invitation = (await this._getInvitationById(
        id
      )) as InvitationResponse
      const { expiration, recipient: threepid, accessed } = invitation

      if (expiration < Date.now()) {
        throw Error('Invitation expired')
      }

      if (accessed) {
        throw Error('Invitation already used')
      }

      if (threepid) {
        await this._processInvitationsToAddress(threepid, userId, authorization)
      } else {
        await this._processInvitation(invitation, userId, authorization)
      }
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
  public generateLink = async (
    payload: GenerateInvitationLinkPayload
  ): Promise<GenerateInvitationLinkResponse> => {
    try {
      const invite =
        (await this._getPreviouslyGeneratedInviteToAddress(payload)) ??
        ({ id: await this._createInvitation(payload) } as Invitation)

      return { link: this._getInvitationUrl(invite.id), id: invite.id }
    } catch (error) {
      this.logger.error(`Failed to generate invitation link`, error)

      throw Error('Failed to generate invitation link')
    }
  }

  /**
   * Returns the invitation status
   *
   * @param {string} token - Invitation token
   * @returns {Promise<Invitation>} - Invitation status
   */
  public getInvitationStatus = (token: string): Promise<InvitationResponse> => {
    try {
      return this._getInvitationById(token)
    } catch (error) {
      this.logger.error(`Failed to get invitation status`, error)

      throw error
    }
  }

  /**
   * Removes an invitation
   *
   * @param {string} token - Invitation token
   * @returns {Promise<void>}
   */
  public removeInvitation = async (token: string): Promise<void> => {
    try {
      await this.db.deleteEqual(this.INVITATION_TABLE, 'id', token)
    } catch (error) {
      this.logger.error(`Failed to remove invitation`, error)

      throw new Error('Failed to remove invitation', { cause: error })
    }
  }

  /**
   * Creates an invitation
   *
   * @param {invitationPayload} payload - Invitation payload
   * @returns {Promise<string>} - Invitation token
   */
  private _createInvitation = async (
    payload: GenerateInvitationLinkPayload
  ): Promise<string> => {
    try {
      const token = uuidv7()

      await this.db.insert(this.INVITATION_TABLE, {
        ...(payload as InvitationPayload),
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
    invitedMxid: string
  ): Promise<string> => {
    try {
      const response = await fetch(
        buildUrl(this.config.matrix_server, this.MATRIX_ROOM_PATH),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: authorization
          },
          body: JSON.stringify({
            is_direct: true,
            preset: 'trusted_private_chat',
            invite: [invitedMxid]
          } satisfies RoomCreationPayload)
        }
      )

      if (response.status !== 200) {
        const resp = await response.json()

        this.logger.error('Failed to create room', resp)

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
   * Mark private chat room as direct message
   *
   * @param {string} authorization - Authorization token
   * @param {string} sender - Sender user ID
   * @param {string} recipient - Recipient user ID
   * @param {string} room - Room ID
   * @returns {Promise<void>}
   */
  private _markPrivateChatAsDirectMessage = async (
    authorization: string,
    sender: string,
    recipient: string,
    room: string
  ): Promise<void> => {
    try {
      const response = await fetch(
        buildUrl(
          this.config.matrix_server,
          `${this.MATRIX_USER_PATH}/${sender}/account_data/m.direct`
        ),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: authorization
          },
          body: JSON.stringify({ [recipient]: [room] })
        }
      )

      if (response.status !== 200) {
        const resp = await response.json()

        this.logger.error('Failed to mark room as direct message', resp)

        throw Error('Failed to mark room as DM')
      }
    } catch (error) {
      this.logger.error(`Failed to mark room as direct message`, error)

      throw Error('Failed to mark room as direct message')
    }
  }

  /**
   * Gets an invitation by ID
   *
   * @param {string} id - Invitation ID
   * @returns {Promise<Invitation>} - Invitation
   */
  private _getInvitationById = async (
    id: string
  ): Promise<InvitationResponse> => {
    try {
      const invitations = (await this.db.get(this.INVITATION_TABLE, ['*'], {
        id
      })) as unknown as Invitation[]

      if (!invitations || !invitations.length) {
        throw Error('Invitation not found')
      }

      const invitation = invitations[0]

      return {
        ...invitation,
        accessed: Boolean(invitation.accessed),
        expiration: parseInt(invitation.expiration),
        ...(invitation.matrix_id ? { matrix_id: invitation.matrix_id } : {})
      }
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
  ): Promise<InvitationResponse[]> => {
    try {
      const userInvitations = (await this.db.get(this.INVITATION_TABLE, ['*'], {
        sender: userId
      })) as unknown as Invitation[]

      return userInvitations.map((invitation) => ({
        ...invitation,
        accessed: Boolean(invitation.accessed),
        expiration: parseInt(invitation.expiration),
        ...(invitation.matrix_id ? { matrix_id: invitation.matrix_id } : {})
      }))
    } catch (error) {
      this.logger.error(`Failed to list invitations`, error)

      throw Error('Failed to list invitations')
    }
  }

  /**
   * Process all invitations to address
   *
   * @param {string} address - User address
   * @param {string} userId - the new user id
   * @param {string} authorization - Authorization token
   * @returns {Promise<void>}
   */
  private _processInvitationsToAddress = async (
    address: string,
    userId: string,
    authorization: string
  ): Promise<void> => {
    try {
      const invitations = await this._listPendingInvitationToAddress(address)

      for (const invitation of invitations) {
        try {
          this._processInvitation(invitation, userId, authorization)
        } catch (error) {
          this.logger.error(`Failed to process invitation`)
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process invitations`, error)

      throw Error('Failed to process invitations')
    }
  }

  /**
   * Process a single invitation
   *
   * @param {Invitation} invitation - Invitation
   * @param {string} userId - the new user id
   * @param {string} authorization - Authorization token
   * @returns {Promise<void>}
   */
  private _processInvitation = async (
    invitation: InvitationResponse,
    userId: string,
    authorization: string
  ): Promise<void> => {
    const { sender, id, expiration } = invitation

    try {
      if (expiration < Date.now()) {
        throw Error('Invitation expired')
      }

      /**
       * context: we create a room with the new user and the original invitation sender
       * since we can't perform this action as the original sender the new user creates the room
       */
      const room = await this._createPrivateChat(authorization, sender)

      /**
       * context: we need to transform the created room to a direct message
       * so the sender here is the new user and the receipient is the original invitation sender
       */
      await this._markPrivateChatAsDirectMessage(
        authorization,
        userId,
        sender,
        room
      )

      await this.db.update(
        this.INVITATION_TABLE,
        { accessed: 1, matrix_id: userId },
        'id',
        id
      )
    } catch (error) {
      this.logger.error(`Failed to process invitation: ${id}`, error)
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
  ): Promise<InvitationResponse[]> => {
    try {
      const invitations = (await this.db.get(this.INVITATION_TABLE, ['*'], {
        recipient: address
      })) as unknown as Invitation[]

      return invitations
        .filter(({ accessed, recipient }) => !accessed && recipient === address)
        .map(({ accessed, expiration, ...data }) => ({
          ...data,
          accessed: Boolean(accessed),
          expiration: parseInt(expiration)
        }))
    } catch (error) {
      this.logger.error(`Failed to list invitations`, error)

      throw Error('Failed to list invitations')
    }
  }

  /**
   * List all pending invitations to a user
   *
   * @param {InvitationPayload} payload - Invitation payload
   * @returns {Promise<Invitation[]>} - List of invitations
   */
  private _getPendingUserInvitesToAddress = async ({
    sender,
    recipient,
    medium
  }: GenerateInvitationLinkPayload): Promise<Invitation[] | null> => {
    try {
      const userInvitations = (await this.db.get(this.INVITATION_TABLE, ['*'], {
        sender,
        ...(recipient ? { recipient } : {}),
        ...(medium ? { medium } : {})
      })) as unknown as Invitation[]

      if (userInvitations.length) {
        return userInvitations.filter(
          ({ accessed, recipient: rec, medium: med }) =>
            !accessed && rec === recipient && med === medium
        )
      }

      return null
    } catch (error) {
      this.logger.error(`Failed to list user invitations to address`, error)

      return null
    }
  }

  /**
   * List the latest generated invitation to user
   *
   * @param {GenerateInvitationLinkPayload} payload - Invitation payload
   * @returns {Promise<Invitation | null>} - List of invitations
   */
  private _getPreviouslyGeneratedInviteToAddress = async (
    payload: GenerateInvitationLinkPayload
  ): Promise<Invitation | null> => {
    try {
      const pendingInvitations = await this._getPendingUserInvitesToAddress(
        payload
      )

      if (pendingInvitations) {
        const validInvitations = pendingInvitations
          .filter(({ expiration }) => parseInt(expiration) > Date.now())
          .sort((a, b) => parseInt(b.expiration) - parseInt(a.expiration))

        return validInvitations[0]
      }

      return null
    } catch (error) {
      this.logger.error(
        `Failed to list generated user invitations to address`,
        error
      )

      return null
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

  /**
   * Removes an invitation
   *
   * @param {string} token - Invitation token
   * @returns {Promise<void>}
   */
  private _removeInvitation = async (token: string): Promise<void> => {
    try {
      await this.db.deleteEqual(this.INVITATION_TABLE, 'id', token)
    } catch (error) {
      this.logger.error(`Failed to remove invitation`, error)
    }
  }
}
