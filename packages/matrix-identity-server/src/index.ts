// Internal libraries
import versions from './versions'
import configParser from '@twake/config-parser'
import confDesc from './config.json'
import fs from 'fs'

// types
import type { Database } from 'sqlite3'
import { send, type expressAppHandler } from './utils'
import { errMsg } from './utils/errors'
import register from './account/register'
import IdentityServerDb from './db'
import account from './account'
import logout from './account/logout'
import status from './status'
import Terms from './terms'
import RequestToken from './validate/email/requestToken'

type IdServerAPI = Record<string, expressAppHandler>

export interface Config {
  base_url: string
  database_engine: 'sqlite' | 'pg'
  database_host: string
  database_vacuum_delay: number
  server_name: string
  smtp_password?: string
  smtp_port?: number
  smtp_sender?: string
  smtp_server: string
  smtp_tls?: boolean
  smtp_user?: string
  smtp_verify_certificate?: boolean
  template_dir: string
}

export default class MatrixIdentityServer {
  api?: {
    get: IdServerAPI
    post: IdServerAPI
    put?: IdServerAPI
  }

  db?: Database

  conf: Config

  ready: Promise<boolean>

  constructor () {
    this.conf = configParser(
      confDesc,
      /* istanbul ignore next */
      process.env.TWAKE_IDENTITY_SERVER_CONF != null
        ? process.env.TWAKE_IDENTITY_SERVER_CONF
        : fs.existsSync('/etc/twake/identity-server.conf')
          ? '/etc/twake/identity-server.conf'
          : undefined) as Config
    this.ready = new Promise((resolve, reject) => {
      void IdentityServerDb({
        type: this.conf.database_engine,
        host: this.conf.database_host
      }, this.conf).then(db => {
        this.db = db
        // TODO: insert here all endpoints
        this.api = {
          get: {
            '/': (req, res) => {
              send(res, 403, errMsg('forbidden'))
            },
            '/_matrix/identity/v2': status,
            '/_matrix/identity/versions': versions,
            '/_matrix/identity/v2/account': account(this.db),
            '/_matrix/identity/v2/terms': Terms(this.db)
          },
          post: {
            '/_matrix/identity/v2/account/register': register(this.db),
            '/_matrix/identity/v2/account/logout': logout(this.db),
            '/_matrix/identity/v2/validate/email/requestToken': RequestToken(this.db, this.conf)
          }
        }
        resolve(true)
      }).catch(e => {
        /* istanbul ignore next */
        reject(e)
      })
    })
  }
}
