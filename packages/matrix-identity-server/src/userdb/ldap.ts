import { type TwakeLogger } from '@twake/logger'
import ldapts, { type Client, type SearchOptions } from 'ldapts'
import { type Config, type DbGetResult } from '../types'
import { type UserDBBackend } from './index'

class UserDBLDAP implements UserDBBackend {
  base: string
  ready: Promise<void>
  ldap: () => Promise<Client>

  constructor(conf: Config, private readonly logger: TwakeLogger) {
    this.logger = logger
    this.base = conf.ldap_base != null ? conf.ldap_base : ''
    const ldaptsOpts = conf.ldapts_opts != null ? conf.ldapts_opts : {}
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    this.ldap = (): Promise<Client> => {
      const client = new ldapts.Client({
        ...ldaptsOpts,
        url: conf.ldap_uri != null ? conf.ldap_uri : ''
      })
      return new Promise((resolve, reject) => {
        /* istanbul ignore if */
        if (
          conf.ldap_user != null &&
          conf.ldap_user.length > 0 &&
          conf.ldap_password != null
        ) {
          client
            .bind(conf.ldap_user, conf.ldap_password)
            .then(() => {
              resolve(client)
            })
            .catch(reject)
        } else {
          resolve(client)
        }
      })
    }
    this.ready = new Promise((resolve, reject) => {
      this.ldap()
        .then((cli) => {
          cli.unbind().catch((e) => {})
          resolve()
        })
        .catch((e) => {
          this.logger.error(`Failed to test ldap: ${e}`)
          this.logger.error(`URI: ${conf.ldap_uri ?? 'undef'}`)
          resolve()
        })
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  _get(
    table: string,
    filter: string,
    fields?: string[],
    order?: string
  ): Promise<DbGetResult> {
    return new Promise((resolve, reject) => {
      const opts: SearchOptions = {
        filter,
        scope: 'sub'
      }
      if (fields != null && fields.length > 0) opts.attributes = fields
      this.ldap()
        .then((client) => {
          client
            .search(this.base, opts)
            .then(({ searchEntries, searchReferences }) => {
              const entries: Array<Record<string, string | string[] | number>> =
                []
              searchEntries.forEach((entry) => {
                const res: Record<string, string | string[] | number> = {}
                if (fields != null && fields.length > 0) {
                  fields.forEach((k) => {
                    res[k] = (
                      typeof entry[k] === 'string'
                        ? entry[k]
                        : entry[k].toString()
                    ) as string
                  })
                } else {
                  Object.keys(entry).forEach((k) => {
                    if (k !== 'controls')
                      res[k] = (
                        typeof entry[k] === 'string'
                          ? entry[k]
                          : entry[k].toString()
                      ) as string
                  })
                }
                let realEntry = false
                Object.keys(res).forEach((k) => {
                  if (res[k] != null) realEntry = true
                })
                if (realEntry) entries.push(res)
              })
              if (entries.length > 0) {
                if (order != null)
                  entries.sort((a, b) => {
                    if (a[order] == null) return b[order] == null ? 0 : -1
                    if (b[order] == null) return 1
                    if (a[order] > b[order]) return 1
                    if (a[order] < b[order]) return -1
                    return 0
                  })
              }
              client.unbind().catch((e) => {})
              resolve(entries)
            })
            .catch((e) => {
              reject(e)
            })
        })
        /* istanbul ignore next */
        .catch(reject)
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  get(
    table: string,
    fields?: string[],
    filterFields?: Record<string, string | number | string[]>,
    order?: string
  ): Promise<DbGetResult> {
    let filter: string = ''
    if (filterFields == null) {
      /* istanbul ignore next */
      filter = '(objectClass=*)'
    } else {
      Object.keys(filterFields)
        .filter(
          (key) =>
            filterFields[key] != null &&
            filterFields[key].toString() !== [].toString()
        )
        .forEach((key) => {
          if (Array.isArray(filterFields[key])) {
            filter += `${(filterFields[key] as string[]).reduce((prev, val) => {
              return `${prev}(${key}=${val})`
            }, '')}`
          } else {
            filter += `(${key}=${filterFields[key].toString()})`
          }
        })
      if (filter !== '') filter = `(|${filter})`
    }

    return this._get(table, filter, fields, order)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  match(
    table: string,
    fields: string[],
    searchFields: string[],
    value: string | number
  ): Promise<DbGetResult> {
    if (typeof searchFields !== 'object') searchFields = [searchFields]
    let filter = searchFields.reduce((prev, current) => {
      return `${prev}(${current}=*${value}*)`
    }, '')
    if (searchFields.length > 1) filter = `(|${filter})`
    return this._get(table, filter, fields)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getAll(
    table: string,
    fields: string[],
    order?: string
  ): Promise<DbGetResult> {
    return this.get(table, fields, undefined, order)
  }

  close(): void {}
}

export default UserDBLDAP
