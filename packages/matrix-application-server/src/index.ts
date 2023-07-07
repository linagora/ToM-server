import configParser, { type ConfigDescription } from '@twake/config-parser'
import { EventEmitter } from 'events'
import fs from 'fs'
import defaultConfDesc from './config.json'
import MASRouter from './routes'
import { AppServiceRegistration, type Namespaces } from './utils'

export interface Config {
  base_url: string
  sender_localpart: string
  registration_file_path: string
  namespaces?: Namespaces
  push_ephemeral?: boolean
}

export {
  AppServerAPIError,
  type expressAppHandler
} from './utils'

export declare interface AppService {
  /**
   * Emitted when an event is pushed to the appservice.
   * The format of the event object is documented at
   * https://matrix.org/docs/spec/application_service/r0.1.2#put-matrix-app-v1-transactions-txnid
   * @event
   * @example
   * appService.on("event", function(ev) {
   *   console.log("ID: %s", ev.event_id);
   * });
   */
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  on(event: 'event', cb: (event: Record<string, unknown>) => void): this
  /**
   * Emitted when an ephemeral event is pushed to the appservice.
   * The format of the event object is documented at
   * https://github.com/matrix-org/matrix-doc/pull/2409
   * @event
   * @example
   * appService.on("ephemeral", function(ev) {
   *   console.log("ID: %s", ev.type);
   * });
   */
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  on(event: 'ephemeral', cb: (event: Record<string, unknown>) => void): this
  /**
   * Emitted when an event of a particular type is pushed
   * to the appservice. This will be emitted *in addition*
   * to "event"
   * @event
   * @param event Should start with "type:"
   * @example
   * appService.on("type:m.room.message", function(event) {
   *   console.log("ID: %s", ev.content.body);
   * });
   */
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  on(event: string, cb: (event: Record<string, unknown>) => void): this
}

export default class MatrixApplicationServer extends EventEmitter {
  router: MASRouter
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
    super()
    if (confDesc == null) confDesc = defaultConfDesc as ConfigDescription
    this.conf = configParser(
      confDesc,
      this._getConfigurationFile(conf)
    ) as Config
    this.appServiceRegistration = new AppServiceRegistration(this.conf)
    this.appServiceRegistration.createRegisterFile(
      this.conf.registration_file_path
    )
    this.router = new MASRouter(this)
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
