import { type TwakeLogger } from '@twake/logger'
import { errMsg, send, toMatrixId } from '@twake/utils'
import { type Response } from 'express'
import type http from 'http'
import type TwakeIdentityServer from '..'
import { AddressbookService } from '../../addressbook-api/services'
import { type Contact } from '../../addressbook-api/types'

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
  return async (res, data) => {
    const sendError = (e: string): void => {
      /* istanbul ignore next */
      logger.error('Autocompletion error', e)
      /* istanbul ignore next */
      send(res, 500, errMsg('unknown', e))
    }
    let fields = data.fields
    let scope = data.scope
    /* istanbul ignore if */
    if (fields == null) fields = []
    /* istanbul ignore if */
    if (typeof scope !== 'object') scope = [scope]
    let error = false
    fields.forEach((v) => {
      /* istanbul ignore next */
      if (!SearchFields.has(v)) error = true
    })
    scope.forEach((v) => {
      /* istanbul ignore next */
      if (!SearchFields.has(v)) error = true
    })
    /* istanbul ignore else */
    if (!error) {
      const owner = data.owner ?? '';
      const addressBookService = new AddressbookService(idServer.db, logger)
      let contacts: Contact[] = [];

      if (owner.length !== 0) {
        ({ contacts } = await addressBookService.list(owner));
        logger.info(`Found ${contacts.length} contacts in addressbook for owner ${owner}`);
      }

      const val = data.val?.toLowerCase() ?? ''
      const normalizedScope = scope.map((f) =>
        f === 'matrixAddress' ? 'uid' : f
      )

      if (val.length > 0) {
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
            return fieldVal?.toLowerCase().includes(val)
          })
        )
      }

      const contactMap = new Map<string, any>()
      for (const contact of contacts) {
        const uid = contact.mxid?.replace(/^@(.*?):.*/, '$1')
        if (uid.length > 0) {
          contactMap.set(uid, {
            uid,
            cn: contact.display_name,
            address: contact.mxid
          })
        }
      }
      const _fields = fields.includes('uid') ? fields : [...fields, 'uid']
      const _scope = scope.map((f) => (f === 'matrixAddress' ? 'uid' : f))
      const value = data.val?.replace(/^@(.*?):(?:.*)$/, '$1')
      const request =
        (idServer.conf.additional_features === true)
          ? typeof value === 'string' && value.length > 0
            ? idServer.userDB.match('users', _fields, _scope, value, _fields[0])
            : idServer.userDB.getAll('users', _fields, _fields[0])
          : Promise.resolve([])
      request
        .then((rows) => {
          if (rows.length === 0 && contactMap.size === 0) {
            /* istanbul ignore next */
            send(res, 200, { matches: [], inactive_matches: [] })
          } else {
            const start = data.offset ?? 0
            const end = start + (data.limit ?? 30)
            rows = rows.slice(start, end)
            const mUid = rows.map((v) => {
              return toMatrixId(v.uid as string, idServer.conf.server_name)
            })
            /**
             * For the record, this can be replaced by a call to
             * <matrix server>/_matrix/app/v1/users/{userId}
             *
             * See https://spec.matrix.org/v1.6/application-service-api/#get_matrixappv1usersuserid
             */
            idServer.matrixDb
              .get('users', ['*'], { name: mUid })
              .then((matrixRows) => {
                const mUids: Record<string, true> = {}
                const matches: typeof rows = []
                // eslint-disable-next-line @typescript-eslint/naming-convention
                const inactive_matches: typeof rows = []

                for (const mrow of matrixRows) {
                  mUids[
                    (mrow.name as string).replace(/^@(.*?):(?:.*)$/, '$1')
                  ] = true
                }

                for (const row of rows) {
                  row.address = toMatrixId(
                    row.uid as string,
                    idServer.conf.server_name
                  )

                  const uid = row.uid as string

                  if (contactMap.has(uid)) {
                    row.cn = contactMap.get(uid).cn // Update display name from addressbook
                    contactMap.delete(uid)
                  }

                  if (mUids[uid]) {
                    matches.push(row)
                  } else {
                    inactive_matches.push(row)
                  }
                }

                // Merge remaining contacts from Map into matches
                for (const contact of contactMap.values()) {
                  matches.push(contact)
                }

                send(res, 200, {
                  matches,
                  inactive_matches
                })
              })
              .catch(sendError)
          }
        })
        .catch(sendError)
    } else {
      send(res, 400, errMsg('invalidParam'))
    }
  }
}

export default _search
