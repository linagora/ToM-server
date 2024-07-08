import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../types'
import type { IActiveContactsApiValidationMiddleware } from '../types'

export default class ActiveContactsApiValidationMiddleWare
  implements IActiveContactsApiValidationMiddleware
{
  /**
   * Check the creation requirements of the active contacts API
   *
   * @param {AuthRequest} req - the request object
   * @param {Response} res - the response object
   * @param {NextFunction} next - the next function
   * @returns {void}
   * @example
   * router.post('/', checkCreationRequirements, create)
   */
  checkCreationRequirements = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      const { contacts } = req.body

      if (contacts === undefined) {
        throw new Error('Missing required fields', {
          cause: 'userId or contacts is missing'
        })
      }

      next()
    } catch (error) {
      res.status(400).json({ message: 'Bad Request' })
    }
  }
}
