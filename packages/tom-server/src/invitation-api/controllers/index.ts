import { type TwakeLogger } from '@twake/logger'
import { AuthRequest, Config, type TwakeDB } from '../../types'
import { type NextFunction, type Request, type Response } from 'express'
import { IInvitationService } from '../types'
import InvitationService from '../services'

export default class InvitationApiController {
  private readonly invitationService: IInvitationService

  constructor(
    private readonly db: TwakeDB,
    private readonly logger: TwakeLogger,
    private readonly config: Config
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
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { body } = req

      await this.invitationService.invite(body)

      res.status(200).json({ message: 'Invitation sent' })
    } catch (err) {
      next(err)
    }
  }

  /**
   * Accepts an invitation
   *
   * @param {Request} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  acceptInvitation = async (
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

      await this.invitationService.accept(id)

      // TODO: redirect to sign-up
      res.redirect(this.config.base_url)
    } catch (err) {
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
      const { body } = req

      const link = await this.invitationService.generateLink(body)

      res.status(200).json({ link })
    } catch (err) {
      next(err)
    }
  }
}
