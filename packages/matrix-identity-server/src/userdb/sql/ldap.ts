import { type UserDBBackend } from '..'
import { type Config } from '../..'
import ldapjs, { type SearchOptions, type Client } from 'ldapjs'

class UserDBLDAP implements UserDBBackend {
  base: string
  ready: Promise<void>
  filter: string
  client: Client
  constructor (conf: Config) {
    this.filter = conf.ldap_filter
    this.base = conf.ldap_base
    const ldapjsOpts = conf.ldapjs_opts != null ? conf.ldapjs_opts : {}
    this.client = ldapjs.createClient({
      ...ldapjsOpts,
      url: [conf.ldap_uri]
    })
    this.ready = new Promise((resolve, reject) => {
      if (conf.ldap_user != null && conf.ldap_user.length > 0) {
        this.client.bind(conf.ldap_user, conf.ldap_password, (err) => {
          if (err != null) {
            reject(err)
          } else {
            resolve()
          }
        })
      } else {
        resolve()
      }
    })
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  get (table: string, fields: string[], field: string, value: string | number): Promise<Array<Record<string, string | string[] | number >>> {
    return new Promise((resolve, reject) => {
      const opts: SearchOptions = {
        filter: this.filter,
        scope: 'sub'
      }
      if (fields.length > 0) opts.attributes = field
      this.client.search(this.base, opts, (err, res) => {
        const entries: Array<Record<string, string | string[] | number >> = []
        if (err != null) {
          reject(err)
        } else {
          res.on('error', (err) => {
            reject(err)
          })
          res.on('searchEntry', (entry) => {
            const res: Record<string, string | string[] | number > = {}
            Object.keys(entry.object).forEach(k => {
              if (k !== 'controls') res[k] = entry.object[k]
            })
            entries.push(entry.object)
          })
          res.on('end', () => {
            if (entries.length > 0) {
              resolve(entries)
            } else {
              reject(new Error('No result'))
            }
          })
        }
      })
    })
  }
}

export default UserDBLDAP
