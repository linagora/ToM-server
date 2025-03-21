import type { TwakeLogger } from '@twake/logger'
import type { AuthRequest, Config, TwakeDB } from '../../types'
import type { NextFunction, Request, Response } from 'express'
import { IInvitationService, InvitationRequestPayload } from '../types'
import InvitationService from '../services'

export default class InvitationApiController {
  private readonly invitationService: IInvitationService

  constructor(
    db: TwakeDB,
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
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        body: { contact: recepient, medium, room_id = undefined },
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

      await this.invitationService.invite(
        { recepient, medium, sender, room_id },
        authorization
      )

      res.status(200).json({ message: 'Invitation sent' })
    } catch (err) {
      this.logger.error(`Failed to send invitation`, { err })

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

      const { userId } = req

      if (!userId) {
        res.status(400).json({ message: 'User id is required' })
        return
      }

      const { authorization } = req.headers

      if (!authorization) {
        res.status(400).json({ message: 'Authorization header is required' })
        return
      }

      await this.invitationService.accept(id, userId, authorization)

      res.status(200).json({ message: 'Invitation accepted' })
    } catch (err) {
      console.log({ err })
      this.logger.error(`Failed to accept invitation`, { err })

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
        body: { contact: recepient, medium, room_id = undefined },
        userId: sender
      }: { body: InvitationRequestPayload; userId?: string } = req

      if (!sender) {
        throw Error('Sender is required')
      }

      const link = await this.invitationService.generateLink({
        sender,
        recepient,
        medium,
        room_id
      })

      res.status(200).json({ link })
    } catch (err) {
      next(err)
    }
  }
}
