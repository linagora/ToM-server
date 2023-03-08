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

type IdServerAPI = Record<string, expressAppHandler>

interface Config {
  database_engine: 'sqlite' | 'pg'
  database_host: string
}

export default class MatrixIdentityServer {
  api: {
    get: IdServerAPI
    post: IdServerAPI
    put?: IdServerAPI
  }

  db?: Database

  conf: Config

  constructor () {
    // TODO: insert here all endpoints
    this.api = {
      get: {
        '/': (req, res) => {
          send(res, 403, errMsg('forbidden'))
        },
        '/_matrix/identity/versions': versions
      },
      post: {
        '/_matrix/identity/v2/account/register': register
      }
    }
    this.conf = configParser(
      confDesc,
      /* istanbul ignore next */
      process.env.TWAKE_IDENTITY_SERVER_CONF != null
        ? process.env.TWAKE_IDENTITY_SERVER_CONF
        : fs.existsSync('/etc/twake/identity-server.conf')
          ? '/etc/twake/identity-server.conf'
          : undefined) as Config
    void IdentityServerDb({
      type: this.conf.database_engine,
      host: this.conf.database_host
    }).then(db => {
      this.db = db
    })
  }
}
