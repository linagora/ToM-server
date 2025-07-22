import { type TwakeLogger } from '@twake/logger'
import { errMsg, send, toMatrixId } from '@twake/utils'
import { type Response } from 'express'
import type http from 'http'
import type TwakeIdentityServer from '..'
import { AddressbookService } from '../../addressbook-api/services'

type SearchFunction = (
  res: Response | http.ServerResponse,
  data: Query
) => Promise<void>

export interface Query {
  scope: string[]
  fields?: string[]
  limit?: number
  offset?: number
  val?: string
  owner?: string
}

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

const _search = async (
  idServer: TwakeIdentityServer,
  logger: TwakeLogger
): Promise<SearchFunction> => {
  logger.debug('[_search] Initializing search function factory.')

  return async (res, data) => {
    logger.info('[_search] Incoming search request.', {
      queryData: JSON.stringify(data)
    })

    const sendError = (e: string, context?: string): void => {
      /* istanbul ignore next */
      logger.error('Autocompletion error', {
        message: e,
        context: context || 'unknown'
      })
      /* istanbul ignore next */
      send(res, 500, errMsg('unknown', e))
    }

    let fields = data.fields
    let scope = data.scope

    logger.debug('[_search] Initial fields and scope.', {
      initialFields: fields,
      initialScope: scope
    })

    /* istanbul ignore if */
    if (fields == null) {
      fields = []
      logger.debug('[_search] Fields were null, initialized to empty array.')
    }
    /* istanbul ignore if */
    if (typeof scope !== 'object' || !Array.isArray(scope)) {
      // Added Array.isArray check for robustness
      scope = [scope as string] // Cast to string as it could be a single string from original type
      logger.debug(
        '[_search] Scope was not an array, initialized to single-element array.',
        { newScope: scope }
      )
    }

    let error = false
    fields.forEach((v) => {
      /* istanbul ignore next */
      if (!SearchFields.has(v)) {
        error = true
        logger.warn('[_search] Invalid field detected.', { field: v })
      }
    })
    scope.forEach((v) => {
      /* istanbul ignore next */
      if (!SearchFields.has(v)) {
        error = true
        logger.warn('[_search] Invalid scope value detected.', {
          scopeValue: v
        })
      }
    })

    /* istanbul ignore else */
    if (!error) {
      logger.debug('[_search] Input fields and scope validated successfully.')
      const addressBookService = new AddressbookService(idServer.db, logger)
      logger.debug(
        '[_search] Attempting to fetch contacts from address book.',
        { owner: data.owner ?? 'no-owner-provided' }
      )
      let { contacts } = await addressBookService.list(data.owner ?? '')
      logger.info('[_search] Contacts fetched from address book.', {
        numberOfContacts: contacts.length
      })

      const val = data.val?.toLowerCase() ?? ''
      const normalizedScope = scope.map((f) =>
        f === 'matrixAddress' ? 'uid' : f
      )
      logger.debug('[_search] Normalized scope and search value.', {
        normalizedScope,
        searchValue: val
      })

      if (val.length > 0) {
        logger.debug('[_search] Filtering contacts based on search value.', {
          valueToFilter: val
        })
        const initialContactCount = contacts.length
        contacts = contacts.filter((contact) =>
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
          contactsAfterFilter: contacts.length
        })
      }

      const contactMap = new Map<string, any>()
      for (const contact of contacts) {
        const uid = contact.mxid?.replace(/^@(.*?):.*/, '$1')
        if (uid && uid.length > 0) {
          // Ensure uid is valid before adding to map
          contactMap.set(uid, {
            uid,
            cn: contact.display_name,
            address: contact.mxid
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
        contactMapSize: contactMap.size
      })

      const _fields = fields.includes('uid') ? fields : [...fields, 'uid']
      const _scope = scope.map((f) => (f === 'matrixAddress' ? 'uid' : f))
      const value = data.val?.replace(/^@(.*?):(?:.*)$/, '$1')

      logger.debug('[_search] Preparing userDB query parameters.', {
        queryFields: _fields,
        queryScope: _scope,
        queryValue: value,
        additionalFeaturesEnabled: idServer.conf.additional_features
      })

      const request =
        process.env.ADDITIONAL_FEATURES === 'true' ||
        (idServer.conf.additional_features as boolean)
          ? typeof value === 'string' && value.length > 0
            ? idServer.userDB.match('users', _fields, _scope, value, _fields[0])
            : idServer.userDB.getAll('users', _fields, _fields[0])
          : Promise.resolve([])

      logger.info('[_search] UserDB query initiated.')

      request
        .then((rows) => {
          logger.debug('[_search] Received rows from userDB.', {
            numberOfUserRows: rows.length
          })

          if (rows.length === 0 && contactMap.size === 0) {
            /* istanbul ignore next */
            logger.info(
              '[_search] No matches found from userDB or contactMap. Sending empty response.'
            )
            send(res, 200, { matches: [], inactive_matches: [] })
          } else {
            const start = data.offset ?? 0
            const end = start + (data.limit ?? 30)
            logger.debug('[_search] Applying pagination to userDB rows.', {
              start,
              end,
              totalRowsBeforeSlice: rows.length
            })
            rows = rows.slice(start, end)
            logger.debug('[_search] UserDB rows after slicing.', {
              numberOfUserRowsAfterSlice: rows.length
            })

            const mUid = rows.map((v) => {
              return toMatrixId(v.uid as string, idServer.conf.server_name)
            })
            logger.debug('[_search] Prepared Matrix UIDs for matrixDb query.', {
              matrixUidsCount: mUid.length
            })

            /**
             * For the record, this can be replaced by a call to
             * <matrix server>/_matrix/app/v1/users/{userId}
             *
             * See https://spec.matrix.org/v1.6/application-service-api/#get_matrixappv1usersuserid
             */
            logger.info(
              '[_search] Initiating matrixDb query to get user presence.'
            )
            idServer.matrixDb
              .get('users', ['*'], { name: mUid })
              .then((matrixRows) => {
                logger.debug('[_search] Received rows from matrixDb.', {
                  numberOfMatrixRows: matrixRows.length
                })
                const mUids: Record<string, true> = {}
                const matches: typeof rows = []
                // eslint-disable-next-line @typescript-eslint/naming-convention
                const inactive_matches: typeof rows = []

                for (const mrow of matrixRows) {
                  const uidFromMatrix = (mrow.name as string).replace(
                    /^@(.*?):(?:.*)$/,
                    '$1'
                  )
                  mUids[uidFromMatrix] = true
                  logger.silly(
                    '[_search] Processed Matrix user from matrixDb.',
                    { matrixUid: uidFromMatrix }
                  )
                }
                logger.debug(
                  '[_search] Populated Matrix UIDs map for active users.',
                  { activeMatrixUsersCount: Object.keys(mUids).length }
                )

                for (const row of rows) {
                  row.address = toMatrixId(
                    row.uid as string,
                    idServer.conf.server_name
                  )

                  const uid = row.uid as string

                  if (contactMap.has(uid)) {
                    row.cn = contactMap.get(uid).cn // Update display name from addressbook
                    logger.silly(
                      '[_search] Updated display name from contact map for UID.',
                      { uid, newCn: row.cn }
                    )
                    contactMap.delete(uid)
                  }

                  if (mUids[uid]) {
                    matches.push(row)
                    logger.silly('[_search] Added user to active matches.', {
                      uid
                    })
                  } else {
                    inactive_matches.push(row)
                    logger.silly('[_search] Added user to inactive matches.', {
                      uid
                    })
                  }
                }

                // Merge remaining contacts from Map into matches
                for (const contact of contactMap.values()) {
                  matches.push(contact)
                  logger.silly(
                    '[_search] Merged remaining contact from map into matches.',
                    { contactUid: contact.uid }
                  )
                }

                logger.info('[_search] Final search results compiled.', {
                  activeMatchesCount: matches.length,
                  inactiveMatchesCount: inactive_matches.length
                })

                send(res, 200, {
                  matches,
                  inactive_matches
                })
                logger.silly(
                  '[_search] Exiting search request handler (success).'
                )
              })
              .catch((e) => {
                logger.error(
                  '[_search] Error during matrixDb query or result processing.',
                  { error: e }
                )
                sendError(
                  e instanceof Error ? e.message : String(e),
                  'matrixDb_query_or_processing'
                )
                logger.silly(
                  '[_search] Exiting search request handler (matrixDb error).'
                )
              })
          }
        })
        .catch((e) => {
          logger.error(
            '[_search] Error during userDB query or initial result processing.',
            { error: e }
          )
          sendError(
            e instanceof Error ? e.message : String(e),
            'userDb_query_or_initial_processing'
          )
          logger.silly(
            '[_search] Exiting search request handler (userDb error).'
          )
        })
    } else {
      logger.warn(
        '[_search] Invalid parameters detected. Sending 400 response.'
      )
      send(res, 400, errMsg('invalidParam'))
      logger.silly(
        '[_search] Exiting search request handler (invalid parameters).'
      )
    }
  }
}

export default _search
