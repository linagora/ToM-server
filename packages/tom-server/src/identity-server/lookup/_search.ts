import type { TwakeLogger } from '@twake-chat/logger'
import { isMatrixId, send, toMatrixId } from '@twake-chat/utils'
import type { IAddressbookService } from '../../addressbook-api/types.ts'
import type {
  IUserInfoService,
  UserInformation
} from '../../user-info-api/types.ts'
import type TwakeIdentityServer from '../index.ts'
import type { SearchFunction } from './types.ts'

/**
 * Masks an email address for logging purposes.
 * Example: "john.doe@example.com" -> "j***@example.com"
 */
const maskEmail = (email: string): string => {
  if (!email || typeof email !== 'string') return ''
  const atIndex = email.indexOf('@')
  if (atIndex <= 0) return '***'
  const localPart = email.substring(0, atIndex)
  const domain = email.substring(atIndex)
  return `${localPart.charAt(0)}***${domain}`
}

/**
 * Masks a phone number for logging purposes.
 * Example: "+33612345678" -> "***5678"
 */
const maskPhone = (phone: string): string => {
  if (!phone || typeof phone !== 'string') return ''
  if (phone.length <= 4) return '***'
  return `***${phone.slice(-4)}`
}

/**
 * Builds a redacted summary of user info for safe logging (no PII).
 */
const buildRedactedUserSummary = (
  userInfo: UserInformation
): Record<string, unknown> => {
  return {
    uid: userInfo.uid || '',
    hasDisplayName: !!userInfo.display_name,
    hasAvatar: !!userInfo.avatar_url,
    emailCount: userInfo.emails?.length || 0,
    maskedEmails: userInfo.emails?.map(maskEmail) || [],
    phoneCount: userInfo.phones?.length || 0,
    maskedPhones: userInfo.phones?.map(maskPhone) || [],
    hasLanguage: !!userInfo.language,
    hasTimezone: !!userInfo.timezone
  }
}

/**
 * Factory function that creates a search handler for the Twake Identity Server.
 * @param {TwakeIdentityServer} idServer
 * @param {TwakeLogger} logger
 * @param {IAddressbookService} addressbookService
 * @param {IUserInfoService} userInfoService
 * @returns {Promise<SearchFunction>}
 */
export const _search = async (
  idServer: TwakeIdentityServer,
  logger: TwakeLogger,
  addressbookService: IAddressbookService,
  userInfoService: IUserInfoService
): Promise<SearchFunction> => {
  logger.info(
    '[IndentityServer][_search] Initializing search function factory.'
  )

  // TODO: investigate unused db
  // const { db, userDB, matrixDb, conf } = idServer
  const { userDB, matrixDb, conf } = idServer
  const enableAdditionalFeatures =
    process.env.ADDITIONAL_FEATURES === 'true' ||
    (conf.additional_features as boolean)
  const enableUserDirectory = conf.features.user_directory.enabled
  logger.debug(
    `[IndentityServer][_search] Additional features enabled: ${enableAdditionalFeatures}`
  )
  logger.debug(
    `[IndentityServer][_search] User directory enabled: ${enableUserDirectory}`
  )

  type EnrichedUser = {
    uid: string
    address: string
    display_name: string
    displayName: string
    cn: string
    sn: string
    avatar_url: string
    last_name: string
    first_name: string
    givenName: string
    givenname: string
    emails: string[]
    mail: string
    phones: string[]
    mobile: string
    language: string
    timezone: string
  }

  const enrichWithUserInfo = async (
    mxids: string[],
    viewer: string
  ): Promise<EnrichedUser[]> => {
    if (mxids.length === 0) {
      return []
    }

    logger.debug(
      `[IndentityServer][_search][enrichWithUserInfo] Batch fetching user info for ${mxids.length} users`
    )

    let userInfoMap: Map<string, UserInformation>
    try {
      userInfoMap = await userInfoService.getBatch(mxids, viewer)
    } catch (e) {
      logger.error(
        `[IndentityServer][_search][enrichWithUserInfo] Failed to batch fetch user info: ${JSON.stringify(
          e
        )}`
      )
      return []
    }

    logger.debug(
      `[IndentityServer][_search][enrichWithUserInfo] Got ${userInfoMap.size} user info records`
    )

    const enrichedUsers: EnrichedUser[] = []
    for (const mxid of mxids) {
      const userInfo = userInfoMap.get(mxid)
      if (!userInfo) {
        logger.silly(
          `[IndentityServer][_search][enrichWithUserInfo] No user info found for ${mxid}. Skipping enrichment.`
        )
        continue
      }

      enrichedUsers.push({
        address: mxid, // TODO: address is deprecated and uid should replace it
        uid: mxid,
        display_name: userInfo.display_name || '',
        displayName: userInfo.display_name || '', // TODO: Deprecated kepping for backward compatibility
        cn: userInfo.display_name || '', // TODO: Deprecated kepping for backward compatibility
        sn: userInfo.sn || '', // TODO: Deprecated kepping for backward compatibility
        avatar_url: userInfo.avatar_url || '',
        last_name: userInfo.last_name || '',
        first_name: userInfo.first_name || '',
        givenName: userInfo.first_name || '', // TODO: Deprecated kepping for backward compatibility
        givenname: userInfo.first_name || '', // TODO: Deprecated kepping for backward compatibility
        emails: userInfo.emails || [],
        mail: userInfo.emails?.at(0) || '', // TODO: Deprecated kepping for backward compatibility
        phones: userInfo.phones || [],
        mobile: userInfo.phones?.at(0) || '', // TODO: Deprecated kepping for backward compatibility
        language: userInfo.language || '',
        timezone: userInfo.timezone || ''
      })
      logger.silly(
        `[IndentityServer][_search][enrichWithUserInfo] Enriched user: ${JSON.stringify(
          buildRedactedUserSummary(userInfo)
        )}`
      )
    }

    return enrichedUsers
  }

  const addressbookPromise = async (
    owner: string,
    predicate: string
  ): Promise<Array<string>> => {
    logger.silly(
      '[IndentityServer][_search][addressbookPromise] Searching addressBookService...'
    )
    if (!predicate || predicate.length <= 0) {
      logger.info(
        '[IndentityServer][_search][addressbookPromise] No predicate provided. Skipping address book search.'
      )
      return []
    }
    if (!owner) {
      logger.info(
        '[IndentityServer][_search][addressbookPromise] No owner provided. Skipping address book search.'
      )
      return []
    }
    // Pass false for includeUserDbContacts to avoid double-counting UserDB users
    // (UserDB users are handled separately by userDbPromise)
    const result = (await addressbookService.list(owner, false))?.contacts || []
    logger.debug(
      `[IndentityServer][_search][addressbookPromise] addressBookService.list returned ${
        result?.length || 0
      } results.`
    )
    logger.silly(
      `[IndentityServer][_search][addressbookPromise] Raw result: ${JSON.stringify(
        result
      )}`
    )
    if (!result || !Array.isArray(result) || result.length <= 0) {
      logger.info(
        '[IndentityServer][_search][addressbookPromise] No contacts found in addressBookService.'
      )
      return []
    }
    const filteredContacts = result.filter(
      (c) =>
        !!c &&
        !!c.mxid &&
        c.mxid.length > 0 &&
        isMatrixId(c.mxid) &&
        (c.mxid.includes(predicate) || c.display_name.includes(predicate))
    )
    if (
      !filteredContacts ||
      !Array.isArray(filteredContacts) ||
      filteredContacts.length <= 0
    ) {
      logger.info(
        '[IndentityServer][_search][addressbookPromise] No matching users found in addressBookService after filtering.'
      )
      return []
    }
    return filteredContacts.map((c) => c.mxid)
  }

  const matrixDbPromise = async (predicate: string): Promise<Array<string>> => {
    logger.silly(
      '[IndentityServer][_search][matrixDbPromise] Searching matrixDb...'
    )
    if (!enableUserDirectory) {
      logger.info(
        '[IndentityServer][_search][matrixDbPromise] User directory is disabled. Skipping matrixDb search.'
      )
      return []
    }
    if (!predicate || predicate.length <= 0) {
      logger.info(
        '[IndentityServer][_search][matrixDbPromise] No predicate provided. Skipping matrixDb search.'
      )
      return []
    }
    const rows = (await matrixDb.db.match(
      'profiles',
      ['user_id'],
      ['user_id', 'displayname'],
      predicate
    )) as unknown as Array<{ user_id: string }>
    logger.debug(
      `[IndentityServer][_search][matrixDbPromise] matrixDb.match returned ${
        rows?.length || 0
      } rows.`
    )
    logger.silly(
      `[IndentityServer][_search][matrixDbPromise] Raw rows: ${JSON.stringify(
        rows
      )}`
    )
    if (!rows || !Array.isArray(rows) || rows.length <= 0) {
      logger.info(
        '[IndentityServer][_search][matrixDbPromise] No matching users found in matrixDb.'
      )
      return []
    }
    return rows
      .filter((i) => !!i?.user_id)
      .map((i) => {
        const uid = i.user_id || ''
        if (!isMatrixId(uid)) {
          logger.silly(
            `[IndentityServer][_search][matrixDbPromise] Converting uid to matrixId: ${uid}`
          )
          try {
            const mxid = toMatrixId(uid, conf.server_name)
            logger.debug(
              `[IndentityServer][_search][matrixDbPromise] Converted matrixId: ${mxid}`
            )
            return mxid
          } catch (e) {
            logger.warn(
              `[IndentityServer][_search][matrixDbPromise] Invalid uid found: ${uid}`,
              JSON.stringify(e)
            )
            return '' // silently ignore invalid uids
          }
        }
        return uid
      })
      .filter((i) => !!i && i.length > 0)
  }

  const userDbPromise = async (predicate: string): Promise<Array<string>> => {
    logger.silly(
      '[IndentityServer][_search][userDbPromise] Searching userDB...'
    )
    if (!enableAdditionalFeatures) {
      logger.info(
        '[IndentityServer][_search][userDbPromise] Additional features are disabled. Skipping userDB search.'
      )
      return []
    }
    if (!predicate || predicate.length <= 0) {
      logger.info(
        '[IndentityServer][_search][userDbPromise] No predicate provided. Skipping userDB search.'
      )
      return []
    }
    const rows = (await userDB.match(
      'users',
      ['uid'],
      ['cn', 'displayName', 'sn', 'givenName', 'uid', 'mail', 'mobile'],
      predicate
    )) as unknown as Array<{ uid: string }>
    logger.debug(
      `[IndentityServer][_search][userDbPromise] userDB.match returned ${
        rows?.length || 0
      } rows.`
    )
    logger.silly(
      `[IndentityServer][_search][userDbPromise] Raw rows: ${JSON.stringify(
        rows
      )}`
    )
    if (!rows || !Array.isArray(rows) || rows.length <= 0) {
      logger.info(
        '[IndentityServer][_search][userDbPromise] No matching users found in userDB.'
      )
      return []
    }
    return rows
      .filter((i) => !!i?.uid)
      .map((i): string => {
        const uid = i.uid || ''
        if (!isMatrixId(uid)) {
          logger.silly(
            `[IndentityServer][_search][userDbPromise] Converting uid to matrixId: ${uid}`
          )
          try {
            const mxid = toMatrixId(uid, conf.server_name)
            logger.debug(
              `[IndentityServer][_search][userDbPromise] Converted matrixId: ${mxid}`
            )
            return mxid
          } catch (e) {
            logger.warn(
              `[IndentityServer][_search][userDbPromise] Invalid uid found: ${uid}`,
              JSON.stringify(e)
            )
            return '' // silently ignore invalid uids
          }
        }
        return uid
      })
      .filter((i) => !!i && i.length > 0)
  }

  return async (res, data) => {
    const owner = data.owner || ''
    const predicate = data.val || ''

    const limit = data.limit || 30
    const offset = data.offset || 0

    logger.info(`[IndentityServer][_search] Searching user registry started`)
    logger.debug(
      `[IndentityServer][_search] Search requested by: ${owner || 'anonymous'}`
    )
    logger.debug(
      `[IndentityServer][_search] Searching for: ${predicate || 'nothing'}`
    )
    logger.debug(
      `[IndentityServer][_search] Pagination - limit: ${limit}, offset: ${offset}`
    )

    if (!predicate) {
      logger.info(
        `[IndentityServer][_search] No predicate provided. Returning empty results.`
      )
      return send(res, 200, { matches: [], inactive_matches: [] })
    }

    const [matrixDbResult, addressbookResult, userDbResult] =
      await Promise.allSettled([
        matrixDbPromise(predicate),
        addressbookPromise(owner, predicate),
        userDbPromise(predicate)
      ])

    const activesSet = new Set<string>()
    const inactivesSet = new Set<string>()

    if (matrixDbResult.status === 'fulfilled') {
      logger.debug(
        `[IndentityServer][_search] matrixDbResult found ${matrixDbResult.value.length} active users.`
      )
      for (const mxid of matrixDbResult.value) {
        logger.silly(
          `[IndentityServer][_search] matrixDbResult adding active user: ${mxid}`
        )
        activesSet.add(mxid)
      }
    } else {
      logger.warn(
        `[IndentityServer][_search] matrixDbPromise failed: ${JSON.stringify(
          matrixDbResult.reason
        )}`
      )
    }
    logger.info('[IndentityServer][_search] MatrixDb search completed.')

    if (addressbookResult.status === 'fulfilled') {
      logger.debug(
        `[IndentityServer][_search] matrixDbResult found ${addressbookResult.value.length} active users.`
      )
      for (const mxid of addressbookResult.value) {
        logger.silly(
          `[IndentityServer][_search] matrixDbResult adding active user: ${mxid}`
        )
        activesSet.add(mxid)
      }
    } else {
      logger.warn(
        `[IndentityServer][_search] matrixDbPromise failed: ${JSON.stringify(
          addressbookResult.reason
        )}`
      )
    }
    logger.info(
      '[IndentityServer][_search] AddressbookService search completed.'
    )

    if (userDbResult.status === 'fulfilled') {
      logger.debug(
        `[IndentityServer][_search] userDbResult found ${userDbResult.value.length} users.`
      )
      for (const mxid of userDbResult.value) {
        if (!activesSet.has(mxid)) {
          logger.silly(
            `[IndentityServer][_search] userDbResult adding inactive user: ${mxid}`
          )
          inactivesSet.add(mxid)
        }
      }
    } else {
      logger.warn(
        `[IndentityServer][_search] userDbPromise failed: ${JSON.stringify(
          userDbResult.reason
        )}`
      )
    }
    logger.info('[IndentityServer][_search] UserDB search completed.')

    // Apply pagination BEFORE enrichment to minimize DB/API calls
    const allActiveIds = Array.from(activesSet).sort()
    const allInactiveIds = Array.from(inactivesSet).sort()
    const totalResults = allActiveIds.length + allInactiveIds.length

    logger.debug(
      `[IndentityServer][_search] Found ${totalResults} total users before pagination`
    )

    // Combine active and inactive for pagination
    const combinedIds = [...allActiveIds, ...allInactiveIds]
    const paginatedIds = combinedIds.slice(offset, offset + limit)

    // Determine which paginated IDs are active vs inactive
    const paginatedActiveIds = paginatedIds.filter((id) => activesSet.has(id))
    const paginatedInactiveIds = paginatedIds.filter((id) =>
      inactivesSet.has(id)
    )

    logger.debug(
      `[IndentityServer][_search] Enriching ${paginatedIds.length} paginated users (${paginatedActiveIds.length} active, ${paginatedInactiveIds.length} inactive)`
    )

    // Only enrich the paginated subset
    const [matchesResult, inactiveMatchesResult] = await Promise.allSettled([
      enrichWithUserInfo(paginatedActiveIds, owner),
      enrichWithUserInfo(paginatedInactiveIds, owner)
    ])

    let matches: EnrichedUser[] = []
    let inactive_matches: EnrichedUser[] = []

    if (matchesResult.status === 'rejected') {
      logger.error(
        `[IndentityServer][_search] Failed to enrich active matches: ${JSON.stringify(
          matchesResult.reason
        )}`
      )
    } else {
      matches = matchesResult.value
    }

    if (inactiveMatchesResult.status === 'rejected') {
      logger.error(
        `[IndentityServer][_search] Failed to enrich inactive matches: ${JSON.stringify(
          inactiveMatchesResult.reason
        )}`
      )
    } else {
      inactive_matches = inactiveMatchesResult.value
    }

    logger.info(
      `[IndentityServer][_search] Searching user registry completed. Found ${totalResults} total users, returning ${
        matches.length + inactive_matches.length
      } paginated results.`
    )

    return send(res, 200, { matches, inactive_matches })
  }
}

export default _search
