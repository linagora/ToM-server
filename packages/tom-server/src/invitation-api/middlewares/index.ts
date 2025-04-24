import { TwakeLogger } from '@twake/logger'
import { AuthRequest, TwakeDB } from '../../types'
import type { NextFunction, Request, Response } from 'express'
import type { Invitation, InvitationRequestPayload } from '../types'
import validator from 'validator'

export default class invitationApiMiddleware {
  private readonly ONE_HOUR = 60 * 60 * 1000

  constructor(
    private readonly db: TwakeDB,
    private readonly logger: TwakeLogger
  ) {}

  /**
   * Checks the invitation payload
   *
   * @param {Request} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  checkInvitationPayload = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      const {
        body: { contact, medium }
      }: { body: InvitationRequestPayload } = req

      if (!contact) {
        res.status(400).json({ message: 'Recipient is required' })
        return
      }

      if (!medium) {
        res.status(400).json({ message: 'Medium is required' })
        return
      }

      if (medium !== 'email' && medium !== 'phone') {
        res.status(400).json({ message: 'Invalid medium' })
        return
      }

      if (medium === 'email' && !validator.isEmail(contact)) {
        res.status(400).json({ message: 'Invalid email' })
        return
      }

      if (
        medium === 'phone' &&
        (!validator.isMobilePhone(contact) || !contact.startsWith('+'))
      ) {
        res.status(400).json({ message: 'Invalid phone number' })
        return
      }

      next()
    } catch (error) {
      this.logger.error(`Failed to check invitation payload`, { error })

      res.status(400).json({ message: 'Invalid invitation payload' })
    }
  }

  /**
   * Checks if the invitation exists and not expired
   *
   * @param {AuthRequest} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  checkInvitation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        userId,
        params: { id }
      } = req

      if (!id) {
        res.status(400).json({ message: 'Invitation id is required' })
        return
      }

      const invitation = (await this.db.get(
        'invitations',
        ['expiration', 'sender'],
        {
          id
        }
      )) as unknown as Invitation[]

      if (!invitation || !invitation.length) {
        res.status(404).json({ message: 'Invitation not found' })
        return
      }

      const { expiration, sender } = invitation[0]

      if (userId === sender) {
        res
          .status(400)
          .json({ message: 'You cannot accept your own invitation' })
        return
      }

      if (+expiration < Date.now()) {
        res.status(400).json({ message: 'Invitation expired' })
        return
      }

      next()
    } catch (error) {
      this.logger.error(`Failed to check invitation`, { error })

      res.status(400).json({ message: 'Invalid invitation' })
    }
  }

  /**
   * Checks if the invitation is owned by the current user
   *
   * @param {AuthRequest} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  checkInvitationOwnership = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        params: { id }
      } = req

      if (!id) {
        res.status(400).json({ message: 'Invitation id is required' })
        return
      }

      const invitation = await this.db.get('invitations', ['sender'], {
        id
      })

      if (!invitation || !invitation.length) {
        res.status(404).json({ message: 'Invitation not found' })
        return
      }

      const { sender } = invitation[0]

      if (sender !== req.userId) {
        res
          .status(403)
          .json({ message: 'You are not the owner of this invitation' })
        return
      }

      next()
    } catch (error) {
      this.logger.error(`Failed to check invitation ownership`, error)

      res.status(400).json({ message: 'Invalid invitation' })
    }
  }

  /**
   * Rate limits invitations to the same contact
   *
   * @param {Request} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler.
   */
  rateLimitInvitations = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        body: { contact }
      }: { body: InvitationRequestPayload } = req

      const invitations = (await this.db.get(
        'invitations',
        ['id', 'expiration'],
        {
          recipient: contact
        }
      )) as unknown as Invitation[]

      if (!invitations || !invitations.length) {
        next()
        return
      }

      const lastInvitation = invitations[invitations.length - 1]
      const { expiration } = lastInvitation

      if (Date.now() - parseInt(expiration) < this.ONE_HOUR) {
        res
          .status(400)
          .json({ message: 'You already sent an invitation to this contact' })

        return
      }

      next()
    } catch (error) {
      this.logger.error(`Failed to rate limit invitations`, { error })

      res.status(400).json({ message: 'Failed to rate limit invitations' })
    }
  }

  /**
   * Checks the generate invitation link payload
   *
   * @param {Request} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  checkGenerateInvitationLinkPayload = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.body || Object.keys(req.body).length === 0) {
        next()
        return
      }

      return this.checkInvitationPayload(req, res, next)
    } catch (error) {
      this.logger.error(
        `Failed to check generate invitation link payload`,
        error
      )

      res
        .status(400)
        .json({ message: 'Invalid generate invitation link payload' })
    }
  }
}
