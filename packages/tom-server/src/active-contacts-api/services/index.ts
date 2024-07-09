import type { TwakeLogger } from '@twake/logger'
import type { TwakeDB } from '../../db'
import type { Collections } from '../../types'
import type { ActiveAcountsData, IActiveContactsService } from '../types'

class ActiveContactsService implements IActiveContactsService {
  /**
   * The active contacts service constructor.
   *
   * @param {TwakeDB} db - The Twake database instance.
   * @param {TwakeLogger} logger - The Twake logger instance.
   * @example
   * const service = new ActiveContactsService(db, logger);
   */
  constructor(
    private readonly db: TwakeDB,
    private readonly logger: TwakeLogger
  ) {}

  /**
   * Fetches the active contacts for a given user ID.
   *
   * @param {string} userId - The ID of the user whose active contacts need to be fetched.
   * @returns {Promise<string | null>} - Active contacts or null if no active contacts found.
   * @throws {Error} - If there is an error while fetching the active contacts.
   */
  public get = async (userId: string): Promise<string | null> => {
    try {
      const ActiveContacts = (await this.db.get(
        'activeContacts' as Collections,
        ['contacts'],
        { userId }
      )) as unknown as ActiveAcountsData[]

      if (ActiveContacts.length === 0) {
        this.logger.warn('No active contacts found')

        return null
      }

      return ActiveContacts[0].contacts
    } catch (error) {
      this.logger.error('Failed to get active contacts', { error })
      throw new Error('Failed to get active contacts', { cause: error })
    }
  }

  /**
   * Saves the active contacts for a given user ID and target ID.
   *
   * @param {string} userId - The ID of the user whose active contacts need to be saved.
   * @param {string} contacts - The active contacts data to be saved.
   * @returns {Promise<void>}
   * @throws {Error} - If there is an error while saving the active contacts.
   */
  save = async (userId: string, contacts: string): Promise<void> => {
    try {
      await this.db.insert('activeContacts' as Collections, {
        userId,
        contacts
      })

      this.logger.info('active contacts saved successfully')
    } catch (error) {
      this.logger.error('Failed to save active contacts', { error })
      throw new Error('Failed to save active contacts', { cause: error })
    }
  }

  /**
   * Deletes saved active contacts for a given user ID.
   *
   * @param {string} userId - The ID of the user whose saved active contacts need to be deleted.
   * @returns {Promise<void>}
   * @throws {Error} - If there is an error while deleting the saved active contacts.
   */
  delete = async (userId: string): Promise<void> => {
    try {
      await this.db.deleteEqual(
        'activeContacts' as Collections,
        'userId',
        userId
      )

      this.logger.info('active contacts deleted successfully')
    } catch (error) {
      this.logger.error('Failed to delete saved active contacts', { error })
      throw new Error('Failed to delete saved active contacts', {
        cause: error
      })
    }
  }
}

export default ActiveContactsService
