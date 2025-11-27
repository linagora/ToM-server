import type { TwakeLogger } from '@twake/logger'
import { isMatrixId, send, toMatrixId } from '@twake/utils'
import { AddressbookService } from '../../addressbook-api/services'
import UserInfoService from '../../user-info-api/services'
import type { UserInformation } from '../../user-info-api/types'
import type TwakeIdentityServer from '..'
import type { SearchFunction } from './types'

/**
 * Factory function that creates a search handler for the Twake Identity Server.
 * @param {TwakeIdentityServer} idServer
 * @param {TwakeLogger} logger
 * @returns {Promise<SearchFunction>}
 */
export const _search = async (
  idServer: TwakeIdentityServer,
  logger: TwakeLogger
): Promise<SearchFunction> => {
  logger.debug(
    '[IndentityServer][_search] Initializing search function factory.'
  )

  const { db, userDB, matrixDb, conf } = idServer
  const enableAdditionalFeatures =
    process.env.ADDITIONAL_FEATURES === 'true' ||
    (conf.additional_features as boolean)
  logger.debug(
    `[IndentityServer][_search] Additional features enabled: ${enableAdditionalFeatures}`
  )

  const addressBookService = new AddressbookService(db, logger)
  const userInfoService = new UserInfoService(
    userDB,
    db,
    matrixDb,
    conf,
    logger
  )

  type EnrichedUser = {
    uid: string
    address: string
    display_name: string
    displayName: string
    cn: string
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
    const enrichedUsers: EnrichedUser[] = []
    for (const mxid of mxids) {
      let userInfo: UserInformation | null
      try {
        userInfo = await userInfoService.get(mxid, viewer)
      } catch (e) {
        logger.warn(
          `[IndentityServer][_search][enrichWithUserInfo] Failed to fetch user info for ${mxid}: ${JSON.stringify(
            e
          )}`
        )
        userInfo = null
      }
      if (!userInfo) {
        logger.warn(
          `[IndentityServer][_search][enrichWithUserInfo] No user info found for ${mxid}. Skipping enrichment.`
        )
      } else {
        enrichedUsers.push({
          address: mxid, // TODO: address is deprecated and uid should replace it
          uid: mxid,
          display_name: userInfo?.display_name || '',
          displayName: userInfo?.display_name || '', // TODO: Deprecated kepping for backward compatibility
          cn: userInfo?.display_name || '', // TODO: Deprecated kepping for backward compatibility
          avatar_url: userInfo?.avatar_url || '',
          last_name: userInfo?.last_name || '',
          first_name: userInfo?.first_name || '',
          givenName: userInfo?.first_name || '', // TODO: Deprecated kepping for backward compatibility
          givenname: userInfo?.first_name || '', // TODO: Deprecated kepping for backward compatibility
          emails: userInfo?.emails || [],
          mail: userInfo?.emails?.at(0) || '', // TODO: Deprecated kepping for backward compatibility
          phones: userInfo?.phones || [],
          mobile: userInfo?.phones?.at(0) || '', // TODO: Deprecated kepping for backward compatibility
          language: userInfo?.language || '',
          timezone: userInfo?.timezone || ''
        })
        logger.silly(
          `[IndentityServer][_search][enrichWithUserInfo] Enriched user: ${JSON.stringify(
            userInfo
          )}`
        )
      }
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
    if (!owner) {
      logger.info(
        '[IndentityServer][_search][addressbookPromise] No owner provided. Skipping address book search.'
      )
      return []
    }
    const result = (await addressBookService.list(owner))?.contacts || []
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
    const sanitizedResult = result.filter(
      (c) => !!c && !!c.mxid && c.mxid.length > 0 && isMatrixId(c.mxid)
    )
    if (!predicate || predicate.length <= 0) {
      logger.info(
        '[IndentityServer][_search][addressbookPromise] No predicate provided. Returning all contacts from addressBookService.'
      )
      return sanitizedResult.map((c) => c.mxid)
    }
    const filteredContacts = sanitizedResult.filter(
      (c) => c.mxid?.includes(predicate) || c.display_name?.includes(predicate)
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
        '[IndentityServer][_search][userDbPromise] Additional features are disabled. Skipping sserDB search.'
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

    logger.info(`[IndentityServer][_search] Searching user registry started`)
    logger.debug(
      `[IndentityServer][_search] Search requested by: ${owner || 'anonymous'}`
    )
    logger.debug(
      `[IndentityServer][_search] Searching for: ${predicate || 'all'}`
    )

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

    const [matchesResult, inactiveMatchesResult] = await Promise.allSettled([
      enrichWithUserInfo(Array.from(activesSet), owner),
      enrichWithUserInfo(Array.from(inactivesSet), owner)
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
      `[IndentityServer][_search] Searching user registry completed. Found ${
        activesSet.size + inactivesSet.size
      } total users.`
    )

    return send(res, 200, { matches, inactive_matches })
  }
}

export default _search
