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
      // Init the result
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

      const matrixPromise = (async () => {
        const rows = (await this.matrixDb.get(
          'profiles',
          ['displayname', 'avatar_url'],
          { user_id: userIdLocalPart }
        )) as unknown as Array<{ displayname: string; avatar_url?: string }>
        return rows
      })()

      const directoryPromise = (async () => {
        if (
          !this.enableAdditionalFeatures &&
          process.env.ADDITIONAL_FEATURES !== 'true'
        ) {
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
        if (
          !this.enableCommonSettings &&
          process.env.FEATURE_COMMON_SETTINGS_ENABLED !== 'true'
        ) {
          return null
        }
        const rows = (await this.db.get('usersettings', ['*'], {
          matrix_id: id
        })) as unknown as UserSettings[]
        return rows?.[0] ?? null
      })()

      const [matrixRows, directoryRow, settingsRow] = await Promise.all([
        matrixPromise,
        directoryPromise,
        settingsPromise
      ])

      const hasMatrix = Array.isArray(matrixRows) && matrixRows.length

      if (!hasMatrix && !this.enableAdditionalFeatures) return null

      if (hasMatrix) {
        result.display_name = matrixRows[0].displayname
        if (matrixRows[0].avatar_url) result.avatar = matrixRows[0].avatar_url
      }

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

      if (settingsRow) {
        Object.assign(result, {
          language: settingsRow.settings.language ?? '',
          timezone: settingsRow.settings.timezone ?? ''
        })
      }

      if (Object.keys(result).length === 1 && result.uid != null) {
        return null
      }
      return result as UserInformation
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
