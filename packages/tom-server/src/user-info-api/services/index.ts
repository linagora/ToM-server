import type { MatrixDB, UserDB } from '@twake/matrix-identity-server'
import type {
  IUserInfoService,
  UserInformation,
  UserSettings,
  SettingsPayload
} from '../types'
import type { TwakeDB, Config } from '../../types'
import { getLocalPart } from '@twake/utils'

class UserInfoService implements IUserInfoService {
  constructor(
    private readonly userDb: UserDB,
    private readonly db: TwakeDB,
    private readonly matrixDb: MatrixDB,
    private readonly config: Config
  ) {}

  /**
   * Retrieves the user information from the database
   * @param {string} id the user Id
   * @returns {Promise<UserInformation | null>}
   */
  get = async (id: string): Promise<UserInformation | null> => {
    try {
      // Init the result
      let result: Partial<UserInformation & SettingsPayload> = {uid: id}

      const userIdLocalPart = getLocalPart(id);

      // If the local part is null, return null (invalid Matrix ID)
      if (userIdLocalPart == null) {
        return null
      }

      // Query the Matrix DB
      const matrixUser = (await this.matrixDb.get(
        'profiles',
        ['displayname', 'avatar_url'],
        { user_id: userIdLocalPart }
      )) as unknown as Array<{ displayname: string; avatar_url?: string }>

      if (!Array.isArray(matrixUser) || matrixUser.length === 0) {
        //  Return 404 equivalent if Matrix user not found
        return null
      }

      // Merge Matrix fields
      result.display_name = matrixUser[0].displayname
      if (matrixUser[0].avatar_url != null) {
        result.avatar = matrixUser[0].avatar_url
      }

      // Check if additional features are enabled and fetch more info
      if (this.config.additional_features === true) {
        const userInfo = (await this.userDb.db.get(
          'users',
          ['uid', 'sn', 'givenname', 'givenName', 'mail', 'telephoneNumber'],
          { uid: userIdLocalPart }
        )) as unknown as Array<Record<string, string | number>>

        if (Array.isArray(userInfo) && userInfo.length > 0) {
          const user = userInfo[0]
          result.uid = user.uid as string
          result.sn = user.sn as string
          result.givenName = (user.givenname ?? user.givenName) as string
          result.mail = user.mail as string
          result.phone = user.telephoneNumber as string
        }
      }

      // Check if common settings feature is enabled and fetch user settings
      if (this.config.features?.common_settings?.enabled) {
        const existing = (await this.db.get('usersettings', ['*'], {
          matrix_id: id
        })) as unknown as UserSettings[]

        if (Array.isArray(existing) && existing.length > 0) {
          const settings = existing[0].settings
          result = {
            ...result,
            language: settings.language ?? 'en',
            timezone: settings.timezone ?? 'UTC'
          }
        }
      }

      return result as UserInformation
    } catch (error) {
      throw new Error('Error getting user info', { cause: error })
    }
  }
}

export default UserInfoService
