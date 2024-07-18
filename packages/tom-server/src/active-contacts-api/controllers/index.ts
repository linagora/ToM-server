/* eslint-disable no-useless-return */
import type { Response, NextFunction } from 'express'
import type {
  IActiveContactsService,
  IActiveContactsApiController
} from '../types'
import type { TwakeLogger } from '@twake/logger'
import ActiveContactsService from '../services'
import type { AuthRequest, TwakeDB } from '../../types'

export default class ActiveContactsApiController
  implements IActiveContactsApiController
{
  ActiveContactsApiService: IActiveContactsService

  /**
   * the active contacts API controller constructor
   *
   * @param {TwakeDB} db - the twake database instance
   * @param {TwakeLogger} logger - the twake logger instance
   * @example
   * const controller = new ActiveContactsApiController(db, logger);
   */
  constructor(
    private readonly db: TwakeDB,
    private readonly logger: TwakeLogger
  ) {
    this.ActiveContactsApiService = new ActiveContactsService(db, logger)
  }

  /**
   * Save active contacts
   *
   * @param {AuthRequest} req - request object
   * @param {Response} res - response object
   * @param {NextFunction} next - next function
   * @returns {Promise<void>} - promise that resolves when the operation is complete
   */
  save = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { contacts } = req.body
      const { userId } = req

      if (userId === undefined || contacts === undefined) {
        res.status(400).json({ message: 'Bad Request' })
        return
      }

      await this.ActiveContactsApiService.save(userId, contacts)

      res.status(201).send()
      return
    } catch (error) {
      this.logger.error('An error occured while saving active contacts', {
        error
      })
      next(error)
    }
  }

  /**
   * Retrieve active contacts
   *
   * @param {AuthRequest} req - request object
   * @param {Response} res - response object
   * @param {NextFunction} next - next function
   * @returns {Promise<void>} - promise that resolves when the operation is complete
   */
  get = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req

      if (userId === undefined) {
        throw new Error('Missing data', {
          cause: 'userId is missing'
        })
      }

      const contacts = await this.ActiveContactsApiService.get(userId)

      if (contacts === null) {
        res.status(404).json({ message: 'No active contacts found' })
        return
      }

      res.status(200).json({ contacts })
      return
    } catch (error) {
      this.logger.error('An error occured while retrieving active contacts', {
        error
      })
      next(error)
    }
  }

  /**
   * Delete saved active contacts
   *
   * @param {AuthRequest} req - request object
   * @param {Response} res - response object
   * @param {NextFunction} next - next function
   * @returns {Promise<void>} - promise that resolves when the operation is complete
   */
  delete = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req

      if (userId === undefined) {
        throw new Error('Missing data', {
          cause: 'userId is missing'
        })
      }

      await this.ActiveContactsApiService.delete(userId)

      res.status(200).send()
      return
    } catch (error) {
      this.logger.error('An error occured while deleting active contacts', {
        error
      })
      next(error)
    }
  }
}
