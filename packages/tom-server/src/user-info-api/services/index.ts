import type { MatrixDB, UserDB } from '@twake/matrix-identity-server'
import {
  type IUserInfoService,
  type UserInformation,
  type UserSettings,
  type SettingsPayload,
  type UserProfileSettingsT,
  type UserProfileSettingsPayloadT,
  ProfileField,
  ProfileVisibility,
  ForbiddenError
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
    this.addressBookService = new AddressbookService(this.db, this.logger)

    this.enableAdditionalFeatures =
      this.config.additional_features === true ||
      process.env.ADDITIONAL_FEATURES === 'true'

    this.enableCommonSettings =
      this.config.features?.common_settings?.enabled ||
      process.env.FEATURE_COMMON_SETTINGS_ENABLED === 'true'
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
    try {
      // ------------------------------------------------------------------
      // 0 - Initialise the result container
      // ------------------------------------------------------------------
      let result: Partial<UserInformation & SettingsPayload> = { uid: id }

      const userIdLocalPart = getLocalPart(id)
      if (userIdLocalPart == null) {
        return null
      }

      const defaultProfileVisibilitySettings = {
        visibility: ProfileVisibility.Private,
        visible_fields: []
      }

      let visibilitySettings = {
        visibility: ProfileVisibility.Public,
        visible_fields: [ProfileField.Email]
      }

      // ------------------------------------------------------------------
      // 1 - Visibility checks
      // ------------------------------------------------------------------
      if (viewer) {
        const viewerLocalPart = getLocalPart(viewer)
        if (viewerLocalPart == null) {
          throw new ForbiddenError('Invalid viewer identifier.')
        }

        if (id !== viewer) {
          const { visibilitySettings: userVisibilitySettings } =
            await this._getOrCreateUserSettings(
              id,
              defaultProfileVisibilitySettings
            )
          visibilitySettings = userVisibilitySettings

          if (visibilitySettings.visibility === ProfileVisibility.Private) {
            throw new ForbiddenError('This profile is private.')
          }

          if (visibilitySettings.visibility === ProfileVisibility.Contacts) {
            const { contacts: userContacts } =
              await this.addressBookService.list(id)
            const contactSet = new Set<string>()
            for (const c of userContacts) {
              if (c.id) contactSet.add(c.id)
              if (c.mxid) contactSet.add(c.mxid)
            }

            const isContact = contactSet.has(viewer)
            if (!isContact) {
              throw new ForbiddenError(
                'This profile is visible to contacts only.'
              )
            }
          }
        }
      }

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
        if (!this.enableAdditionalFeatures) {
          return null
        }
        const rows = (await this.userDb.db.get(
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
          return await this.addressBookService.list(viewer)
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
        if (result.display_name == null && directoryRow.cn != null)
          result.display_name = directoryRow.cn as string
        if (directoryRow.sn != null) result.sn = directoryRow.sn as string
        if (directoryRow.givenname != null || directoryRow.givenName != null) {
          result.givenName = (directoryRow.givenname ??
            directoryRow.givenName) as string
        }
        if (
          directoryRow.mail != null &&
          visibilitySettings.visible_fields.includes(ProfileField.Email)
        )
          result.mails = [directoryRow.mail as string]
        if (
          directoryRow.mobile != null &&
          visibilitySettings.visible_fields.includes(ProfileField.Phone)
        )
          result.phones = [directoryRow.mobile as string]
      }

      // ------------------------------------------------------------------
      // 6 - Common settings – third precedence
      // ------------------------------------------------------------------
      if (settingsRow) {
        if (settingsRow.settings.language)
          result.language = settingsRow.settings.language
        if (settingsRow.settings.timezone)
          result.timezone = settingsRow.settings.timezone
      }

      // ------------------------------------------------------------------
      // 7 - Address‑book (fourth source) – merge only missing fields
      // ------------------------------------------------------------------
      if (addressbookResponse) {
        const contacts = addressbookResponse.contacts ?? []
        const abContact = contacts.find((c) => c.mxid === id)

        if (abContact) {
          result.display_name = abContact.display_name

          // The address‑book does **not** provide avatar, email or phone,
          // so we deliberately do not touch `result.avatar`, `result.mails`,
          // or `result.phones` here.
        }
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
