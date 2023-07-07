import configParser, { type ConfigDescription } from '@twake/config-parser'
import { Router } from 'express'
import fs from 'fs'
import AppServiceAPI from './application-server'
import defaultConfig from './config.json'
import initializeDb, { type TwakeDB } from './db'
import IdServer from './identity-server'
import mutualRoomsAPIRouter from './mutual-rooms-api'
import privateNoteApiRouter from './private-note-api'
import type { Config, ConfigurationFile } from './types'
import VaultServer from './vault-api'
import WellKnown from './wellKnown'

import { MatrixDB } from '@twake/matrix-identity-server'
import roomTagsAPIRouter from './room-tags-api'
import userInfoAPIRouter from './user-info-api'

export default class TwakeServer {
  endpoints: Router
  ready: Promise<boolean>
  idServer: IdServer
  conf: Config
  db?: TwakeDB
  matrixDb: MatrixDB

  constructor(conf?: Partial<Config>, confDesc?: ConfigDescription) {
    if (confDesc == null) confDesc = defaultConfig as ConfigDescription
    this.conf = configParser(
      confDesc,
      this._getConfigurationFile(conf)
    ) as Config

    this.endpoints = Router()
    this.idServer = new IdServer(this)
    this.matrixDb = new MatrixDB(this.conf)

    this.ready = this.initServer()
  }

  private readonly _getConfigurationFile = (
    conf: Partial<Config> | undefined
  ): ConfigurationFile => {
    if (conf != null) {
      return conf
    }

    if (process.env.TWAKE_SERVER_CONF != null) {
      return process.env.TWAKE_SERVER_CONF
    }

    /* istanbul ignore if */
    if (fs.existsSync('/etc/twake/server.conf')) {
      return '/etc/twake/server.conf'
    }

    /* istanbul ignore next */
    return undefined
  }

  cleanJobs(): void {
    this.idServer.cleanJobs()
  }

  private readonly initServer = async (): Promise<boolean> => {
    try {
      await this.idServer.ready
      await this.matrixDb.ready
      await initializeDb(this)

      const vaultServer = new VaultServer(this.conf, this)
      const wellKnown = new WellKnown(this.idServer.conf)
      const privateNoteApi = privateNoteApiRouter(this.idServer.db, this.conf)
      const mutualRoolsApi = mutualRoomsAPIRouter(
        this.idServer.db,
        this.conf,
        this.matrixDb.db
      )
      const roomTagsApi = roomTagsAPIRouter(
        this.idServer.db,
        this.matrixDb.db,
        this.conf
      )
      const userInfoApi = userInfoAPIRouter(this.idServer, this.conf)
      const appServericeApi = new AppServiceAPI(this)

      this.endpoints.use(privateNoteApi)
      this.endpoints.use(mutualRoolsApi)
      this.endpoints.use(vaultServer.endpoints)
      this.endpoints.use(roomTagsApi)
      this.endpoints.use(userInfoApi)
      this.endpoints.use(appServericeApi.router.routes)

      Object.keys(this.idServer.api.get).forEach((k) => {
        this.endpoints.get(k, this.idServer.api.get[k])
      })
      Object.keys(this.idServer.api.post).forEach((k) => {
        this.endpoints.post(k, this.idServer.api.post[k])
      })
      this.endpoints.use(vaultServer.endpoints)
      Object.keys(wellKnown.api.get).forEach((k) => {
        this.endpoints.get(k, wellKnown.api.get[k])
      })

      return true
    } catch (error) {
      /* istanbul ignore next */
      console.error('Unable to initialize server')
      /* istanbul ignore next */
      throw Error('Unable to initialize server', { cause: error })
    }
  }
}
