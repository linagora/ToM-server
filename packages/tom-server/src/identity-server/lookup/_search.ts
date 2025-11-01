import { type TwakeLogger } from '@twake/logger'
import { errMsg, getLocalPart, send, toMatrixId } from '@twake/utils'
import type TwakeIdentityServer from '..'
import { AddressbookService } from '../../addressbook-api/services'
import { type Contact } from '../../addressbook-api/types'
import UserInfoService from '../../user-info-api/services'
import { UserInformation } from '../../user-info-api/types'
import { SearchFields, SearchFunction } from './types'

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
  logger.debug('[_search] Initializing search function factory.')

  const { db, userDB, matrixDb, conf } = idServer
  const enableAdditionalFeatures =
    process.env.ADDITIONAL_FEATURES === 'true' ||
    (conf.additional_features as boolean)

  const addressBookService = new AddressbookService(db, logger)
  const userInfoService = new UserInfoService(
    userDB,
    db,
    matrixDb,
    conf,
    logger
  )

  /**
   * Helper functions
   */
  const preprocessData = (fields: any, scope: any) => {
    if (!fields) fields = []
    if (!Array.isArray(scope)) scope = [scope as string]
    return { fields, scope }
  }

  const verifyErrors = (fields: string[], scope: string[]) => {
    let invalid = false
    for (const v of [...fields, ...scope]) {
      if (!SearchFields.has(v)) {
        invalid = true
        logger.warn('[_search] Invalid field or scope value detected.', { v })
      }
    }
    return invalid
  }

  const normalizeScope = (scope: string[]) =>
    scope.map((f) => (f === 'matrixAddress' ? 'uid' : f))

  const fetchContacts = async (owner: string): Promise<Contact[]> => {
    if (!owner) return []
    const result = await addressBookService.list(owner)
    return result.contacts || []
  }

  const filterContacts = (
    contacts: Contact[],
    scope: string[],
    val: string
  ): Contact[] => {
    const normalizedScope = normalizeScope(scope)
    if (!val) return contacts

    return contacts.filter((contact) =>
      normalizedScope.some((field) => {
        const fieldVal =
          field === 'uid'
            ? contact.mxid?.replace(/^@(.*?):.*/, '$1')
            : field === 'cn' || field === 'displayName'
            ? contact.display_name
            : contact.mxid
        return fieldVal?.toLowerCase().includes(val.toLowerCase())
      })
    )
  }

  const buildContactMap = (contacts: Contact[]) => {
    const map = new Map<string, any>()
    contacts.forEach((contact) => {
      const uid = getLocalPart(contact.mxid)
      if (uid) {
        map.set(uid, {
          uid,
          cn: contact.display_name,
          address: contact.mxid
        })
      }
    })
    return map
  }

  const enrichWithUserInfo = async (rows: any[], viewer: string) => {
    rows.forEach(async (row) => {
      try {
        const info: UserInformation = (await userInfoService.get(
          row.address,
          viewer
        )) || {
          uid: row.uid,
          givenName: '',
          sn: '',
          mails: [],
          phones: []
        }
        if (info.givenName) row.givenName = info.givenName
        if (info.sn) row.sn = info.sn
        if (info.mails) row.mails = info.mails
        if (info.mails && Array.isArray(info.mails) && info.mails.length)
          row.mail = info.mails.at(0)
        if (info.phones) row.phones = info.phones
        if (info.phones && Array.isArray(info.phones) && info.phones.length)
          row.phone = info.phones.at(0)
      } catch (err) {
        logger.warn(`[_search] Failed to enrich ${row.uid}`, err)
      }
    })
  }

  /**
   * Search function implementation
   */
  return async (res, data) => {
    try {
      let { fields, scope } = preprocessData(data.fields, data.scope)
      if (verifyErrors(fields, scope)) {
        return send(res, 400, errMsg('invalidParam'))
      }

      const owner = data.owner ?? ''
      const contacts = await fetchContacts(owner)
      const filteredContacts = filterContacts(contacts, scope, data.val ?? '')
      const contactMap = buildContactMap(filteredContacts)

      // UserDB query
      const _fields = fields.includes('uid') ? fields : [...fields, 'uid']
      const _scope = normalizeScope(scope)
      const searchValue = data.val?.replace(/^@(.*?):(?:.*)$/, '$1') ?? ''

      const rows = enableAdditionalFeatures
        ? searchValue
          ? await userDB.match(
              'users',
              _fields,
              _scope,
              searchValue,
              _fields[0]
            )
          : await userDB.getAll('users', _fields, _fields[0])
        : []

      if (rows.length === 0 && contactMap.size === 0) {
        return send(res, 200, { matches: [], inactive_matches: [] })
      }

      // Clean & paginate
      const validRows = rows.filter((r) => r?.uid)
      const paginatedRows = validRows.slice(
        data.offset ?? 0,
        (data.offset ?? 0) + (data.limit ?? 30)
      )

      // Convert to MXIDs
      const matrixUids = paginatedRows
        .map((r) => {
          try {
            return toMatrixId(r.uid as string, conf.server_name)
          } catch {
            return null
          }
        })
        .filter(Boolean) as string[]

      // Query matrixDb
      const matrixRows = await matrixDb.get('users', ['*'], {
        name: matrixUids
      })
      const activeUids = new Set(
        matrixRows.map((m) =>
          (m.name as string).replace(/^@(.*?):(?:.*)$/, '$1')
        )
      )

      const matches: any[] = []
      const inactive_matches: any[] = []

      paginatedRows.forEach((row) => {
        const uid = row.uid as string
        row.address = toMatrixId(uid, conf.server_name)

        if (contactMap.has(uid)) {
          row.cn = contactMap.get(uid).cn
          contactMap.delete(uid)
        }

        if (activeUids.has(uid)) matches.push(row)
        else inactive_matches.push(row)
      })

      // Merge leftover contacts as matches
      contactMap.forEach((contact) => matches.push(contact))

      // Enrich results
      await Promise.all([
        enrichWithUserInfo(matches, owner),
        enrichWithUserInfo(inactive_matches, owner)
      ])

      send(res, 200, { matches, inactive_matches })
    } catch (err) {
      logger.error('[_search] Unexpected error during search.', { err })
      send(res, 500, errMsg('invalidParam'))
    }
  }
}

export default _search
