import type { MatrixDB, UserDB } from '@twake/matrix-identity-server'
import {
  type IUserInfoService,
  type UserInformation,
  type UserSettings,
  type SettingsPayload,
  type UserProfileSettingsT,
  type UserProfileSettingsPayloadT,
  ProfileField,
  ProfileVisibility
} from '../types'
import type { TwakeDB, Config } from '../../types'
import { getLocalPart } from '@twake/utils'
import type { TwakeLogger } from '@twake/logger'
import { type IAddressbookService } from '../../addressbook-api/types'
import { AddressbookService } from '../../addressbook-api/services'

class UserInfoService implements IUserInfoService {
  private readonly addressBookService: IAddressbookService
  private readonly enableAdditionalFeatures: boolean
  private readonly enableCommonSettings: boolean
  private readonly defaultVisibilitySettings: UserProfileSettingsPayloadT

  constructor(
    private readonly userDb: UserDB,
    private readonly db: TwakeDB,
    private readonly matrixDb: MatrixDB,
    private readonly config: Config,
    private readonly logger: TwakeLogger,
    addressbookService?: IAddressbookService
  ) {
    this.enableAdditionalFeatures =
      this.config.additional_features === true ||
      process.env.ADDITIONAL_FEATURES === 'true'

    this.enableCommonSettings =
      this.config.features?.common_settings?.enabled ||
      process.env.FEATURE_COMMON_SETTINGS_ENABLED === 'true'

    this.addressBookService =
      addressbookService ?? new AddressbookService(db, logger)

    this.defaultVisibilitySettings = {
      visibility:
        this.config.features.user_profile.default_visibility_settings
          .visibility === 'public'
          ? ProfileVisibility.Public
          : this.config.features.user_profile.default_visibility_settings
              .visibility === 'contacts'
          ? ProfileVisibility.Contacts
          : ProfileVisibility.Private,
      visible_fields: []
    }

    if (
      this.config.features.user_profile.default_visibility_settings.visible_fields.includes(
        'email'
      )
    )
      this.defaultVisibilitySettings.visible_fields.push(ProfileField.Email)
    if (
      this.config.features.user_profile.default_visibility_settings.visible_fields.includes(
        'phone'
      )
    )
      this.defaultVisibilitySettings.visible_fields.push(ProfileField.Phone)

    this.logger.debug('[UserInfoService] Initialized.', {})
  }

  /**
   * Retrieves the user information from the database
   * @param {string} id the user Id
   * @returns {Promise<UserInformation | null>}
   */
  get = async (
    id: string,
    viewer?: string
  ): Promise<UserInformation | null> => {
    this.logger.debug(`[UserInfoService].get: Gathering information on: ${id}`)
    try {
      // ------------------------------------------------------------------
      // 0 - Initialize the result container
      // ------------------------------------------------------------------
      const result: Partial<UserInformation & SettingsPayload> = { uid: id }

      const userIdLocalPart = getLocalPart(id)
      if (!userIdLocalPart) {
        this.logger.warn('[UserInfoService].get: Provided id is not valid')
        return null
      }

      // ------------------------------------------------------------------
      // 1 - Visibility checks
      // ------------------------------------------------------------------
      const {
        visibility: idProfileVisibility,
        visible_fields: idProfileVisibleFields
      } = (await this.getVisibility(id)) || this.defaultVisibilitySettings
      const isMyProfile = id === viewer
      const isIdProfileVisibleForViewer = async () => {
        if (idProfileVisibility === ProfileVisibility.Public) {
          this.logger.info(
            '[UserInfoService].get: Visibility check: targeted profile is Public'
          )
          return true
        }
        if (idProfileVisibility === ProfileVisibility.Private) {
          this.logger.info(
            '[UserInfoService].get: Visibility check: targeted profile is Private'
          )
          return false
        }
        if (!viewer) {
          this.logger.info(
            '[UserInfoService].get: Visibility check: targeted profile is limited to Contacts but viewer is not set'
          )
          return false
        }

        this.logger.debug(
          '[UserInfoService].get: Visibility check: Obtaining targeted profile contacts...'
        )
        const ab = await this.addressBookService.list(id)
        this.logger.debug(
          '[UserInfoService].get: Visibility check: Checking if viewer is in the contact list of target'
        )
        return ab ? ab.contacts.some((c) => c.mxid === viewer) : false
      }
      const isIdProfileVisible =
        isMyProfile || (await isIdProfileVisibleForViewer())
      this.logger.info(
        '[UserInfoService].get: Visibility check:',
        isIdProfileVisible
          ? 'Viewer can inspect targeted profile'
          : 'Viewer has no rights to inspect targeted profile'
      )

      // ------------------------------------------------------------------
      // 2 - Parallel fetches from the **four** sources
      // ------------------------------------------------------------------
      const matrixPromise = (async () => {
        const rows = (await this.matrixDb.get(
          'profiles',
          ['displayname', 'avatar_url'],
          { user_id: userIdLocalPart }
        )) as unknown as Array<{ displayname: string; avatar_url?: string }>
        return rows?.[0] ?? null
      })()

      const directoryPromise = (async () => {
        const rows = (await this.userDb.get(
          'users',
          [
            'cn',
            'sn',
            'givenname',
            'givenName',
            'mail',
            'mobile',
            'workplaceFqdn'
          ],
          { uid: userIdLocalPart }
        )) as unknown as Array<Record<string, string | string[]>>
        return rows?.[0] ?? null
      })()

      const settingsPromise = (async () => {
        if (!this.enableCommonSettings) {
          return null
        }
        const rows = (await this.db.get('usersettings', ['*'], {
          matrix_id: id
        })) as unknown as UserSettings[]
        return rows?.[0]?.settings || null
      })()

      const addressbookListPromise = (async () => {
        if (!viewer) return null
        if (viewer === id) return null // Viewer is not in their ab
        try {
          const ab = await this.addressBookService.list(viewer)
          if (!ab) {
            this.logger.warn('No addressbook found!')
            return null
          }
          const matched = ab.contacts.find((c) => c.mxid === id)
          return matched || null
        } catch (e) {
          this.logger.warn('Address‑book lookup failed', { error: e })
          return null
        }
      })()

      const [matrixRow, directoryRow, settingsRow, addressbookResponse] =
        await Promise.all([
          matrixPromise,
          directoryPromise,
          settingsPromise,
          addressbookListPromise
        ])

      // ------------------------------------------------------------------
      // 3 - Early‑exit when matrix profile is missing and the flag is off
      // ------------------------------------------------------------------
      if (!matrixRow && !this.enableAdditionalFeatures && !addressbookResponse)
        return null

      // ------------------------------------------------------------------
      // 4 - Matrix profile (highest precedence)
      // ------------------------------------------------------------------
      if (matrixRow) {
        result.display_name = matrixRow.displayname
        if (matrixRow.avatar_url) result.avatar_url = matrixRow.avatar_url
      }

      // ------------------------------------------------------------------
      // 5 - User‑DB (directory) – second precedence
      // ------------------------------------------------------------------
      if (directoryRow) {
        if (!result.display_name && directoryRow.cn)
          result.display_name = directoryRow.cn as string
        if (directoryRow.sn) {
          result.sn = directoryRow.sn as string
          result.last_name = directoryRow.sn as string
        }
        if (directoryRow.givenname != null || directoryRow.givenName != null) {
          result.givenName = (directoryRow.givenname ??
            directoryRow.givenName) as string
          result.first_name = (directoryRow.givenname ??
            directoryRow.givenName) as string
        }
        if (
          directoryRow.mail &&
          (isMyProfile ||
            (isIdProfileVisible &&
              idProfileVisibleFields.includes(ProfileField.Email)))
        )
          result.emails = [directoryRow.mail as string]
        if (
          directoryRow.mobile &&
          (isMyProfile ||
            (isIdProfileVisible &&
              idProfileVisibleFields.includes(ProfileField.Phone)))
        )
          result.phones = [directoryRow.mobile as string]
        if (directoryRow.workplaceFqdn)
          result.workplaceFqdn = directoryRow.workplaceFqdn as string
      }

      // ------------------------------------------------------------------
      // 6 - Common settings – third precedence
      // ------------------------------------------------------------------
      if (settingsRow) {
        if (settingsRow.display_name)
          result.display_name = settingsRow.display_name
        if (settingsRow.last_name) {
          result.last_name = settingsRow.last_name
          result.sn = settingsRow.last_name
        }
        if (settingsRow.first_name) {
          result.first_name = settingsRow.first_name
          result.givenName = settingsRow.first_name
        }
        if (
          settingsRow.email &&
          (isMyProfile ||
            (isIdProfileVisible &&
              idProfileVisibleFields.includes(ProfileField.Email)))
        )
          if (
            result.emails &&
            Array.isArray(result.emails) &&
            !result.emails?.includes(settingsRow.email)
          )
            result.emails.push(settingsRow.email)
          else result.emails = [settingsRow.email]
        if (
          settingsRow.phone &&
          (isMyProfile ||
            (isIdProfileVisible &&
              idProfileVisibleFields.includes(ProfileField.Phone)))
        )
          if (
            result.phones &&
            Array.isArray(result.phones) &&
            !result.phones?.includes(settingsRow.phone)
          )
            result.phones.push(settingsRow.phone)
          else result.phones = [settingsRow.phone]
        if (settingsRow.language) result.language = settingsRow.language
        if (settingsRow.timezone) result.timezone = settingsRow.timezone
      }

      // ------------------------------------------------------------------
      // 7 - Address‑book (fourth source) – merge only missing fields
      // ------------------------------------------------------------------
      if (addressbookResponse) {
        result.display_name = addressbookResponse.display_name
      }

      // ------------------------------------------------------------------
      // 8 - Clean‑up – drop undefined / null values
      // ------------------------------------------------------------------
      const finalResult = Object.fromEntries(
        Object.entries(result).filter(([_, v]) => v != null)
      )

      // If we only have the uid (nothing else useful) we treat it as “no data”.
      if (Object.keys(finalResult).length === 1 && finalResult.uid != null) {
        return null
      }

      return finalResult as unknown as UserInformation
    } catch (error) {
      throw new Error(
        `Error getting user info ${JSON.stringify({ cause: error })}`,
        { cause: error as Error }
      )
    }
  }

  updateVisibility = async (
    userId: string,
    visibilitySettings: UserProfileSettingsPayloadT
  ): Promise<UserProfileSettingsT> => {
    this.logger.debug(
      `[UserInfoService].updateVisibility: Updating visibility settings for user: ${userId}`
    )

    let existingSettings: UserProfileSettingsT | null
    try {
      existingSettings = await this._getUserSettings(userId)
    } catch (error) {
      throw new Error(
        `Failed to retrieve visibility settings for user ${userId}`,
        { cause: error as Error }
      )
    }

    return existingSettings === null
      ? await this._createVisibilitySettings(userId, visibilitySettings)
      : await this._updateVisibilitySettings(userId, visibilitySettings)
  }

  private _createVisibilitySettings = async (
    userId: string,
    visibilitySettings: UserProfileSettingsPayloadT
  ): Promise<UserProfileSettingsT> => {
    this.logger.debug(
      '[UserInfoService]._createVisibilitySettings: Creating new visibility settings',
      { userId, visibilitySettings }
    )

    try {
      const r = (await this.db.insert('profileSettings', {
        matrix_id: userId,
        ...visibilitySettings
      } as unknown as Record<string, string | number>)) as unknown as UserProfileSettingsT[]

      if (!Array.isArray(r) || r.length === 0) {
        this.logger.error(
          '[UserInfoService]._createVisibilitySettings: Database insert returned unexpected result',
          { userId }
        )
        throw new Error(
          `Database insert failed to return settings for user ${userId}`
        )
      }

      const insertedSettings = r[0]
      this.logger.info(
        '[UserInfoService]._createVisibilitySettings: Successfully created visibility settings',
        {
          userId,
          visibility: insertedSettings.visibility,
          visible_fields: insertedSettings.visible_fields
        }
      )
      return insertedSettings
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Database insert failed to return settings')
      ) {
        throw error
      }

      this.logger.error(
        '[UserInfoService]._createVisibilitySettings: Failed to insert new visibility settings',
        {
          userId,
          error: error instanceof Error ? error.message : String(error)
        }
      )
      throw new Error(
        `Failed to create visibility settings for user ${userId}`,
        { cause: error as Error }
      )
    }
  }

  private _updateVisibilitySettings = async (
    userId: string,
    visibilitySettings: UserProfileSettingsPayloadT
  ): Promise<UserProfileSettingsT> => {
    this.logger.debug(
      '[UserInfoService]._updateVisibilitySettings: Updating existing visibility settings',
      { userId, visibilitySettings }
    )

    try {
      const updateResult = (await this.db.update(
        'profileSettings',
        visibilitySettings as unknown as Record<string, string | number>,
        'matrix_id',
        userId
      )) as unknown as UserProfileSettingsT[]

      if (!Array.isArray(updateResult) || updateResult.length === 0) {
        this.logger.error(
          '[UserInfoService]._updateVisibilitySettings: Database update returned unexpected result',
          { userId }
        )
        throw new Error(
          `Database update failed to return settings for user ${userId}`
        )
      }

      const updatedSettings = updateResult[0]
      this.logger.info(
        '[UserInfoService]._updateVisibilitySettings: Successfully updated visibility settings',
        {
          userId,
          visibility: updatedSettings.visibility,
          visible_fields: updatedSettings.visible_fields
        }
      )

      return updatedSettings
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Database update failed to return settings')
      ) {
        throw error
      }

      this.logger.error(
        '[UserInfoService]._updateVisibilitySettings: Failed to update visibility settings',
        {
          userId,
          error: error instanceof Error ? error.message : String(error)
        }
      )
      throw new Error(
        `Failed to update visibility settings for user ${userId}`,
        { cause: error as Error }
      )
    }
  }

  getVisibility = async (
    userId: string
  ): Promise<UserProfileSettingsPayloadT | null> => {
    this.logger.debug(
      `[UserInfoService].getVisibility: Gathering visibility information about: ${userId}`
    )
    try {
      const userIdLocalPart = getLocalPart(userId)
      if (!userIdLocalPart) {
        this.logger.warn(
          '[UserInfoService].getVisibility: Provided userId is not valid'
        )
        this.logger.debug(
          '[UserInfoService].getVisibility: Returning null value'
        )
        return null
      }

      const us: UserProfileSettingsT | null = await this._getUserSettings(
        userId
      )
      if (!us) {
        this.logger.warn(
          '[UserInfoService].getVisibility: No stored settings found, returning defaults'
        )
        return this.defaultVisibilitySettings
      }
      this.logger.info(
        '[UserInfoService].getVisibility: stored settings retreived'
      )
      this.logger.debug(
        `[UserInfoService].getVisibility: ${userId} has a visibility set to ${us.visibility} and visible fields are: [${us.visible_fields}]`
      )

      return us
    } catch (error) {
      throw new Error(
        `Error retreiving user visibility settings: ${JSON.stringify({
          cause: error
        })}`,
        { cause: error as Error }
      )
    }
  }

  private _getUserSettings = async (
    userId: string
  ): Promise<UserProfileSettingsT | null> => {
    try {
      const existing = (await this.db.get('profileSettings', ['*'], {
        matrix_id: userId
      })) as unknown as UserProfileSettingsT[]
      if (Array.isArray(existing) && existing.length > 0) {
        this.logger.info(
          '[UserInfoApiService] Found existing user profile settings ',
          {
            userId
          }
        )
        return existing[0]
      }
      this.logger.info(`[UserInfoApiService] got nothing`)
      return null
    } catch (err: any) {
      this.logger.error(
        '[UserInfoApiService] Failed to get user profile settings ',
        {
          userId,
          error: err?.message
        }
      )
      throw err
    }
  }
}

export default UserInfoService
