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
export interface MappedContact {
  uid: string
  cn: string
  address: string
}

/**
 * Represents a row fetched from the user database.
 */
export interface UserDbRow {
  uid: string
  [key: string]: any
}

/**
 * Represents a row fetched from the Matrix database.
 */
export interface MatrixDbRow {
  name: string
  [key: string]: any
}

/**
 * Type definition for the main search function.
 */
export type SearchFunction = (
  // Added export here
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
 * Sends an error response and logs the error.
 * @param res The Express response object.
 * @param e The error message or object.
 * @param context Optional context for the error.
 * @param logger The TwakeLogger instance for logging messages.
 */
export const sendError = (
  res: Response | http.ServerResponse,
  e: string | Error,
  context: string | undefined,
  logger: TwakeLogger
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
export const validateFieldsAndScope = (
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
export const filterContacts = (
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
export const buildContactMap = (
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
 * @param initialContactMap The initial map of contacts from the address book. This map will be cloned and mutated internally.
 * @param idServer The TwakeIdentityServer instance.
 * @param logger The logger instance.
 * @returns A Promise that resolves to an object containing active and inactive matches.
 * @throws {Error} If there's an error during the Matrix DB query.
 */
export const processUserAndMatrixDbRows = async (
  userDbRows: UserDbRow[],
  queryData: Query,
  initialContactMap: Map<string, MappedContact>,
  idServer: TwakeIdentityServer,
  logger: TwakeLogger
): Promise<{ matches: any[]; inactive_matches: any[] }> => {
  logger.debug('[_search] Received rows from userDB.', {
    numberOfUserRows: userDbRows.length
  })

  const validRows = userDbRows.filter((row) => {
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
  if (userDbRows.length !== validRows.length) {
    logger.warn(
      '[_search] Invalid elements found after fetching user registry, PLEASE VERIFY YOUR LDAP_FILTER!'
    )
  }

  const start = queryData.offset ?? 0
  const limit = queryData.limit ?? 30
  const paginatedRows = validRows.slice(start, start + limit)

  logger.debug('[_search] Applying pagination to userDB rows.', {
    start,
    end: start + limit,
    totalRowsBeforeSlice: validRows.length
  })
  logger.debug('[_search] UserDB rows after slicing.', {
    numberOfUserRowsAfterSlice: paginatedRows.length
  })

  const mUid = paginatedRows
    .map((v) => {
      logger.silly('[_search] Processing UserDB data:', v)
      try {
        const mxid = toMatrixId(v.uid as string, idServer.conf.server_name)
        logger.debug(`[_search] Computed MXID: ${mxid}`)
        return mxid
      } catch (error: unknown) {
        const err: string =
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : typeof error === 'object' &&
              error &&
              'errcode' in error &&
              'error' in error &&
              typeof (error as { errcode: unknown }).errcode === 'string' &&
              typeof (error as { error: string }).error === 'string'
            ? `${(error as { errcode: string }).errcode}: ${
                (error as { error: string }).error
              }`
            : JSON.stringify(error)
        logger.warn('[_search] toMatrixId transform impossible', err)
        return null
      }
    })
    .filter((id): id is string => id !== null)

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

  const mUids = matrixRows.reduce((acc, mrow) => {
    const uidFromMatrix = (mrow.name as string).replace(/^@(.*?):(?:.*)$/, '$1')
    acc[uidFromMatrix] = true
    logger.silly('[_search] Processed Matrix user from matrixDb.', {
      matrixUid: uidFromMatrix
    })
    return acc
  }, {} as Record<string, true>)

  logger.debug('[_search] Populated Matrix UIDs map for active users.', {
    activeMatrixUsersCount: Object.keys(mUids).length
  })

  // Clone the initialContactMap to ensure immutability of the original map passed in
  const clonedContactMap = new Map(initialContactMap)

  const { matches, inactive_matches } = paginatedRows.reduce(
    (acc, row) => {
      // Create a new row object to avoid mutating the original
      const newRow = { ...row }
      newRow.address = toMatrixId(
        newRow.uid as string,
        idServer.conf.server_name
      )

      const uid = newRow.uid as string

      // Check and update display name from contact map, then "consume" the contact from the cloned map
      if (clonedContactMap.has(uid)) {
        newRow.cn = clonedContactMap.get(uid)?.cn ?? newRow.cn
        logger.silly(
          '[_search] Updated display name from contact map for UID.',
          {
            uid,
            newCn: newRow.cn
          }
        )
        clonedContactMap.delete(uid) // Mutates the cloned map
      }

      // Categorize into matches or inactive_matches
      if (mUids[uid]) {
        acc.matches.push(newRow)
        logger.silly('[_search] Added user to active matches.', { uid })
      } else {
        acc.inactive_matches.push(newRow)
        logger.silly('[_search] Added user to inactive matches.', { uid })
      }
      return acc
    },
    { matches: [], inactive_matches: [] } as {
      matches: any[]
      inactive_matches: any[]
    }
  )

  // Merge remaining contacts from the (now potentially modified) clonedContactMap into matches
  const finalMatches = [...matches, ...Array.from(clonedContactMap.values())]
  logger.silly('[_search] Merged remaining contacts from map into matches.')

  logger.info('[_search] Final search results compiled.', {
    activeMatchesCount: finalMatches.length,
    inactiveMatchesCount: inactive_matches.length
  })

  return { matches: finalMatches, inactive_matches }
}

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

  return async (res, data) => {
    logger.info('[_search] Incoming search request.', {
      queryData: JSON.stringify(data)
    })

    const fields = data.fields ?? []
    const scope = Array.isArray(data.scope)
      ? data.scope
      : [data.scope as string]

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
    let contacts: Contact[] = [] // Initialize as empty array

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
          'addressbook_fetch_error',
          logger
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

    const filteredContacts = filterContacts(
      contacts,
      val,
      normalizedScope,
      logger
    )
    const contactMap = buildContactMap(filteredContacts, logger)

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
        // Pass a clone of contactMap to processUserAndMatrixDbRows to maintain purity
        const { matches, inactive_matches } = await processUserAndMatrixDbRows(
          rows,
          data,
          new Map(contactMap),
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
          sendError(res, e, 'matrixDb_query_or_processing', logger)
        } else {
          sendError(
            res,
            e instanceof Error ? e.message : JSON.stringify(e),
            'userDb_query_or_initial_processing',
            logger
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
