import { type UserDBBackend } from './index'
import { type Config } from '../index'
import ldapjs, { type SearchOptions, type Client } from 'ldapjs'

class UserDBLDAP implements UserDBBackend {
  base: string
  ready: Promise<void>
  ldap: () => Promise<Client>
  constructor(conf: Config) {
    this.base = conf.ldap_base != null ? conf.ldap_base : ''
    const ldapjsOpts = conf.ldapjs_opts != null ? conf.ldapjs_opts : {}
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    this.ldap = (): Promise<Client> => {
      const client = ldapjs.createClient({
        ...ldapjsOpts,
        url: [conf.ldap_uri != null ? conf.ldap_uri : '']
      })
      return new Promise((resolve, reject) => {
        if (
          conf.ldap_user != null &&
          conf.ldap_user.length > 0 &&
          conf.ldap_password != null
        ) {
          client.bind(conf.ldap_user, conf.ldap_password, (err) => {
            if (err == null) {
              resolve(client)
            } else {
              reject(err)
            }
          })
        } else {
          resolve(client)
        }
      })
    }
    this.ready = Promise.resolve()
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  _get(
    table: string,
    filter: string,
    fields?: string[]
  ): Promise<Array<Record<string, string | string[] | number>>> {
    return new Promise((resolve, reject) => {
      const opts: SearchOptions = {
        filter,
        scope: 'sub'
      }
      if (fields != null && fields.length > 0) opts.attributes = fields
      this.ldap()
        .then((client) => {
          client.search(this.base, opts, (err, res) => {
            const entries: Array<Record<string, string | string[] | number>> =
              []
            /* istanbul ignore else */
            if (err == null) {
              res.on('error', (err) => {
                /* istanbul ignore next */
                reject(err)
              })
              res.on('searchEntry', (entry) => {
                const res: Record<string, string | string[] | number> = {}
                if (fields != null && fields.length > 0) {
                  fields.forEach((k) => {
                    res[k] = entry.object[k]
                  })
                } else {
                  Object.keys(entry.object).forEach((k) => {
                    if (k !== 'controls') res[k] = entry.object[k]
                  })
                }
                entries.push(res)
              })
              res.on('end', () => {
                if (entries.length > 0) {
                  client.destroy()
                  resolve(entries)
                } else {
                  client.destroy()
                  reject(new Error('No result'))
                }
              })
            } else {
              client.destroy()
              reject(err)
            }
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
    field?: string,
    value?: string | number | Array<string | number>
  ): Promise<Array<Record<string, string | string[] | number>>> {
    let filter: string
    if (field == null || value == null) {
      /* istanbul ignore next */
      filter = '(objectClass=*)'
    } else {
      if (typeof value !== 'object') value = [value]
      filter = value.reduce((prev, current) => {
        return `${prev}(${field}=${current})`
      }, '') as string
      if (value.length > 1) filter = `(|${filter})`
    }

    return this._get(table, filter, fields)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  match(
    table: string,
    fields: string[],
    searchFields: string[],
    value: string | number
  ): Promise<Array<Record<string, string | string[] | number>>> {
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
    fields: string[]
  ): Promise<Array<Record<string, string | string[] | number>>> {
    return this.get(table, fields, 'objectClass', '*')
  }

  close(): void {}
}

export default UserDBLDAP
