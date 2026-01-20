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

    this.logger.info('[UserInfoService] Initialized.', {})
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

    return this.getBatch([id], viewer).then((result) => {
      if (result.has(id)) {
        return result.get(id) as UserInformation
      } else {
        this.logger.info(
          `[UserInfoService].get: No user information found for: ${id}`
        )
        return null
      }
    })
  }

  /**
   * Retrieves user information for multiple users in batch (optimized for performance)
   * @param {string[]} ids Array of user IDs to fetch
   * @param {string} viewer Optional viewer ID for visibility checks
   * @returns {Promise<Map<string, UserInformation>>} Map of user ID to user information
   */
  getBatch = async (
    ids: string[],
    viewer?: string
  ): Promise<Map<string, UserInformation>> => {
    this.logger.debug(
      `[UserInfoService].getBatch: Gathering information on ${ids.length} users`
    )

    const result = new Map<string, UserInformation>()

    if (ids.length === 0) {
      return result
    }

    try {
      // Build mapping of full ID to local part
      const idToLocalPart = new Map<string, string>()
      const localPartToId = new Map<string, string>()
      for (const id of ids) {
        const localPart = getLocalPart(id)
        if (localPart) {
          idToLocalPart.set(id, localPart)
          localPartToId.set(localPart, id)
        }
      }

      const localParts = Array.from(idToLocalPart.values())
      const validIds = Array.from(idToLocalPart.keys())

      if (localParts.length === 0) {
        this.logger.warn(
          '[UserInfoService].getBatch: No valid user IDs provided'
        )
        return result
      }

      // ------------------------------------------------------------------
      // 1 - Batch fetch from all sources in parallel
      // ------------------------------------------------------------------
      const matrixPromise = (async () => {
        const rows = (await this.matrixDb.get(
          'profiles',
          ['user_id', 'displayname', 'avatar_url'],
          { user_id: localParts }
        )) as unknown as Array<{
          user_id: string
          displayname: string
          avatar_url?: string
        }>
        return rows ?? []
      })()

      const directoryPromise = (async () => {
        const rows = (await this.userDb.get(
          'users',
          [
            'uid',
            'cn',
            'sn',
            'givenname',
            'givenName',
            'mail',
            'mobile',
            'workplaceFqdn'
          ],
          { uid: localParts }
        )) as unknown as Array<Record<string, string | string[]>>
        return rows ?? []
      })()

      const settingsPromise = (async () => {
        if (!this.enableCommonSettings) {
          return []
        }
        const rows = (await this.db.get('usersettings', ['*'], {
          matrix_id: validIds
        })) as unknown as UserSettings[]
        return rows ?? []
      })()

      // Fetch profile visibility settings for all users
      const profileSettingsPromise = (async () => {
        const rows = (await this.db.get('profileSettings', ['*'], {
          matrix_id: validIds
        })) as unknown as UserProfileSettingsT[]
        return rows ?? []
      })()

      // Fetch viewer's addressbook once (if viewer is set)
      const viewerAddressbookPromise = (async () => {
        if (!viewer) return null
        try {
          const ab = await this.addressBookService.list(viewer)
          return ab ?? null
        } catch (e) {
          this.logger.warn(
            '[UserInfoService].getBatch: Address-book lookup failed',
            { error: e }
          )
          return null
        }
      })()

      const [
        matrixRows,
        directoryRows,
        settingsRows,
        profileSettingsRows,
        viewerAddressbook
      ] = await Promise.all([
        matrixPromise,
        directoryPromise,
        settingsPromise,
        profileSettingsPromise,
        viewerAddressbookPromise
      ])

      this.logger.debug(
        `[UserInfoService].getBatch: Fetched ${matrixRows.length} matrix profiles, ${directoryRows.length} directory entries, ${settingsRows.length} settings`
      )

      // ------------------------------------------------------------------
      // 2 - Build lookup maps for efficient merging
      // ------------------------------------------------------------------
      const matrixMap = new Map<
        string,
        { displayname: string; avatar_url?: string }
      >()
      for (const row of matrixRows) {
        if (row.user_id) {
          matrixMap.set(row.user_id, row)
        }
      }

      const directoryMap = new Map<string, Record<string, string | string[]>>()
      for (const row of directoryRows) {
        if (row.uid) {
          directoryMap.set(row.uid as string, row)
        }
      }

      const settingsMap = new Map<string, SettingsPayload>()
      for (const row of settingsRows) {
        if (row.matrix_id && row.settings) {
          settingsMap.set(row.matrix_id, row.settings)
        }
      }

      const profileSettingsMap = new Map<string, UserProfileSettingsPayloadT>()
      for (const row of profileSettingsRows) {
        if (row.matrix_id) {
          profileSettingsMap.set(row.matrix_id, {
            visibility: row.visibility,
            visible_fields: row.visible_fields
          })
        }
      }

      const addressbookContactMap = new Map<string, { display_name: string }>()
      if (viewerAddressbook?.contacts) {
        for (const contact of viewerAddressbook.contacts) {
          if (contact.mxid) {
            addressbookContactMap.set(contact.mxid, contact)
          }
        }
      }

      // ------------------------------------------------------------------
      // 3 - Merge data for each user
      // ------------------------------------------------------------------
      for (const id of validIds) {
        const localPart = idToLocalPart.get(id)
        if (!localPart) continue

        const userInfo: Partial<UserInformation> = { uid: id }

        const matrixRow = matrixMap.get(localPart)
        const directoryRow = directoryMap.get(localPart)
        const settingsRow = settingsMap.get(id)
        const addressbookContact = addressbookContactMap.get(id)

        // Skip if no data from any source (unless additional features enabled)
        if (
          !matrixRow &&
          !this.enableAdditionalFeatures &&
          !addressbookContact
        ) {
          continue
        }

        // ------------------------------------------------------------------
        // Visibility checks for this user
        // ------------------------------------------------------------------
        const isMyProfile = id === viewer
        const profileSettings =
          profileSettingsMap.get(id) ?? this.defaultVisibilitySettings
        const idProfileVisibility = profileSettings.visibility
        const idProfileVisibleFields = profileSettings.visible_fields ?? []

        // Determine if the profile is visible to the viewer
        let isIdProfileVisible = isMyProfile
        if (!isMyProfile) {
          if (idProfileVisibility === ProfileVisibility.Public) {
            isIdProfileVisible = true
          } else if (idProfileVisibility === ProfileVisibility.Private) {
            isIdProfileVisible = false
          } else if (
            idProfileVisibility === ProfileVisibility.Contacts &&
            viewer
          ) {
            // TODO: Implement contacts check - The use of a bloom filter or similar mechanism could be handy here
            // For now we are only allowing access:
            //   - if viewer and target are on the same domain
            // AND
            //   - if additional features are enabled
            isIdProfileVisible =
              this.enableAdditionalFeatures &&
              viewer.endsWith(`:${this.config.server_name}`) &&
              id.endsWith(`:${this.config.server_name}`)
          }
        }

        // Matrix profile (highest precedence)
        if (matrixRow) {
          userInfo.display_name = matrixRow.displayname
          if (matrixRow.avatar_url) userInfo.avatar_url = matrixRow.avatar_url
        }

        // Directory (second precedence)
        if (directoryRow) {
          if (!userInfo.display_name && directoryRow.cn) {
            userInfo.display_name = directoryRow.cn as string
          }
          if (directoryRow.sn) {
            userInfo.sn = directoryRow.sn as string
            userInfo.last_name = directoryRow.sn as string
          }
          if (
            directoryRow.givenname != null ||
            directoryRow.givenName != null
          ) {
            userInfo.givenName = (directoryRow.givenname ??
              directoryRow.givenName) as string
            userInfo.first_name = (directoryRow.givenname ??
              directoryRow.givenName) as string
          }
          // Apply visibility checks for email/phone
          if (
            directoryRow.mail &&
            (isMyProfile ||
              (isIdProfileVisible &&
                idProfileVisibleFields.includes(ProfileField.Email)))
          ) {
            userInfo.emails = [directoryRow.mail as string]
          }
          if (
            directoryRow.mobile &&
            (isMyProfile ||
              (isIdProfileVisible &&
                idProfileVisibleFields.includes(ProfileField.Phone)))
          ) {
            userInfo.phones = [directoryRow.mobile as string]
          }
          if (directoryRow.workplaceFqdn) {
            userInfo.workplaceFqdn = directoryRow.workplaceFqdn as string
          }
        }

        // Settings (third precedence)
        if (settingsRow) {
          if (settingsRow.display_name) {
            userInfo.display_name = settingsRow.display_name
          }
          if (settingsRow.last_name) {
            userInfo.last_name = settingsRow.last_name
            userInfo.sn = settingsRow.last_name
          }
          if (settingsRow.first_name) {
            userInfo.first_name = settingsRow.first_name
            userInfo.givenName = settingsRow.first_name
          }
          // Apply visibility checks for email/phone from settings
          if (
            settingsRow.email &&
            (isMyProfile ||
              (isIdProfileVisible &&
                idProfileVisibleFields.includes(ProfileField.Email)))
          ) {
            if (
              userInfo.emails &&
              !userInfo.emails.includes(settingsRow.email)
            ) {
              userInfo.emails.push(settingsRow.email)
            } else if (!userInfo.emails) {
              userInfo.emails = [settingsRow.email]
            }
          }
          if (
            settingsRow.phone &&
            (isMyProfile ||
              (isIdProfileVisible &&
                idProfileVisibleFields.includes(ProfileField.Phone)))
          ) {
            if (
              userInfo.phones &&
              !userInfo.phones.includes(settingsRow.phone)
            ) {
              userInfo.phones.push(settingsRow.phone)
            } else if (!userInfo.phones) {
              userInfo.phones = [settingsRow.phone]
            }
          }
          if (settingsRow.language) userInfo.language = settingsRow.language
          if (settingsRow.timezone) userInfo.timezone = settingsRow.timezone
        }

        // Addressbook (fourth source) - override display_name if present
        if (addressbookContact) {
          userInfo.display_name = addressbookContact.display_name
        }

        // Only add if we have more than just uid
        if (Object.keys(userInfo).length > 1) {
          result.set(id, userInfo as UserInformation)
        }
      }

      this.logger.info(
        `[UserInfoService].getBatch: Returning ${result.size} user info records`
      )

      return result
    } catch (error) {
      this.logger.error('[UserInfoService].getBatch: Error fetching batch', {
        error
      })
      throw new Error(
        `Error getting batch user info: ${JSON.stringify({ cause: error })}`,
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
