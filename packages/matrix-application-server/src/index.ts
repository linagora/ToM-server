import {
  allowCors,
  type expressAppHandlerError,
  type expressAppHandler,
  legacyEndpointHandler,
  methodNotAllowed,
  Endpoints
} from './utils'
import transaction from './controllers/transaction'
import { Router, json, urlencoded } from 'express'
import { type AppServerController } from './controllers/utils'
import { errorMiddleware } from './errors'
import fs from 'fs'
import configParser, { type ConfigDescription } from '@twake/config-parser'
import defaultConfDesc from './config.json'
import AppServiceRegistration, { type Namespaces } from './utils/registration'
import auth from './middlewares/auth'
import validation from './middlewares/validation'
import { type ValidationChain } from 'express-validator'

export interface Config {
  application_server_url: string
  sender_localpart: string
  registration_file_path: string
  namespaces: Namespaces
}

export default class MatrixApplicationServer {
  endpoints: Router
  conf: Config
  appServiceRegistration: AppServiceRegistration
  lastProcessedTxnId = ''

  /**
   * Construct a new application service.
   * @constructor
   * @param {Partial<Config>} conf The configuration object for the service
   * @param {ConfigDescription} confDesc The default configuration object
   */
  constructor(conf?: Partial<Config>, confDesc?: ConfigDescription) {
    if (confDesc == null) confDesc = defaultConfDesc as ConfigDescription
    this.conf = configParser(
      confDesc,
      this._getConfigurationFile(conf)
    ) as Config
    this.appServiceRegistration = new AppServiceRegistration(this.conf)
    this.appServiceRegistration.createRegisterFile(
      this.conf.registration_file_path
    )
    this.endpoints = Router()
    this.endpoints
      .route('/_matrix/app/v1/transactions/:txnId')
      .put(this._middlewares(transaction, Endpoints.TRANSACTIONS))
      .all(allowCors, methodNotAllowed, errorMiddleware)

    this.endpoints.all(
      /^\/users|rooms|transactions\/:[a-zA-Z0-9]/g,
      legacyEndpointHandler
    )
  }

  /**
   * Get an array of middlewares that the request should go through
   * @param {AppServerController} controller Endpoint main middleware
   * @return {Array<expressAppHandler | expressAppHandlerError>} Array of middlewares
   */
  private _middlewares(
    controller: AppServerController,
    endpoint: string
  ): Array<expressAppHandler | expressAppHandlerError | ValidationChain> {
    return [
      allowCors,
      json(),
      urlencoded({ extended: false }),
      auth(this.appServiceRegistration.hsToken),
      ...validation(endpoint),
      controller(this),
      errorMiddleware
    ]
  }

  /**
   * Return the server configuration object or the path to the configuration file, otherwise the default config will be used
   * @param {Partial<Config> | undefined} conf Object containing the server configuration
   * @return {object | fs.PathOrFileDescriptor | undefined} The server configuration object, the configuration file path or undefined
   */
  private _getConfigurationFile(
    conf: Partial<Config> | undefined
  ): object | fs.PathOrFileDescriptor | undefined {
    /* istanbul ignore else */
    if (conf != null) {
      return conf
    } else if (process.env.TWAKE_AS_SERVER_CONF != null) {
      return process.env.TWAKE_AS_SERVER_CONF
    } else if (fs.existsSync('/etc/twake/as-server.conf')) {
      return '/etc/twake/as-server.conf'
    } else {
      return undefined
    }
  }
}
