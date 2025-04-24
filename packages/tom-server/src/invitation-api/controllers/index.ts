import type { TwakeLogger } from '@twake/logger'
import type { AuthRequest, Config, TwakeDB } from '../../types'
import type { NextFunction, Request, Response } from 'express'
import type {
  GenerateInvitationLinkRequestPayload,
  IInvitationService,
  InvitationRequestPayload
} from '../types'
import InvitationService from '../services'

export default class InvitationApiController {
  private readonly invitationService: IInvitationService

  constructor(
    db: TwakeDB,
    private readonly logger: TwakeLogger,
    config: Config
  ) {
    this.invitationService = new InvitationService(db, logger, config)
  }

  /**
   * Sends an invitation to a user
   *
   * @param {Request} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  sendInvitation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        body: { contact: recipient, medium },
        userId: sender
      }: { body: InvitationRequestPayload; userId?: string } = req

      if (!sender) {
        res.status(400).json({ message: 'Sender is required' })
        return
      }

      const { authorization } = req.headers

      if (!authorization) {
        res.status(400).json({ message: 'Authorization header is required' })
        return
      }

      const id = await this.invitationService.invite({
        recipient,
        medium,
        sender
      })

      res.status(200).json({ message: 'Invitation sent', id })
    } catch (err) {
      this.logger.error(`Failed to send invitation`, err)

      next(err)
    }
  }

  /**
   * Accepts an invitation
   *
   * @param {AuthRequest} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  acceptInvitation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params

      if (id.length === 0) {
        res.status(400).json({ message: 'Invitation id is required' })
        return
      }

      const { authorization } = req.headers

      if (!authorization) {
        res.status(400).json({ message: 'Authorization header is required' })
        return
      }

      const { userId } = req

      if (!userId) {
        res.status(400).json({ message: 'User id is required' })
        return
      }

      await this.invitationService.accept(id, userId, authorization)

      res.status(200).json({ message: 'Invitation accepted' })
    } catch (err) {
      this.logger.error(`Failed to accept invitation`, err)

      next(err)
    }
  }

  /**
   * lists the invitations of the currently connected user.
   *
   * @param {Request} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  listInvitations = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req

      if (!userId) {
        res.status(400).json({ message: 'User id is required' })
        return
      }

      const invitations = await this.invitationService.list(userId)

      res.status(200).json({ invitations })
    } catch (err) {
      next(err)
    }
  }

  /**
   * Generates an invitation link
   *
   * @param {Request} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  generateInvitationLink = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        body: { contact: recipient = null, medium = null },
        userId: sender
      }: { body: GenerateInvitationLinkRequestPayload; userId?: string } = req

      if (!sender) {
        throw Error('Sender is required')
      }

      const { link, id } = await this.invitationService.generateLink({
        sender,
        recipient,
        medium
      })

      res.status(200).json({ link, id })
    } catch (err) {
      next(err)
    }
  }

  /**
   * Gets an invitation status
   *
   * @param {Request} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  getInvitationStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params

      if (id.length === 0) {
        res.status(400).json({ message: 'Invitation id is required' })
        return
      }

      const invitation = await this.invitationService.getInvitationStatus(id)

      res.status(200).json({ invitation })
    } catch (err) {
      next(err)
    }
  }

  /**
   * Removes an invitation
   *
   * @param {Request} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  removeInvitation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params

      await this.invitationService.removeInvitation(id)

      res.status(200).json({ message: 'Invitation removed' })
    } catch (err) {
      next(err)
    }
  }
}
