import configParser, { type ConfigDescription } from '@twake/config-parser'
import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake/logger'
import MatrixIdentityServer, { MatrixDB } from '@twake/matrix-identity-server'
import { Router } from 'express'
import fs from 'fs'
import AppServiceAPI from './application-server'
import defaultConfig from './config.json'
import initializeDb, { type TwakeDB } from './db'
import IdServer from './identity-server'
import mutualRoomsAPIRouter from './mutual-rooms-api'
import privateNoteApiRouter from './private-note-api'
import roomTagsAPIRouter from './room-tags-api'
import type { Config, ConfigurationFile, TwakeIdentityServer } from './types'
import userInfoAPIRouter from './user-info-api'
import VaultServer from './vault-api'
import WellKnown from './wellKnown'

abstract class AbstractTwakeServerPublic {
  endpoints: Router
  db?: TwakeDB
  matrixDb: MatrixDB
  ready!: Promise<boolean>
  idServer!: TwakeIdentityServer

  constructor(public conf: Config, public readonly logger: TwakeLogger) {
    this.matrixDb = new MatrixDB(this.conf, this.logger)
    this.endpoints = Router()
  }

  cleanJobs(): void {
    this.idServer.cleanJobs()
  }

  protected readonly initServer = async (): Promise<boolean> => {
    try {
      await this.idServer.ready
      await this.matrixDb.ready
      await initializeDb(this)

      const vaultServer = new VaultServer(this.conf, this)
      const wellKnown = new WellKnown(this.conf)
      const privateNoteApi = privateNoteApiRouter(
        this.idServer.db,
        this.conf,
        this.logger
      )
      const mutualRoolsApi = mutualRoomsAPIRouter(
        this.idServer.db,
        this.conf,
        this.matrixDb.db,
        this.logger
      )
      const roomTagsApi = roomTagsAPIRouter(
        this.idServer.db,
        this.matrixDb.db,
        this.conf,
        this.logger
      )
      const userInfoApi = userInfoAPIRouter(
        this.idServer,
        this.conf,
        this.logger
      )

      this.endpoints.use(privateNoteApi)
      this.endpoints.use(mutualRoolsApi)
      this.endpoints.use(vaultServer.endpoints)
      this.endpoints.use(roomTagsApi)
      this.endpoints.use(userInfoApi)

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
      this.logger.error(`Unable to initialize server: ${error}`)
      /* istanbul ignore next */
      throw Error('Unable to initialize server', { cause: error })
    }
  }
}

class TwakeServerPublicImpl extends AbstractTwakeServerPublic {
  constructor(
    public conf: Config,
    public readonly logger: TwakeLogger,
    confDesc: ConfigDescription
  ) {
    super(conf, logger)
    this.idServer = new MatrixIdentityServer(this.conf, confDesc, this.logger)
    this.ready = this.initServer()
  }
}

class TwakeServerEnterprise extends AbstractTwakeServerPublic {
  constructor(
    public conf: Config,
    public readonly logger: TwakeLogger,
    confDesc: ConfigDescription
  ) {
    super(conf, logger)
    this.idServer = new IdServer(this, confDesc, logger)

    this.ready = new Promise<boolean>((resolve, reject) => {
      this.initServer()
        .then(() => {
          const appServiceApi = new AppServiceAPI(this, confDesc, this.logger)
          this.endpoints.use(appServiceApi.router.routes)
          resolve(true)
        })
        .catch((error) => {
          /* istanbul ignore next */
          this.logger.error(`Unable to initialize server: ${error}`)
          /* istanbul ignore next */
          reject(new Error('Unable to initialize server', { cause: error }))
        })
    })
  }
}

export default class TwakeServer {
  conf: Config
  readonly logger: TwakeLogger
  db?: TwakeDB

  get idServer(): TwakeIdentityServer {
    return this.idServer
  }

  get matrixDb(): MatrixDB {
    return this.matrixDb
  }

  get endpoints(): Router {
    return this.endpoints
  }

  get ready(): Promise<boolean> {
    return this.ready
  }

  constructor(
    conf?: Partial<Config>,
    confDesc?: ConfigDescription,
    logger?: TwakeLogger
  ) {
    if (confDesc == null) confDesc = defaultConfig as ConfigDescription
    this.conf = configParser(
      confDesc,
      TwakeServer._getConfigurationFile(conf)
    ) as Config
    this.logger = logger ?? getLogger(this.conf as unknown as LoggerConfig)
    if (
      process.env.ENABLE_COMPANY_FEATURES === 'true' ||
      (this.conf.enable_company_features as boolean)
    ) {
      return new TwakeServerEnterprise(this.conf, this.logger, confDesc)
    } else {
      return new TwakeServerPublicImpl(this.conf, this.logger, confDesc)
    }
  }

  cleanJobs(): void {
    // istanbul ignore next
    this.cleanJobs()
  }

  private static readonly _getConfigurationFile = (
    conf: Partial<Config> | undefined
  ): ConfigurationFile => {
    if (conf != null) {
      return conf
    }

    /* istanbul ignore if */
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
}
