import { TwakeLogger } from '@twake/logger'
import { AuthRequest, TwakeDB } from '../../types'
import {
  ApiRequestHandler,
  IAddressbookApiController,
  IAddressbookService
} from '../types'
import { AddressbookService } from '../services'
import type { NextFunction, Response } from 'express'

export class AddressbookApiController implements IAddressbookApiController {
  private readonly service: IAddressbookService

  constructor(
    private readonly db: TwakeDB,
    private readonly logger: TwakeLogger
  ) {
    this.service = new AddressbookService(db, logger)
  }

  /**
   * Lists connected user addressbook
   *
   * @param {AuthRequest} req - The request object
   * @param {Response} res - The response object
   * @param {NextFunction} next - The next function
   * @returns {Promise<void>}
   */
  public listAddressbooks = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const owner = req.userId

      if (!owner) {
        throw new Error('Missing owner')
      }

      const addressbook = await this.service.list(owner)

      res.status(200).json(addressbook)
    } catch (error) {
      next(error)
    }
  }

  /**
   * Creates a new addressbook
   *
   * @param {AuthRequest} req - The request object
   * @param {Response} res - The response object
   * @param {NextFunction} next - The next function
   * @returns {Promise<void>}
   */
  public createAddressbook = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const owner = req.userId

      if (!owner) {
        throw new Error('Missing owner')
      }

      const addressbook = await this.service.create(owner, req.body.contacts)

      res.status(200).json(addressbook)
    } catch (error) {
      next(error)
    }
  }

  /**
   * Deletes an addressbook
   *
   * @param {AuthRequest} req - The request object
   * @param {Response} res - The response object
   * @param {NextFunction} next - The next function
   * @returns {Promise<void>}
   */
  public deleteAddressbook = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const owner = req.userId

      if (!owner) {
        throw new Error('Missing owner')
      }

      await this.service.delete(owner)
      res.status(200).json({ message: 'Addressbook deleted' })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Removes a contact
   *
   * @param {AuthRequest} req - The request object
   * @param {Response} res - The response object
   * @param {NextFunction} next - The next function
   * @returns {Promise<void>}
   */
  public deleteContact = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params

      await this.service.deleteContact(id)
      res.status(200).json({ message: 'Contact deleted' })
    } catch (error) {
      next(error)
    }
  }
}
