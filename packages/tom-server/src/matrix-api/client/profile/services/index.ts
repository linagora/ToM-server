import type { TwakeLogger } from '@twake/logger'
import type { Config, TwakeDB } from '../../../../types'
import { IAddressbookService } from '../../../../addressbook-api/types'
import { AddressbookService } from '../../../../addressbook-api/services'

export default class ProfileService {
  private readonly logPrefix = '[matrix-api/client][ProfileService]'
  private readonly addressBookService: IAddressbookService

  constructor(
    private readonly config: Config,
    private readonly logger: TwakeLogger,
    private readonly db: TwakeDB
  ) {
    this.logger.debug(`${this.logPrefix} initialized.`)
    this.addressBookService = new AddressbookService(this.db, this.logger)
  }

  public get = async (userId: string, viewer: string): Promise<any> => {
    this.logger.info(`${this.logPrefix} Getting profile  for user ${userId}`)
    // get the user original profile
    const userProfile = await this._fetchMatrix(userId)
    const contact = await this.addressBookService.getContact(viewer)
    const displayname = contact?.display_name || userProfile.displayname
    return {
      ...userProfile,
      displayname
    }
  }

  public getDisplayName = async (
    userId: string,
    viewer: string
  ): Promise<any> => {
    this.logger.info(
      `${this.logPrefix} Getting display name for user ${userId}`
    )

    const userDisplayName = await this._fetchMatrix(userId, '/displayname')
    const contact = await this.addressBookService.getContact(viewer)
    const displayname = contact?.display_name || userDisplayName.displayname

    return {
      ...userDisplayName,
      displayname
    }
  }

  public updateDisplayName = async (
    userId: string,
    displayName: string
  ): Promise<Response> => {
    this.logger.info(
      `${this.logPrefix} Updating display name for user ${userId} to ${displayName}`
    )
    // Here you would add the logic to update the display name in your database or service.
    // TODO: Implement the actual update logic when allowed.
    // This is a placeholder implementation.
    return {
      ok: true,
      success: true,
      userId,
      displayName
    } as unknown as Response // Replace with actual response type
  }

  private _fetchMatrix = async (
    userId: string,
    subpath: string = ''
  ): Promise<any> => {
    const base = new URL(this.config.matrix_internal_host) // validates base URL
    const endpoint = new URL(
      `/_matrix/client/v3/profile/${encodeURIComponent(userId)}${subpath}`,
      base
    )

    this.logger.debug(
      `${this.logPrefix} Fetching Matrix data for ${userId}${subpath}`
    )

    const res = await fetch(endpoint.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!res.ok) {
      this.logger.error(
        `${this.logPrefix} Matrix request failed for ${userId}${subpath} with status ${res.status}`
      )
      throw new Error(
        `${this.logPrefix} Matrix request failed for ${userId}${subpath}: ${res.status}`
      )
    }

    return await res.json()
  }
}
