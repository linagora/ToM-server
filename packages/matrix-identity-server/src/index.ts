// Internal libraries
import versions from './versions'
import configParser from '@twake/config-parser'
import confDesc from './config.json'
import fs from 'fs'

// types
import { send, type expressAppHandler } from './utils'
import { errMsg } from './utils/errors'
import register from './account/register'
import IdentityServerDb, { type SupportedDatabases } from './db'
import account from './account'
import logout from './account/logout'
import status from './status'
import Terms, { type Policies } from './terms'
import RequestToken from './validate/email/requestToken'
import SubmitToken from './validate/email/submitToken'
import PostTerms from './terms/index.post'

type IdServerAPI = Record<string, expressAppHandler>

export interface Config {
  base_url: string
  database_engine: SupportedDatabases
  database_host: string
  database_vacuum_delay: number
  key_delay: number
  keys_depth: number
  mail_link_delay: number
  policies?: Policies | string | null
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

  db?: IdentityServerDb

  conf: Config

  ready: Promise<boolean>

  constructor (conf?: Config) {
    this.conf = configParser(
      confDesc,
      /* istanbul ignore next */
      conf != null
        ? conf
        : process.env.TWAKE_IDENTITY_SERVER_CONF != null
          ? process.env.TWAKE_IDENTITY_SERVER_CONF
          : fs.existsSync('/etc/twake/identity-server.conf')
            ? '/etc/twake/identity-server.conf'
            : undefined) as Config
    this.ready = new Promise((resolve, reject) => {
      const db = this.db = new IdentityServerDb(this.conf)
      db.ready.then(() => {
        const badMethod: expressAppHandler = (req, res) => {
          send(res, 405, errMsg('unrecognized'))
        }
        // TODO
        // const badEndPoint: expressAppHandler = (req, res) => {
        //   send(res, 404, errMsg('unrecognized'))
        // }
        this.api = {
          get: {
            '/_matrix/identity/v2': status,
            '/_matrix/identity/versions': versions,
            '/_matrix/identity/v2/account': account(db),
            '/_matrix/identity/v2/account/register': badMethod,
            '/_matrix/identity/v2/account/logout': badMethod,
            '/_matrix/identity/v2/terms': Terms(this.conf),
            '/_matrix/identity/v2/validate/email/requestToken': badMethod,
            '/_matrix/identity/v2/validate/email/submitToken': SubmitToken(db, this.conf)
          },
          post: {
            '/_matrix/identity/v2': badMethod,
            '/_matrix/identity/versions': badMethod,
            '/_matrix/identity/v2/account': badMethod,
            '/_matrix/identity/v2/account/register': register(db),
            '/_matrix/identity/v2/account/logout': logout(db),
            '/_matrix/identity/v2/terms': PostTerms(db, this.conf),
            '/_matrix/identity/v2/validate/email/requestToken': RequestToken(db, this.conf),
            '/_matrix/identity/v2/validate/email/submitToken': SubmitToken(db, this.conf)
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
