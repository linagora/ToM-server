/* istanbul ignore file */
import { type TwakeLogger } from '@twake/logger'
import { type Client, type SearchOptions } from 'ldapts'
import * as ldapts from 'ldapts'
import { type Config, type DbGetResult } from '../types'
import { type UserDBBackend } from './index'
import _ from 'lodash'

class UserDBLDAP implements UserDBBackend {
  base: string
  filter: string
  ready: Promise<void>
  ldap: () => Promise<Client>

  constructor(conf: Config, private readonly logger: TwakeLogger) {
    this.logger = logger
    this.base = conf.ldap_base != null ? conf.ldap_base : ''
    this.filter =
      conf.ldap_filter != null ? conf.ldap_filter : '(objectClass=*)'
    const ldaptsOpts = conf.ldapts_opts != null ? conf.ldapts_opts : {}
    this.ldap = (): Promise<Client> => {
      this.logger.debug(
        '[UserDBLDAP][constructor] Attempting to create LDAP client.'
      )
      const client = new ldapts.Client({
        ...ldaptsOpts,
        url: conf.ldap_uri != null ? conf.ldap_uri : ''
      })
      return new Promise((resolve, reject) => {
        if (
          conf.ldap_user != null &&
          conf.ldap_user.length > 0 &&
          conf.ldap_password != null
        ) {
          this.logger.info(
            `[UserDBLDAP][constructor] Binding to LDAP as user: ${conf.ldap_user}`
          )
          client
            .bind(conf.ldap_user, conf.ldap_password)
            .then(() => {
              this.logger.info(
                '[UserDBLDAP][constructor] LDAP client bound successfully.'
              )
              resolve(client)
            })
            .catch((e) => {
              this.logger.error(
                `[UserDBLDAP][constructor] Failed to bind to LDAP: ${e}`
              )
              reject(e)
            })
        } else {
          this.logger.info(
            '[UserDBLDAP][constructor] Connecting to LDAP anonymously.'
          )
          resolve(client)
        }
      })
    }
    this.ready = new Promise((resolve, reject) => {
      this.logger.debug(
        '[UserDBLDAP][constructor] Checking LDAP connection readiness.'
      )
      this.ldap()
        .then((cli) => {
          this.logger.debug(
            '[UserDBLDAP][constructor] LDAP client obtained for readiness check, unbinding.'
          )
          cli.unbind().catch((e) => {
            this.logger.warn(
              `[UserDBLDAP][constructor] Error during unbind after readiness check: ${e}`
            )
          })
          this.logger.info(
            '[UserDBLDAP][constructor] LDAP connection test successful.'
          )
          resolve()
        })
        .catch((e) => {
          this.logger.error(
            `[UserDBLDAP][constructor] Failed to test ldap: ${e}`
          )
          this.logger.error(
            `[UserDBLDAP][constructor] URI: ${conf.ldap_uri ?? 'undef'}`
          )
          resolve()
        })
    })
  }

  _get(
    table: string,
    filter: string,
    fields?: string[],
    order?: string
  ): Promise<DbGetResult> {
    this.logger.debug(
      `[UserDBLDAP][_get] _get called with table: ${table}, filter: ${filter}, fields: ${fields}, order: ${order}`
    )
    return new Promise((resolve, reject) => {
      const opts: SearchOptions = {
        filter: filter,
        scope: 'sub'
      }
      if (fields != null && fields.length > 0) {
        opts.attributes = fields
        this.logger.silly(
          `[UserDBLDAP][_get] Search options attributes set: ${fields.join(
            ', '
          )}`
        )
      }

      this.ldap()
        .then((client) => {
          this.logger.debug(
            `[UserDBLDAP][_get] Performing LDAP search on base: ${this.base} with filter: ${filter}`
          )
          client
            .search(this.base, opts)
            .then(({ searchEntries, searchReferences }) => {
              this.logger.debug(
                `[UserDBLDAP][_get] Raw search entries: ${JSON.stringify(
                  searchEntries,
                  null,
                  2
                )}`
              )
              const entries: Array<Record<string, string | string[] | number>> =
                []
              searchEntries.forEach((entry, index) => {
                this.logger.silly(
                  `[UserDBLDAP][_get] Processing entry index ${index}: ${JSON.stringify(
                    entry
                  )}`
                )
                const res: Record<string, string | string[] | number> = {}
                if (fields != null && fields.length > 0) {
                  fields.forEach((k) => {
                    res[k] = (
                      _.isBuffer(entry[k])
                        ? entry[k].toString()
                        : _.isArray(entry[k])
                        ? entry[k][0]
                        : entry[k]
                    ) as string
                    this.logger.silly(
                      `[UserDBLDAP][_get] Extracted field [${k}]: ${res[k]}`
                    )
                  })
                } else {
                  Object.keys(entry).forEach((k) => {
                    if (k !== 'controls') {
                      res[k] = (
                        _.isBuffer(entry[k])
                          ? entry[k].toString()
                          : _.isArray(entry[k])
                          ? entry[k][0]
                          : entry[k]
                      ) as string
                      this.logger.silly(
                        `[UserDBLDAP][_get] Extracted field [${k}]: ${res[k]}`
                      )
                    }
                  })
                }
                let realEntry = Object.values(res).some((v) => v != null)
                if (realEntry) {
                  entries.push(res)
                  this.logger.debug(
                    `[UserDBLDAP][_get] Processed entry added: ${JSON.stringify(
                      res
                    )}`
                  )
                } else {
                  this.logger.silly('[UserDBLDAP][_get] Skipped empty entry.')
                }
              })

              if (entries.length > 0 && order != null) {
                this.logger.debug(
                  `[UserDBLDAP][_get] Sorting entries by: ${order}`
                )
                entries.sort((a, b) => {
                  if (a[order] == null) return b[order] == null ? 0 : -1
                  if (b[order] == null) return 1
                  if (a[order] > b[order]) return 1
                  if (a[order] < b[order]) return -1
                  return 0
                })
              }
              client.unbind().catch((e) => {
                this.logger.warn(
                  `[UserDBLDAP][_get] Error during unbind after search: ${e}`
                )
              })
              this.logger.info(
                `[UserDBLDAP][_get] Resolved _get with ${entries.length} entries.`
              )
              resolve(entries)
            })
            .catch((e) => {
              this.logger.error(`[UserDBLDAP][_get] LDAP search failed: ${e}`)
              reject(e)
            })
        })
        .catch((e) => {
          this.logger.error(
            `[UserDBLDAP][_get] Failed to get LDAP client for _get operation: ${e}`
          )
          reject(e)
        })
    })
  }

  get(
    table: string,
    fields?: string[],
    filterFields?: Record<string, string | number | string[]>,
    order?: string
  ): Promise<DbGetResult> {
    this.logger.debug(
      `[UserDBLDAP][get] get called with table: ${table}, filterFields: ${JSON.stringify(
        filterFields
      )}`
    )
    let specificFilter: string = ''

    if (filterFields == null || Object.keys(filterFields).length === 0) {
      specificFilter = '(objectClass=*)'
      this.logger.debug(
        '[UserDBLDAP][get] No filterFields provided, using (objectClass=*)'
      )
    } else {
      const individualFilters: string[] = []
      Object.keys(filterFields)
        .filter(
          (key) =>
            filterFields[key] != null &&
            filterFields[key].toString() !== [].toString()
        )
        .forEach((key) => {
          const value = filterFields[key]
          if (Array.isArray(value)) {
            this.logger.silly(
              `[UserDBLDAP][get] Processing array value for key ${key}: ${value.join(
                ', '
              )}`
            )
            const arrayValueFilters = value
              .map((val) => `(${key}=${val})`)
              .join('')
            individualFilters.push(`(|${arrayValueFilters})`)
          } else {
            this.logger.silly(
              `[UserDBLDAP][get] Processing single value for key ${key}: ${value}`
            )
            individualFilters.push(`(${key}=${value.toString()})`)
          }
        })

      if (individualFilters.length === 0) {
        specificFilter = '(objectClass=*)'
        this.logger.warn(
          '[UserDBLDAP][get] FilterFields provided but no valid individual filters could be constructed, using (objectClass=*)'
        )
      } else if (individualFilters.length === 1) {
        specificFilter = individualFilters[0]
        this.logger.debug(
          `[UserDBLDAP][get] Single individual filter: ${specificFilter}`
        )
      } else {
        specificFilter = `(&${individualFilters.join('')})`
        this.logger.debug(
          `[UserDBLDAP][get] Multiple individual filters combined with AND: ${specificFilter}`
        )
      }
    }

    const finalFilter = `(&${this.filter}${specificFilter})`
    this.logger.info(
      `[UserDBLDAP][get] Final LDAP filter constructed: ${finalFilter}`
    )
    return this._get(table, finalFilter, fields, order)
  }

  match(
    table: string,
    fields: string[],
    searchFields: string[],
    value: string | number
  ): Promise<DbGetResult> {
    this.logger.debug(
      `[UserDBLDAP][match] match called with table: ${table}, searchFields: ${searchFields.join(
        ', '
      )}, value: ${value}`
    )
    if (!Array.isArray(searchFields)) {
      searchFields = [searchFields]
      this.logger.silly(
        '[UserDBLDAP][match] searchFields was not an array, converted to array.'
      )
    }

    if (searchFields.length === 0) {
      this.logger.warn(
        '[UserDBLDAP][match] No searchFields provided for match method, returning empty array.'
      )
      return Promise.resolve([])
    }

    let specificFilter = searchFields.reduce((prev, current) => {
      return `${prev}(${current}=*${value}*)`
    }, '')
    if (searchFields.length > 1) {
      specificFilter = `(|${specificFilter})`
      this.logger.debug(
        `[UserDBLDAP][match] Multiple search fields, combined with OR: ${specificFilter}`
      )
    } else {
      this.logger.debug(
        `[UserDBLDAP][match] Single search field filter: ${specificFilter}`
      )
    }

    const finalFilter = `(&${this.filter}${specificFilter})`
    this.logger.info(
      `[UserDBLDAP][match] Final LDAP filter for match: ${finalFilter}`
    )
    return this._get(table, finalFilter, fields)
  }

  getAll(
    table: string,
    fields: string[],
    order?: string
  ): Promise<DbGetResult> {
    this.logger.debug(
      `[UserDBLDAP][getAll] getAll called with table: ${table}, fields: ${fields}, order: ${order}`
    )
    return this._get(table, this.filter, fields, order)
  }

  close(): void {
    this.logger.info('[UserDBLDAP][close] UserDBLDAP close method called.')
  }
}

export default UserDBLDAP
