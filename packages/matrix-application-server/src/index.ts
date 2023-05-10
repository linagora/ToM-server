import { transaction, query } from './controllers'
import { Router, json, urlencoded } from 'express'
import fs from 'fs'
import configParser, { type ConfigDescription } from '@twake/config-parser'
import defaultConfDesc from './config.json'
import {
  allowCors,
  AppServiceRegistration,
  errorMiddleware,
  legacyEndpointHandler,
  methodNotAllowed,
  Endpoints,
  type expressAppHandlerError,
  type expressAppHandler,
  type Namespaces
} from './utils'
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
      .put(this._middlewares(Endpoints.TRANSACTIONS), transaction(this))
      .all(allowCors, methodNotAllowed, errorMiddleware)

    this.endpoints
      .route('/_matrix/app/v1/users/:userId')
      .get(this._middlewares(Endpoints.USERS), query)
      .all(allowCors, methodNotAllowed, errorMiddleware)

    this.endpoints
      .route('/_matrix/app/v1/rooms/:roomAlias')
      .get(this._middlewares(Endpoints.ROOMS), query)
      .all(allowCors, methodNotAllowed, errorMiddleware)

    this.endpoints.all(
      /^\/users|rooms|transactions\/:[a-zA-Z0-9]/g,
      legacyEndpointHandler
    )
  }

  /**
   * Get an array of middlewares that the request should go through
   * @param {string} endpoint Request resource endpoint
   * @return {Array<expressAppHandler | expressAppHandlerError | ValidationChain>} Array of middlewares
   */
  private _middlewares(
    endpoint: string
  ): Array<expressAppHandler | expressAppHandlerError | ValidationChain> {
    return [
      allowCors,
      json(),
      urlencoded({ extended: false }),
      auth(this.appServiceRegistration.hsToken),
      ...validation(endpoint),
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
