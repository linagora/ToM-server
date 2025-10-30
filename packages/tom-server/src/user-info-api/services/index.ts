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

  constructor(
    private readonly userDb: UserDB,
    private readonly db: TwakeDB,
    private readonly matrixDb: MatrixDB,
    private readonly config: Config,
    private readonly logger: TwakeLogger
  ) {
    this.enableAdditionalFeatures =
      this.config.additional_features === true ||
      process.env.ADDITIONAL_FEATURES === 'true'

    this.enableCommonSettings =
      this.config.features?.common_settings?.enabled ||
      process.env.FEATURE_COMMON_SETTINGS_ENABLED === 'true'

    this.addressBookService = new AddressbookService(db, logger)
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
      // 0 - Initialise the result container
      // ------------------------------------------------------------------
      let result: Partial<UserInformation & SettingsPayload> = { uid: id }

      const userIdLocalPart = getLocalPart(id)
      if (!userIdLocalPart) {
        this.logger.warn('[UserInfoService].get: Provided id is not valid')
        return null
      }

      // ------------------------------------------------------------------
      // 1 - Visibility checks
      // ------------------------------------------------------------------
      const { visibilitySettings: idVisibilitySettings } =
        await this._getOrCreateUserSettings(id, {
          visibility: ProfileVisibility.Private,
          visible_fields: []
        })
      const {
        visibility: idProfileVisibility,
        visible_fields: idProfileVisibleFields
      } = idVisibilitySettings
      const isIdProfileVisibleForViewer = async () => {
        if (id === viewer) {
          this.logger.info(
            '[UserInfoService].get: Visibility check: viewer is targeting themselves'
          )
          return true
        }
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
        const { contacts } = await this.addressBookService.list(id)
        this.logger.debug(
          '[UserInfoService].get: Visibility check: Checking if viewer is in the contact list of target'
        )
        return contacts.some((c) => c.mxid === viewer)
      }
      const isIdProfileVisible = await isIdProfileVisibleForViewer()
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
          ['cn', 'sn', 'givenname', 'givenName', 'mail', 'mobile'],
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
        return rows?.[0] ?? null
      })()

      const addressbookListPromise = (async () => {
        if (!viewer) return null
        try {
          const { contacts } = await this.addressBookService.list(viewer)
          const matched = contacts.find((c) => c.mxid === id)
          return matched
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
        if (matrixRow.avatar_url) result.avatar = matrixRow.avatar_url
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
          isIdProfileVisible &&
          idProfileVisibleFields.includes(ProfileField.Email)
        )
          result.mails = [directoryRow.mail as string]
        if (
          directoryRow.mobile &&
          isIdProfileVisible &&
          idProfileVisibleFields.includes(ProfileField.Phone)
        )
          result.phones = [directoryRow.mobile as string]
      }

      // ------------------------------------------------------------------
      // 6 - Common settings – third precedence
      // ------------------------------------------------------------------
      if (settingsRow) {
        if (settingsRow.settings.display_name)
          result.display_name = settingsRow.settings.display_name
        if (settingsRow.settings.last_name) {
          result.last_name = settingsRow.settings.last_name
          result.sn = settingsRow.settings.last_name
        }
        if (settingsRow.settings.first_name) {
          result.first_name = settingsRow.settings.first_name
          result.givenName = settingsRow.settings.first_name
        }
        if (
          isIdProfileVisible &&
          idProfileVisibleFields.includes(ProfileField.Email) &&
          settingsRow.settings.email
        )
          if (
            result.mails &&
            Array.isArray(result.mails) &&
            !result.mails?.includes(settingsRow.settings.email)
          )
            result.mails.push(settingsRow.settings.email)
          else result.mails = [settingsRow.settings.email]
        if (
          isIdProfileVisible &&
          idProfileVisibleFields.includes(ProfileField.Phone) &&
          settingsRow.settings.phone
        )
          if (
            result.phones &&
            Array.isArray(result.phones) &&
            !result.phones?.includes(settingsRow.settings.phone)
          )
            result.phones.push(settingsRow.settings.phone)
          else result.phones = [settingsRow.settings.phone]
        if (settingsRow.settings.language)
          result.language = settingsRow.settings.language
        if (settingsRow.settings.timezone)
          result.timezone = settingsRow.settings.timezone
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
  ): Promise<UserProfileSettingsT | undefined> => {
    try {
      const { visibilitySettings: userVisibilitySettings, created } =
        await this._getOrCreateUserSettings(userId, visibilitySettings)
      if (created) {
        return userVisibilitySettings
      } else {
        await this.db.update(
          'profileSettings',
          // @ts-expect-error typecast
          visibilitySettings,
          'matrix_id',
          userId
        )
      }
    } catch (error) {
      throw new Error(
        `Error updating user visibility settings:  ${JSON.stringify({
          cause: error
        })}`,
        { cause: error as Error }
      )
    }
  }

  _getOrCreateUserSettings = async (
    userId: string,
    visibilitySettings: UserProfileSettingsPayloadT
  ): Promise<{
    visibilitySettings: UserProfileSettingsT
    created: boolean
  }> => {
    try {
      const existing = (await this.db.get('profileSettings', ['*'], {
        matrix_id: userId
      })) as unknown as UserProfileSettingsT[]
      this.logger.info(`[UserInfoApiService] ${existing.length}`)
      if (Array.isArray(existing) && existing.length > 0) {
        this.logger.info(
          '[UserInfoApiService] Found existing user profile settings ',
          {
            userId
          }
        )
        return { visibilitySettings: existing[0], created: false }
      }
      this.logger.info(`[UserInfoApiService] got nothing`)
      const insertResult = (await this.db.insert(
        'profileSettings',
        // @ts-expect-error typecast
        {
          matrix_id: userId,
          ...visibilitySettings
        } as unknown as UserProfileSettingsT
      )) as unknown as UserProfileSettingsT
      this.logger.info('[UserInfoApiService] Created new user settings', {
        userId,
        insertResult
      })
      return { visibilitySettings: insertResult, created: true }
    } catch (err: any) {
      this.logger.error(
        '[UserInfoApiService] Failed to get or create user profile settings ',
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
