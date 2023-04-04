import { type UserDBBackend } from './index'
import { type Config } from '../index'
import ldapjs, { type SearchOptions, type Client } from 'ldapjs'

class UserDBLDAP implements UserDBBackend {
  base: string
  ready: Promise<void>
  client: Client
  constructor (conf: Config) {
    this.base = conf.ldap_base
    const ldapjsOpts = conf.ldapjs_opts != null ? conf.ldapjs_opts : {}
    this.client = ldapjs.createClient({
      ...ldapjsOpts,
      url: [conf.ldap_uri]
    })
    this.ready = new Promise((resolve, reject) => {
      /* istanbul ignore if */
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
        filter: `${field}=${value}`,
        scope: 'sub'
      }
      if (fields.length > 0) opts.attributes = fields
      this.client.search(this.base, opts, (err, res) => {
        const entries: Array<Record<string, string | string[] | number >> = []
        /* istanbul ignore else */
        if (err == null) {
          res.on('error', (err) => {
            /* istanbul ignore next */
            reject(err)
          })
          res.on('searchEntry', (entry) => {
            const res: Record<string, string | string[] | number > = {}
            if (fields.length > 0) {
              fields.forEach(k => {
                res[k] = entry.object[k]
              })
            } else {
              Object.keys(entry.object).forEach(k => {
                if (k !== 'controls') res[k] = entry.object[k]
              })
            }
            entries.push(res)
          })
          res.on('end', () => {
            if (entries.length > 0) {
              resolve(entries)
            } else {
              reject(new Error('No result'))
            }
          })
        } else {
          reject(err)
        }
      })
    })
  }
}

export default UserDBLDAP
