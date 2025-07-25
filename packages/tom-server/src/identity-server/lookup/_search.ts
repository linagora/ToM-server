import { type TwakeLogger } from '@twake/logger'
import { errMsg, send, toMatrixId } from '@twake/utils'
import { type Response } from 'express'
import type http from 'http'
import type TwakeIdentityServer from '..'
import { AddressbookService } from '../../addressbook-api/services'
import { type Contact } from '../../addressbook-api/types'

/**
 * Represents a contact mapped for quick lookup.
 */
interface MappedContact {
  uid: string
  cn: string
  address: string
}

/**
 * Represents a row fetched from the user database.
 */
interface UserDbRow {
  uid: string
  [key: string]: any
}

/**
 * Represents a row fetched from the Matrix database.
 */
interface MatrixDbRow {
  name: string
  [key: string]: any
}

/**
 * Type definition for the main search function.
 */
type SearchFunction = (
  res: Response | http.ServerResponse,
  data: Query
) => Promise<void>

/**
 * Interface defining the structure of a search query.
 */
export interface Query {
  scope: string[]
  fields?: string[]
  limit?: number
  offset?: number
  val?: string
  owner?: string
}

/**
 * A set of valid fields that can be searched or returned.
 */
export const SearchFields = new Set<string>([
  'mail',
  'mobile',
  'uid',
  'displayName',
  'givenName',
  'cn',
  'sn',
  'matrixAddress'
])

/**
 * Initializes and returns the search function.
 * This function handles incoming search requests, validates parameters,
 * fetches contacts from the address book, and optionally queries user and Matrix databases
 * based on the 'additional_features' configuration.
 *
 * @param idServer The TwakeIdentityServer instance, providing access to databases and configuration.
 * @param logger The TwakeLogger instance for logging messages.
 * @returns A Promise that resolves to the asynchronous search function.
 */
const _search = async (
  idServer: TwakeIdentityServer,
  logger: TwakeLogger
): Promise<SearchFunction> => {
  logger.debug('[_search] Initializing search function factory.')

  /**
   * Sends an error response and logs the error.
   * @param res The Express response object.
   * @param e The error message or object.
   * @param context Optional context for the error.
   */
  const sendError = (
    res: Response | http.ServerResponse,
    e: string | Error,
    context?: string
  ): void => {
    const message = e instanceof Error ? e.message : JSON.stringify(e)
    logger.error('Autocompletion error', {
      message,
      context: context || 'unknown'
    })
    send(res, 500, errMsg('unknown', message))
  }

  /**
   * Validates the provided fields and scope against SearchFields.
   * @param fieldsToValidate The array of fields to validate.
   * @param scopeToValidate The array of scope values to validate.
   * @param logger The logger instance for warnings.
   * @returns True if all fields and scope values are valid, false otherwise.
   */
  const validateFieldsAndScope = (
    fieldsToValidate: string[],
    scopeToValidate: string[],
    logger: TwakeLogger
  ): boolean => {
    for (const v of fieldsToValidate) {
      if (!SearchFields.has(v)) {
        logger.warn('[_search] Invalid field detected.', { field: v })
        return false
      }
    }

    for (const v of scopeToValidate) {
      if (!SearchFields.has(v)) {
        logger.warn('[_search] Invalid scope value detected.', {
          scopeValue: v
        })
        return false
      }
    }
    return true
  }

  /**
   * Filters contacts based on the search value and normalized scope.
   * @param contactsToFilter The array of contacts to filter.
   * @param val The search value (lowercase).
   * @param normalizedScope The normalized scope fields.
   * @param logger The logger instance for debug and silly logs.
   * @returns The filtered array of contacts.
   */
  const filterContacts = (
    contactsToFilter: Contact[],
    val: string,
    normalizedScope: string[],
    logger: TwakeLogger
  ): Contact[] => {
    if (val.length === 0) {
      return contactsToFilter
    }

    logger.debug('[_search] Filtering contacts based on search value.', {
      valueToFilter: val
    })
    const initialContactCount = contactsToFilter.length
    const filtered = contactsToFilter.filter((contact) =>
      normalizedScope.some((field) => {
        const fieldVal = (() => {
          switch (field) {
            case 'uid':
              return contact.mxid?.replace(/^@(.*?):.*/, '$1')
            case 'cn':
            case 'displayName':
              return contact.display_name
            case 'mail':
            case 'mobile':
              return contact.mxid
            default:
              return ''
          }
        })()
        const match = fieldVal?.toLowerCase().includes(val)
        if (match) {
          logger.silly('[_search] Contact matched filter criteria.', {
            contactMxid: contact.mxid,
            field,
            fieldVal,
            val
          })
        }
        return match
      })
    )
    logger.debug('[_search] Contacts filtered.', {
      initialContactCount,
      contactsAfterFilter: filtered.length
    })
    return filtered
  }

  /**
   * Builds a map of contacts for quick lookup, keyed by UID.
   * @param contactsToMap The array of contacts to map.
   * @param logger The logger instance for debug and silly logs.
   * @returns A Map where keys are UIDs and values are MappedContact objects.
   */
  const buildContactMap = (
    contactsToMap: Contact[],
    logger: TwakeLogger
  ): Map<string, MappedContact> => {
    const map = new Map<string, MappedContact>()
    for (const contact of contactsToMap) {
      const uid = contact.mxid?.replace(/^@(.*?):.*/, '$1')
      if (uid && uid.length > 0) {
        map.set(uid, {
          uid,
          cn: contact.display_name ?? '',
          address: contact.mxid ?? ''
        })
        logger.silly('[_search] Added contact to map.', {
          uid,
          displayName: contact.display_name
        })
      } else {
        logger.warn('[_search] Skipping contact due to invalid UID.', {
          contactMxid: contact.mxid
        })
      }
    }
    logger.debug('[_search] Contact map populated.', {
      contactMapSize: map.size
    })
    return map
  }

  /**
   * Processes user database rows, fetches matrix presence, and categorizes matches.
   * This function interacts with `idServer.userDB` and `idServer.matrixDb`.
   *
   * @param userDbRows Rows fetched from the user database.
   * @param queryData The original query data, used for pagination.
   * @param currentContactMap The map of contacts from the address book, used for merging and updating display names.
   * @param idServer The TwakeIdentityServer instance.
   * @param logger The logger instance.
   * @returns A Promise that resolves to an object containing active and inactive matches.
   * @throws {Error} If there's an error during the Matrix DB query.
   */
  const processUserAndMatrixDbRows = async (
    userDbRows: UserDbRow[],
    queryData: Query,
    currentContactMap: Map<string, MappedContact>,
    idServer: TwakeIdentityServer,
    logger: TwakeLogger
  ): Promise<{ matches: any[]; inactive_matches: any[] }> => {
    logger.debug('[_search] Received rows from userDB.', {
      numberOfUserRows: userDbRows.length
    })

    const filteredRows = userDbRows.filter((row) => {
      const toBeKept = row && typeof row.uid === 'string' && row.uid.length > 0
      if (!toBeKept) {
        logger.warn(
          `[_search] Following element from userDB is invalid: ${JSON.stringify(
            row
          )}`
        )
      }
      return toBeKept
    })
    logger.debug(
      '[_search] Filtered rows to include only elements with a valid UID.',
      {
        originalRowCount: userDbRows.length,
        filteredRowCount: filteredRows.length
      }
    )
    if (userDbRows.length !== filteredRows.length) {
      logger.warn(
        '[_search] Invalid elements found after fetching user registry, PLEASE VERIFY YOUR LDAP_FILTER!'
      )
    }
    let rows = filteredRows

    const start = queryData.offset ?? 0
    const end = start + (queryData.limit ?? 30)
    logger.debug('[_search] Applying pagination to userDB rows.', {
      start,
      end,
      totalRowsBeforeSlice: rows.length
    })
    rows = rows.slice(start, end)
    logger.debug('[_search] UserDB rows after slicing.', {
      numberOfUserRowsAfterSlice: rows.length
    })

    const mUid: string[] = []
    for (const v of rows) {
      logger.silly('[_search] Processing UserDB data:', v)
      try {
        const mxid = toMatrixId(v.uid as string, idServer.conf.server_name)
        mUid.push(mxid)
        logger.debug(`[_search] Computed MXID: ${mxid}`)
      } catch (error: unknown) {
        const err: string =
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : typeof error === 'object' &&
              error &&
              'errcode' in error &&
              'error' in error &&
              typeof (error as { errcode: unknown }).errcode === 'string' &&
              typeof (error as { error: unknown }).error === 'string'
            ? `${(error as { errcode: string }).errcode}: ${
                (error as { error: string }).error
              }`
            : JSON.stringify(error)
        logger.warn('[_search] toMatrixId transform impossible', err)
        continue
      }
    }
    logger.debug('[_search] Prepared Matrix UIDs for matrixDb query.', {
      matrixUidsCount: mUid.length
    })

    logger.info('[_search] Initiating matrixDb query to get user presence.')
    let matrixRows: MatrixDbRow[] = []
    try {
      matrixRows = (await idServer.matrixDb.get('users', ['*'], {
        name: mUid
      })) as MatrixDbRow[]
      logger.debug('[_search] Received rows from matrixDb.', {
        numberOfMatrixRows: matrixRows.length
      })
    } catch (e) {
      logger.error('[_search] Error during matrixDb query.', { error: e })
      throw new Error(
        `matrixDb_query_error: ${
          e instanceof Error ? e.message : JSON.stringify(e)
        }`
      )
    }

    const mUids: Record<string, true> = {}
    for (const mrow of matrixRows) {
      const uidFromMatrix = (mrow.name as string).replace(
        /^@(.*?):(?:.*)$/,
        '$1'
      )
      mUids[uidFromMatrix] = true
      logger.silly('[_search] Processed Matrix user from matrixDb.', {
        matrixUid: uidFromMatrix
      })
    }
    logger.debug('[_search] Populated Matrix UIDs map for active users.', {
      activeMatrixUsersCount: Object.keys(mUids).length
    })

    const matches: any[] = []
    const inactive_matches: any[] = []

    for (const row of rows) {
      row.address = toMatrixId(row.uid as string, idServer.conf.server_name)
      const uid = row.uid as string

      if (currentContactMap.has(uid)) {
        row.cn = currentContactMap.get(uid)?.cn ?? row.cn
        logger.silly(
          '[_search] Updated display name from contact map for UID.',
          {
            uid,
            newCn: row.cn
          }
        )
        currentContactMap.delete(uid)
      }

      if (mUids[uid]) {
        matches.push(row)
        logger.silly('[_search] Added user to active matches.', { uid })
      } else {
        inactive_matches.push(row)
        logger.silly('[_search] Added user to inactive matches.', { uid })
      }
    }

    for (const contact of currentContactMap.values()) {
      matches.push(contact)
      logger.silly(
        '[_search] Merged remaining contact from map into matches.',
        {
          contactUid: contact.uid
        }
      )
    }

    logger.info('[_search] Final search results compiled.', {
      activeMatchesCount: matches.length,
      inactiveMatchesCount: inactive_matches.length
    })

    return { matches, inactive_matches }
  }

  return async (res, data) => {
    logger.info('[_search] Incoming search request.', {
      queryData: JSON.stringify(data)
    })

    let fields = data.fields ?? []
    let scope = Array.isArray(data.scope) ? data.scope : [data.scope as string]

    logger.debug('[_search] Initial fields and scope.', {
      initialFields: fields,
      initialScope: scope
    })

    if (!validateFieldsAndScope(fields, scope, logger)) {
      logger.warn(
        '[_search] Invalid parameters detected. Sending 400 response.'
      )
      send(res, 400, errMsg('invalidParam'))
      logger.silly(
        '[_search] Exiting search request handler (invalid parameters).'
      )
      return
    }

    logger.debug('[_search] Input fields and scope validated successfully.')
    const owner = data.owner ?? ''
    let contacts: Contact[] = []

    logger.debug('[_search] Attempting to fetch contacts from address book.', {
      owner: owner || 'no-owner-provided'
    })

    if (owner.length !== 0) {
      try {
        const addressBookService = new AddressbookService(idServer.db, logger)
        const result = await addressBookService.list(owner)
        contacts = result.contacts
        logger.info('[_search] Contacts fetched from address book.', {
          numberOfContacts: contacts.length
        })
      } catch (e) {
        logger.error('[_search] Error fetching contacts from address book.', {
          error: e
        })
        sendError(
          res,
          e instanceof Error ? e.message : JSON.stringify(e),
          'addressbook_fetch_error'
        )
        return
      }
    } else {
      logger.debug('[_search] Owner is empty, skipping address book fetch.')
    }

    const val = data.val?.toLowerCase() ?? ''
    const normalizedScope = scope.map((f) =>
      f === 'matrixAddress' ? 'uid' : f
    )
    logger.debug('[_search] Normalized scope and search value.', {
      normalizedScope,
      searchValue: val
    })

    contacts = filterContacts(contacts, val, normalizedScope, logger)
    const contactMap = buildContactMap(contacts, logger)

    if (
      process.env.ADDITIONAL_FEATURES === 'true' ||
      (idServer.conf.additional_features as boolean)
    ) {
      const _fields = fields.includes('uid') ? fields : [...fields, 'uid']
      const _scope = scope.map((f) => (f === 'matrixAddress' ? 'uid' : f))
      const value = data.val?.replace(/^@(.*?):(?:.*)$/, '$1')

      logger.debug('[_search] Preparing userDB query parameters.', {
        queryFields: _fields,
        queryScope: _scope,
        queryValue: value,
        additionalFeaturesEnabled: idServer.conf.additional_features
      })

      let userDbRequest: Promise<UserDbRow[]>
      if (typeof value === 'string' && value.length > 0) {
        userDbRequest = idServer.userDB.match(
          'users',
          _fields,
          _scope,
          value,
          _fields[0]
        ) as Promise<UserDbRow[]>
      } else {
        userDbRequest = idServer.userDB.getAll(
          'users',
          _fields,
          _fields[0]
        ) as Promise<UserDbRow[]>
      }

      logger.info('[_search] UserDB query initiated.')

      try {
        const rows = await userDbRequest
        const { matches, inactive_matches } = await processUserAndMatrixDbRows(
          rows,
          data,
          contactMap,
          idServer,
          logger
        )

        logger.silly('[_search] Exiting search request handler (success).')
        send(res, 200, {
          matches,
          inactive_matches
        })
      } catch (e) {
        if (
          e instanceof Error &&
          e.message.startsWith('matrixDb_query_error')
        ) {
          sendError(res, e, 'matrixDb_query_or_processing')
        } else {
          sendError(
            res,
            e instanceof Error ? e.message : JSON.stringify(e),
            'userDb_query_or_initial_processing'
          )
        }
        logger.silly(
          '[_search] Exiting search request handler (database error).'
        )
      }
    } else {
      logger.silly(
        '[_search] Exiting search request handler (additional features off).'
      )
      logger.debug(
        '[_search] Additional features are off. Returning only address book contacts.'
      )
      const matchesFromAddressBook = Array.from(contactMap.values())
      send(res, 200, {
        matches: matchesFromAddressBook,
        inactive_matches: []
      })
    }
  }
}

export default _search
