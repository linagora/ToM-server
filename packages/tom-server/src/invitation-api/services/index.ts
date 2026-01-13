import fetch from 'node-fetch'
import type { SendMailOptions } from 'nodemailer'
import { v7 as uuidv7 } from 'uuid'
import type { TwakeLogger } from '@twake-chat/logger'
import type { Config, INotificationService, TwakeDB } from '../../types.ts'
import {
  type Invitation,
  type IInvitationService,
  type InvitationPayload,
  type RoomCreationResponse,
  type RoomCreationPayload,
  type medium,
  type GenerateInvitationLinkResponse,
  type InvitationResponse,
  type GenerateInvitationLinkPayload,
  SMS_FOOTERS
} from '../types.ts'
import { buildUrl } from '../../utils.ts'
import NotificationService from '../../utils/services/notification-service.ts'
import { buildEmailBody, buildSmsBody } from '../../utils/helpers/index.ts'
import UserInfoService from '../../user-info-api/services/index.ts'
import type { MatrixDB, UserDB } from '@twake-chat/matrix-identity-server'

export default class InvitationService implements IInvitationService {
  private readonly INVITATION_TABLE = 'invitations'
  private readonly EXPIRATION = 24 * 60 * 60 * 1000 // 24 hours
  private readonly MATRIX_ROOM_PATH = '/_matrix/client/v3/createRoom'
  private readonly MATRIX_USER_PATH = '/_matrix/client/v3/user'

  private notificationService: INotificationService
  private readonly userInfoService: UserInfoService

  constructor(
    userdb: UserDB,
    private readonly db: TwakeDB,
    matrixdb: MatrixDB,
    private readonly logger: TwakeLogger,
    private readonly config: Config,
    userInfoService?: UserInfoService
  ) {
    this.notificationService = new NotificationService(config, logger)
    this.userInfoService =
      userInfoService ??
      new UserInfoService(userdb, db, matrixdb, config, logger)
    this.logger.info('[InvitationService] Initialized.', {})
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
      this.logger.error(
        `[InvitationService][list] Failed to list invitations`,
        error
      )

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
      this.logger.info(
        `[InvitationService][invite] sending invitation to ${recipient}`
      )
      this.logger.debug(
        `[InvitationService][invite] sending invitation with: ${JSON.stringify(
          payload
        )}`
      )

      token = await this._createInvitation(payload)
      const link = this._getInvitationUrl(token)
      this.logger.info(
        `[InvitationService][invite] Invitation token generated successfully for ${recipient}`
      )
      this.logger.debug(
        `[InvitationService][invite] token: ${token} for ${recipient}`
      )

      this.logger.info(
        `[InvitationService][invite] Invitation link generated successfully for ${recipient}`
      )
      this.logger.debug(
        `[InvitationService][invite] link: ${link} for ${recipient}`
      )

      await this._deliverInvitation(sender, recipient, medium, link)

      return token
    } catch (error) {
      this.logger.error(
        `[InvitationService][invite] Failed to send invitation`,
        error
      )

      if (token) {
        await this._removeInvitation(token)
      }

      throw Error('[InvitationService][invite] Failed to send invitation')
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
      this.logger.error(
        `[InvitationService][accept] Failed to accept invitation`,
        error
      )

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
      this.logger.error(
        `[InvitationService][generateLink] Failed to generate invitation link`,
        error
      )

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
      this.logger.error(
        `[InvitationService][getInvitationStatus] Failed to get invitation status`,
        error
      )

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
      this.logger.error(
        `[InvitationService][removeInvitation] Failed to remove invitation`,
        error
      )

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
      this.logger.error(
        `[InvitationService][_createInvitation] Failed to create invitation`,
        error
      )

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

        this.logger.error(
          '[InvitationService][_createPrivateChat] Failed to create room',
          resp
        )

        throw Error('Failed to create room')
      }

      const { room_id } = (await response.json()) as RoomCreationResponse

      return room_id
    } catch (error) {
      this.logger.error(
        `[InvitationService][_createPrivateChat] Failed to create room`,
        error
      )

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

        this.logger.error(
          '[InvitationService][_markPrivateChatAsDirectMessage] Failed to mark room as direct message',
          resp
        )

        throw Error('Failed to mark room as DM')
      }
    } catch (error) {
      this.logger.error(
        `[InvitationService][_markPrivateChatAsDirectMessage]Failed to mark room as direct message`,
        error
      )

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
      this.logger.error(
        `[InvitationService][_getInvitationById] Failed to get invitation`,
        error
      )

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
      this.logger.error(
        `[InvitationService][_getUserInvitations]Failed to list invitations`,
        error
      )

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
          this.logger.error(
            `[InvitationService][_processInvitationsToAddress] Failed to process invitation`
          )
        }
      }
    } catch (error) {
      this.logger.error(
        `[InvitationService][_processInvitationsToAddress] Failed to process invitations`,
        error
      )

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
      this.logger.error(
        `[InvitationService][_processInvitation] Failed to process invitation: ${id}`,
        error
      )
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
      this.logger.error(
        `[InvitationService][_listPendingInvitationsToAddress] Failed to list invitations`,
        error
      )

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
      this.logger.error(
        `[InvitationService][_getPendingUserInvitesToAddress] Failed to list user invitations to address`,
        error
      )

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
        `[InvitationService][_getPreviouslyGeneratedInviteToAddress] Failed to list generated user invitations to address`,
        error
      )

      return null
    }
  }

  /**
   * Delivers an invitation to the threepid
   *
   * @param {string} sender - Sender user ID
   * @param {string} to - User address
   * @param {string} medium - Invitation medium
   * @param {string} link - Invitation link
   * @returns {Promise<void>}
   */
  private readonly _deliverInvitation = async (
    sender: string,
    to: string,
    medium: medium,
    link: string
  ): Promise<void> => {
    this.logger.info(
      `[InvitationService][_deliverInvitation] Sending invitation to ${to} via ${medium}`
    )
    this.logger.silly(
      `[InvitationService][_deliverInvitation] Invitation link: ${link}`
    )

    const senderName = await this._resolveSenderName(sender)

    if (medium === 'email') {
      await this._sendEmailInvitation(senderName, to, link)
    } else if (medium === 'phone') {
      await this._sendSmsInvitation(senderName, to, link)
    } else {
      this.logger.error(
        `[InvitationService][_deliverInvitation] Unsupported medium: ${medium}`,
        { sender, to, medium, link }
      )
      throw new Error(`Unsupported medium: ${medium}`)
    }

    this.logger.info(
      `[InvitationService][_deliverInvitation] Successfully sent invitation to ${to} via ${medium}`
    )
  }

  /**
   * Resolves sender display name from user ID
   *
   * @param {string} sender - Sender user ID
   * @returns {Promise<string>} - Sender display name or user ID fallback
   */
  private readonly _resolveSenderName = async (
    sender: string
  ): Promise<string> => {
    try {
      this.logger.silly(
        `[InvitationService][_resolveSenderName] Fetching sender info for: ${sender}`
      )
      const senderUserInfo = await this.userInfoService.get(sender)
      const senderName = senderUserInfo?.display_name || sender

      this.logger.debug(
        `[InvitationService][_resolveSenderName] Resolved sender name: ${senderName}`
      )
      return senderName
    } catch (error) {
      this.logger.warn(
        `[InvitationService][_resolveSenderName] Failed to get sender info for ${sender}, using sender ID`,
        { error, sender }
      )
      return sender
    }
  }

  /**
   * Builds email template configuration
   *
   * @param {string} lang - Language code
   * @returns {object} - Email template configuration
   */
  private readonly _buildEmailTemplateConfig = (lang: string) => {
    const templateDir = `${this.config.template_dir}/${lang}/email/invitation`
    const assetsDir = `${templateDir}/assets`
    const cidDomain = 'invite.twake.app'

    this.logger.silly(
      `[InvitationService][_buildEmailTemplateConfig] Template directory: ${templateDir}`
    )

    return {
      htmlPath: `${templateDir}/body.min.html`,
      textPath: `${templateDir}/body.txt`,
      attachments: [
        {
          filename: 'hero.jpg',
          path: `${assetsDir}/hero.jpg`,
          cid: `hero@${cidDomain}`
        },
        {
          filename: 'icon.jpg',
          path: `${assetsDir}/icon.jpg`,
          cid: `icon@${cidDomain}`
        }
      ]
    }
  }

  /**
   * Builds email content (text and HTML)
   *
   * @param {object} templateConfig - Email template configuration
   * @param {string} senderName - Sender display name
   * @param {string} to - Recipient email
   * @param {string} link - Invitation link
   * @returns {object} - Email content with text and html
   */
  private readonly _buildEmailContent = (
    templateConfig: ReturnType<typeof this._buildEmailTemplateConfig>,
    senderName: string,
    to: string,
    link: string
  ) => {
    this.logger.silly(
      `[InvitationService][_buildEmailContent] Building text body from: ${templateConfig.textPath}`
    )
    const text = buildEmailBody(
      templateConfig.textPath,
      senderName,
      to,
      link,
      this.notificationService.emailFrom
    )

    this.logger.silly(
      `[InvitationService][_buildEmailContent] Building HTML body from: ${templateConfig.htmlPath}`
    )
    const html = buildEmailBody(
      templateConfig.htmlPath,
      senderName,
      to,
      link,
      this.notificationService.emailFrom
    )

    if (!text || !html) {
      throw new Error('Failed to build email content: text or html is empty')
    }

    this.logger.debug(
      `[InvitationService][_buildEmailContent] Email content prepared successfully`
    )

    return { text, html }
  }

  /**
   * Sends email invitation
   *
   * @param {string} senderName - Sender display name
   * @param {string} to - Recipient email
   * @param {string} link - Invitation link
   * @returns {Promise<void>}
   */
  private readonly _sendEmailInvitation = async (
    senderName: string,
    to: string,
    link: string
  ): Promise<void> => {
    const lang = 'en' // TODO: invitee language
    this.logger.debug(
      `[InvitationService][_sendEmailInvitation] Using language: ${lang} for ${to}`
    )

    const templateConfig = this._buildEmailTemplateConfig(lang)
    const { text, html } = this._buildEmailContent(
      templateConfig,
      senderName,
      to,
      link
    )

    const emailOptions: SendMailOptions = {
      from: this.notificationService.emailFrom,
      to,
      subject: 'Invitation to join Twake Workplace',
      text,
      html,
      attachments: templateConfig.attachments
    }

    this.logger.debug(
      `[InvitationService][_sendEmailInvitation] Sending email to ${to} from "${senderName}" with ${templateConfig.attachments.length} attachments`
    )

    await this.notificationService.sendEmail(emailOptions)
    this.logger.info(
      `[InvitationService][_sendEmailInvitation] Successfully sent email invitation to ${to}`
    )
  }

  /**
   * Determines SMS footer based on recipient phone number
   *
   * @param {string} phoneNumber - Recipient phone number
   * @returns {string} - SMS footer
   */
  private readonly _getSmsFooter = (phoneNumber: string): string => {
    const isFrenchNumber = /^\+33\d{9}$/.test(phoneNumber)
    const footer = isFrenchNumber ? SMS_FOOTERS.FR : ''

    this.logger.silly(
      `[InvitationService][_getSmsFooter] Phone ${phoneNumber} is ${
        isFrenchNumber ? '' : 'not '
      }French, footer: "${footer}"`
    )

    return footer
  }

  /**
   * Sends SMS invitation
   *
   * @param {string} senderName - Sender display name
   * @param {string} to - Recipient phone number
   * @param {string} link - Invitation link
   * @returns {Promise<void>}
   */
  private readonly _sendSmsInvitation = async (
    senderName: string,
    to: string,
    link: string
  ): Promise<void> => {
    const smsFooter = this._getSmsFooter(to)
    const smsTemplatePath = `${this.config.template_dir}/3pidSmsInvitation.tpl`

    this.logger.silly(
      `[InvitationService][_sendSmsInvitation] Building SMS body from: ${smsTemplatePath}`
    )

    const text = buildSmsBody(smsTemplatePath, senderName, link, smsFooter)

    if (!text) {
      this.logger.error(
        `[InvitationService][_sendSmsInvitation] SMS body is empty after building from template`,
        { senderName, to, link, smsTemplatePath }
      )
      throw new Error('SMS body is empty after building from template')
    }

    this.logger.debug(
      `[InvitationService][_sendSmsInvitation] Sending SMS to ${to} from "${senderName}"`
    )

    await this.notificationService.sendSMS(to, text)
    this.logger.info(
      `[InvitationService][_sendSmsInvitation] Successfully sent SMS invitation to ${to}`
    )
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
      this.logger.error(
        `[InvitationService][_removeInvitation] Failed to remove invitation`,
        error
      )
    }
  }
}
