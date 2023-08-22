import type { userDB } from '@twake/matrix-identity-server'
import type { IUserInfoService, UserInformation } from '../types'

class UserInfoService implements IUserInfoService {
  constructor(private readonly userDb: userDB) {}

  /**
   * Retrieves the user information from the database
   *  @
   * @param {string}  id the user Id
   * @returns {romise<UserInformation | null>}
   */
  get = async (id: string): Promise<UserInformation | null> => {
    try {
      const userInfo = (await this.userDb.db.get(
        'users',
        ['uid', 'sn', 'givenName'],
        { uid: id }
      )) as unknown as Array<Record<string, string | number>>

      if (!Array.isArray(userInfo) || userInfo.length === 0) {
        return null
      }

      if (
        userInfo.some((u) => u.givenName === undefined || u.sn === undefined)
      ) {
        return null
      }

      return userInfo[0] as unknown as UserInformation
    } catch (error) {
      throw new Error('Error getting user info', { cause: error })
    }
  }
}

export default UserInfoService
