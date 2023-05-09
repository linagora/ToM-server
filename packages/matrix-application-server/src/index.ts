import { Router } from 'express'
import fs from 'fs'
import configParser, { type ConfigDescription } from '@twake/config-parser'
import defaultConfDesc from './config.json'
import AppServiceRegistration, { type Namespaces } from './utils/registration'

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
