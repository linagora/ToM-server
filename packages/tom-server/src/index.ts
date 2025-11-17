import configParser, { type ConfigDescription } from '@twake/config-parser'
import {
  getLogger,
  type Config as LoggerConfig,
  type TwakeLogger
} from '@twake/logger'
import { MatrixDB } from '@twake/matrix-identity-server'
import { Router } from 'express'
import fs from 'fs'
import defaultConfig from './config.json'
import IdServer from './identity-server'
import smsApiRouter from './sms-api'
import type { Config, ConfigurationFile, TwakeDB } from './types'
import userInfoAPIRouter from './user-info-api'
import VaultServer from './vault-api'
import WellKnown from './wellKnown'
import ActiveContacts from './active-contacts-api'
import QRCode from './qrcode-api'
import MetricsRouter from './metrics-api'
import Invitation from './invitation-api'
import AddressBook from './addressbook-api'
import DeactivateAccount from './deactivate-account-api'
import AdminSettings from './admin-settings-api'
import MatrixclientApi from './matrix-api/client'

export default class TwakeServer {
  conf: Config
  readonly logger: TwakeLogger
  endpoints: Router
  db?: TwakeDB
  matrixDb: MatrixDB
  ready!: Promise<boolean>
  idServer!: IdServer

  constructor(
    conf?: Partial<Config>,
    confDesc?: ConfigDescription,
    logger?: TwakeLogger
  ) {
    if (confDesc == null) confDesc = defaultConfig as ConfigDescription
    this.conf = configParser(
      confDesc,
      this._getConfigurationFile(conf)
    ) as Config
    this.logger = logger ?? getLogger(this.conf as unknown as LoggerConfig)
    this.matrixDb = new MatrixDB(this.conf, this.logger)
    this.idServer = new IdServer(
      this.matrixDb,
      this.conf,
      confDesc,
      this.logger
    )

    this.endpoints = Router()
    this.ready = new Promise<boolean>((resolve, reject) => {
      this._initServer(confDesc)
        .then(() => {
          resolve(true)
        })
        .catch((error) => {
          /* istanbul ignore next */
          this.logger.error(`Unable to initialize server`, { error })
          /* istanbul ignore next */
          reject(new Error('Unable to initialize server', { cause: error }))
        })
    })
  }

  cleanJobs(): void {
    this.idServer.cleanJobs()
    this.matrixDb.close()
  }

  private _getConfigurationFile(
    conf: Partial<Config> | undefined
  ): ConfigurationFile {
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

  private async _initServer(confDesc?: ConfigDescription): Promise<boolean> {
    await this.idServer.ready
    this.db = this.idServer.db
    this.db.cleanByExpires.push('matrixTokens')
    this.logger.debug('idServer initialized')
    await this.matrixDb.ready
    this.logger.debug('Connected to Matrix DB')
    this.logger.debug('Main database initialized')

    const vaultServer = new VaultServer(this.db, this.idServer.authenticate)
    const wellKnown = new WellKnown(this.conf)

    const userInfoApi = userInfoAPIRouter(
      this.idServer,
      this.conf,
      this.matrixDb,
      this.logger
    )

    const smsApi = smsApiRouter(
      this.conf,
      this.idServer.authenticate,
      this.logger
    )

    const activeContactsApi = ActiveContacts(
      this.idServer.db,
      this.conf,
      this.idServer.authenticate,
      this.logger
    )
    const qrCodeApi = QRCode(this.idServer, this.conf, this.logger)
    const metricsApi = MetricsRouter(
      this.conf,
      this.matrixDb.db,
      this.idServer.authenticate,
      this.logger
    )
    const invitationApi = Invitation(
      this.conf,
      this.idServer.db,
      this.idServer.authenticate,
      this.logger
    )

    const addressbookApi = AddressBook(
      this.conf,
      this.idServer.db,
      this.idServer.authenticate,
      this.logger
    )

    const deactivateAccountApi = DeactivateAccount(
      this.conf,
      this.matrixDb.db,
      this.logger
    )

    const adminSettingsApi = AdminSettings(this.conf, this.logger)

    const matrixClientApi = MatrixclientApi(
      this.conf,
      this.idServer.authenticate,
      this.logger
    )

    this.endpoints.use(vaultServer.endpoints)
    this.endpoints.use(userInfoApi)
    this.endpoints.use(smsApi)
    this.endpoints.use(activeContactsApi)
    this.endpoints.use(qrCodeApi)
    this.endpoints.use(metricsApi)
    this.endpoints.use(invitationApi)
    this.endpoints.use(addressbookApi)
    this.endpoints.use(deactivateAccountApi)
    this.endpoints.use(adminSettingsApi)
    this.endpoints.use(matrixClientApi)

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
  }
}
