import { TwakeLogger } from '@twake/logger'
import { TwakeDB } from '../../types'
import type { NextFunction, Request, Response } from 'express'
import { InvitationRequestPayload } from '../types'
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
        res.status(400).json({ message: 'Recepient is required' })
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

      if (medium === 'phone' && !validator.isMobilePhone(contact)) {
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
   * @param {Request} req - the request object.
   * @param {Response} res - the response object.
   * @param {NextFunction} next - the next hundler
   */
  checkInvitation = async (
    req: Request,
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

      const invitation = await this.db.get('invitations', ['expiration'], {
        id
      })

      if (!invitation || !invitation.length) {
        res.status(404).json({ message: 'Invitation not found' })
        return
      }

      const { expiration } = invitation[0]

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

      const invitations = await this.db.get(
        'invitations',
        ['id', 'expiration'],
        {
          recepient: contact
        }
      )

      if (!invitations || !invitations.length) {
        next()
        return
      }

      const lastInvitation = invitations[invitations.length - 1]
      const { expiration } = lastInvitation

      if (Date.now() - +expiration < this.ONE_HOUR) {
        res
          .status(400)
          .json({ message: 'you already sent an invitation to this contact' })

        return
      }

      next()
    } catch (error) {
      this.logger.error(`Failed to rate limit invitations`, { error })

      res.status(400).json({ message: 'Failed to rate limit invitations' })
    }
  }
}
