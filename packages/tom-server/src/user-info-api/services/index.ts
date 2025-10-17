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
  constructor(
    private readonly userDb: UserDB,
    private readonly db: TwakeDB,
    private readonly matrixDb: MatrixDB,
    private readonly config: Config,
    private readonly logger: TwakeLogger
  ) {
    this.addressBookService = new AddressbookService(this.db, this.logger)
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

      // If the local part is null, return null (invalid Matrix ID)
      if (userIdLocalPart == null) {
        return null
      }

      const defaultProfileVisibilitySettings = {
        visibility: ProfileVisibility.Private,
        visible_fields: []
      }

      // By default all fields are visible (user viewing his own profile)
      let visibilitySettings = {
        visibility: ProfileVisibility.Public,
        visible_fields: [ProfileField.Email]
      }

      // If it's another user requesting someone else's profile
      if (id !== viewer) {
        const { visibilitySettings: userVisibilitySettings } =
          await this._getOrCreateUserSettings(
            id,
            defaultProfileVisibilitySettings
          )
        visibilitySettings = userVisibilitySettings

        // if the profile is private then return nothing
        if (visibilitySettings.visibility === ProfileVisibility.Private) {
          // 403 forbidden
          throw new ForbiddenError('This profile is private.')
        }

        // if the profile is visible to contacts only, check if the viewer is
        // an existing contact
        if (visibilitySettings.visibility === ProfileVisibility.Contacts) {
          const { contacts: userContacts } = await this.addressBookService.list(
            id
          )
          const isContact = userContacts.some(
            (contact) => contact.id === viewer || contact.mxid === viewer
          )
          if (!isContact) {
            // 403 forbidden
            throw new ForbiddenError(
              'This profile is visible to contacts only.'
            )
          }
        }
      }

      // Query the Matrix DB
      const matrixUser = (await this.matrixDb.get(
        'profiles',
        ['displayname', 'avatar_url'],
        { user_id: userIdLocalPart }
      )) as unknown as Array<{ displayname: string; avatar_url?: string }>

      const hasMatrix = Array.isArray(matrixUser) && matrixUser.length
      const additional_features =
        this.config.additional_features === true ||
        process.env.ADDITIONAL_FEATURES === 'true'
      if (!hasMatrix && !additional_features) return null
      if (hasMatrix) {
        result.display_name = matrixUser[0].displayname
        if (matrixUser[0].avatar_url) result.avatar = matrixUser[0].avatar_url
      }

      // Check if additional features are enabled and fetch more info
      if (additional_features) {
        const userInfo = (await this.userDb.db.get(
          'users',
          ['cn', 'sn', 'givenname', 'givenName', 'mail', 'mobile'],
          { uid: userIdLocalPart }
        )) as unknown as Array<Record<string, string | string[]>>

        if (Array.isArray(userInfo) && userInfo.length > 0) {
          const user = userInfo[0]
          if (result.display_name == null)
            result.display_name = user.cn as string
          result.sn = user.sn as string
          result.givenName = (user.givenname ?? user.givenName) as string
          if (
            user.mail != null &&
            visibilitySettings.visible_fields.includes(ProfileField.Email)
          )
            result.mails = [user.mail as string]
          if (
            user.mobile != null &&
            visibilitySettings.visible_fields.includes(ProfileField.Phone)
          )
            result.phones = [user.mobile as string]
        }
      }

      // Check if common settings feature is enabled and fetch user settings
      if (
        this.config.features?.common_settings?.enabled ||
        process.env.FEATURE_COMMON_SETTINGS_ENABLED === 'true'
      ) {
        const existing = (await this.db.get('usersettings', ['*'], {
          matrix_id: id
        })) as unknown as UserSettings[]

        if (Array.isArray(existing) && existing.length > 0) {
          const settings = existing[0].settings
          result = {
            ...result,
            language: settings.language ?? '',
            timezone: settings.timezone ?? ''
          }
        }
      }

      // if only uid is present in the result, return null
      if (Object.keys(result).length === 1 && result.uid != null) {
        return null
      }

      return result as UserInformation
    } catch (error) {
      throw new Error(
        `Error getting user info ${JSON.stringify({
          cause: error
        })}`
      )
    }
  }

  updateVisibility = async (
    userId: string,
    visibilitySettings: UserProfileSettingsPayloadT
  ): Promise<UserProfileSettingsT | undefined> => {
    // eslint-disable-next-line no-useless-catch
    try {
      const { visibilitySettings: userVisibilitySettings, created } =
        await this._getOrCreateUserSettings(userId, visibilitySettings)
      if (created) {
        return userVisibilitySettings
      } else {
        // update the existing user profile settings
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
        })}`
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
