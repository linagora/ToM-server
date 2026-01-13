/**
 * @openapi
 * /.well-known/matrix/client:
 *  get:
 *    tags:
 *      - Auto configuration
 *    description: Get server metadata for auto-configuration
 *    responses:
 *      200:
 *        description: Server metadata used for auto‑configuration
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                m.homeserver:
 *                  type: object
 *                  description: Matrix homeserver information
 *                  properties:
 *                    base_url:
 *                      type: string
 *                      format: uri
 *                      description: Base URL of the Matrix server
 *                m.identity_server:
 *                  type: object
 *                  description: Identity‑server information
 *                  properties:
 *                    base_url:
 *                      type: string
 *                      format: uri
 *                      description: Base URL of the Identity server
 *                org.matrix.msc3575.proxy:
 *                  type: object
 *                  description: Proxy service used by MSC‑3575
 *                  properties:
 *                    url:
 *                      type: string
 *                      format: uri
 *                      description: URL of the proxy service
 *                m.federated_identity_services:
 *                  type: object
 *                  nullable: true
 *                  description: Federated identity services (optional)
 *                  properties:
 *                    base_urls:
 *                      type: array
 *                      items:
 *                        type: string
 *                        format: uri
 *                      description: List of base URLs for each federated identity service
 *                t.server:
 *                  type: object
 *                  description: Twake‑Chat server metadata
 *                  properties:
 *                    base_url:
 *                      type: string
 *                      format: uri
 *                      description: Base URL of the Twake‑Chat server
 *                    server_name:
 *                      type: string
 *                      description: Domain handled by the Matrix server
 *                m.integrations:
 *                  type: object
 *                  description: Integration configuration (currently only Jitsi)
 *                  properties:
 *                    jitsi:
 *                      type: object
 *                      properties:
 *                        preferredDomain:
 *                          type: string
 *                          description: Preferred domain for Jitsi meetings
 *                        baseUrl:
 *                          type: string
 *                          format: uri
 *                          description: Base URL of the Jitsi server
 *                        useJwt:
 *                          type: boolean
 *                          description: Whether the Jitsi server expects a JWT
 *                        jwt:
 *                          type: object
 *                          nullable: true
 *                          description: JWT configuration (present only when `useJwt` is true)
 *                          properties:
 *                            algorithm:
 *                              type: string
 *                              description: Algorithm used to sign the token (e.g. HS256)
 *                            secret:
 *                              type: string
 *                              description: Secret used to sign the token
 *                            issuer:
 *                              type: string
 *                              description: Issuer claim of the token
 *                m.authentication:
 *                  type: object
 *                  nullable: true
 *                  description: OpenID Connect authentication configuration
 *                  properties:
 *                    issuer:
 *                      type: string
 *                      format: uri
 *                      description: URL of the OIDC issuer
 *                app.twake.chat:
 *                  type: object
 *                  description: Twake‑Chat specific configuration (the whole `twake_chat` object)
 *                  properties:
 *                    default_homeserver:
 *                      type: string
 *                      description: Matrix homeserver identifier (value of `config.matrix_server`)
 *                    homeserver:
 *                      type: string
 *                      format: uri
 *                      description: Full URL of the homeserver (`https://<matrix_server>/`)
 *                    common_settings:
 *                      type: object
 *                      description: Feature‑flag group for “Common Settings”
 *                      properties:
 *                        enabled:
 *                          type: boolean
 *                          description: Whether the Common Settings integration is enabled
 *                    matrix_profile_updates_allowed:
 *                      type: boolean
 *                      description: Whether a user may update their Matrix profile from the UI
 *                    application_name:
 *                      type: string
 *                      description: Human‑readable name of the Twake application
 *                    application_welcome_message:
 *                      type: string
 *                      description: Message displayed on the welcome screen
 *                    privacy_url:
 *                      type: string
 *                      format: uri
 *                      description: Link to the privacy‑policy page
 *                    render_html:
 *                      type: boolean
 *                      description: If true, the client renders HTML inside messages
 *                    hide_redacted_events:
 *                      type: boolean
 *                      description: Hide redacted events when true
 *                    hide_unknown_events:
 *                      type: boolean
 *                      description: Hide events of unknown type when true
 *                    issue_id:
 *                      type: string
 *                      description: Identifier used for issue tracking / support tickets
 *                    registration_url:
 *                      type: string
 *                      format: uri
 *                      description: Direct link to the registration page
 *                    twake_workplace_homeserver:
 *                      type: string
 *                      format: uri
 *                      description: Homeserver URL used for the “workplace” integration
 *                    app_grid_dashboard_available:
 *                      type: boolean
 *                      description: Controls exposure of the App‑Grid Dashboard feature
 *                    platform:
 *                      type: string
 *                      description: Target platform identifier (e.g. `web`, `mobile`, `desktop`)
 *                    default_max_upload_avatar_size_in_bytes:
 *                      type: string
 *                      description: Maximum allowed avatar file size (bytes) – stored as a string in the config
 *                    dev_mode:
 *                      type: boolean
 *                      description: Enable dev‑mode UI (extra debugging information)
 *                    qr_code_download_url:
 *                      type: string
 *                      format: uri
 *                      description: URL to download a QR‑code image for mobile login
 *                    enable_logs:
 *                      type: boolean
 *                      description: Enable client‑side logging sent to the server
 *                    support_url:
 *                      type: string
 *                      format: uri
 *                      description: Link to a support portal / help centre
 *                    enable_invitations:
 *                      type: boolean
 *                      description: Allow users to invite external contacts
 *              example:
 *                m.homeserver:
 *                  base_url: https://matrix.docker.localhost/
 *                m.identity_server:
 *                  base_url: https://tom.docker.localhost
 *                org.matrix.msc3575.proxy:
 *                  url: https://syncv3.docker.localhost
 *                t.server:
 *                  base_url: https://tom.docker.localhost
 *                  server_name: docker.localhost
 *                m.integrations:
 *                  jitsi:
 *                    preferredDomain: ""
 *                    baseUrl: ""
 *                    useJwt: false
 *                app.twake.chat:
 *                  application_name: ""
 *                  application_welcome_message: ""
 *                  default_homeserver: matrix.docker.localhost
 *                  privacy_url: ""
 *                  render_html: false
 *                  hide_redacted_events: false
 *                  hide_unknown_events: false
 *                  issue_id: ""
 *                  registration_url: ""
 *                  twake_workplace_homeserver: ""
 *                  app_grid_dashboard_available: false
 *                  platform: ""
 *                  default_max_upload_avatar_size_in_bytes: ""
 *                  dev_mode: false
 *                  qr_code_download_url: ""
 *                  enable_logs: false
 *                  support_url: ""
 *                  enable_invitations: false
 *                  homeserver: https://matrix.docker.localhost/
 *                  common_settings:
 *                    enabled: false
 *                  matrix_profile_updates_allowed: false
 *                m.federated_identity_services:
 *                  base_urls:
 *                    - https://global-federated-identity-service.twake.app/
 *                    - https://other-federated-identity-service.twake.app/
 *                    - https://fed.docker.localhost/
 *                m.authentication:
 *                  issuer: https://auth.docker.localhost
 */

import { send } from '@twake-chat/utils'
import type { TwakeChatConfig, Config, expressAppHandler } from '../types'
import { buildUrl } from '../utils'

interface WellKnownType {
  'm.homeserver': {
    base_url: string
  }
  'm.identity_server': {
    base_url: string
  }
  'org.matrix.msc3575.proxy': {
    url: string
  }
  'm.federated_identity_services'?: {
    base_urls: string[] | string
  }
  't.server'?: {
    base_url: string
    server_name?: string
  }
  'm.integrations': {
    jitsi: {
      preferredDomain: string
      baseUrl: string
      useJwt: boolean
      jwt?: {
        algorithm: string
        secret: string
        issuer: string
      }
    }
  }
  'm.authentication'?: {
    issuer: string
    account?: string
  }
  'app.twake.chat'?: TwakeChatConfig
}

class WellKnown {
  api: {
    get: Record<string, expressAppHandler>
  }

  _wellKnownClient: expressAppHandler

  constructor(conf: Config) {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this._wellKnownClient = async (_req, res) => {
      const matrixConfig = await this._getConfigFromMatrixServer(
        conf.matrix_internal_host
      )
      const wellKnown: WellKnownType = {
        'm.homeserver': {
          base_url: `https://${conf.matrix_server}/`
        },
        'm.identity_server': {
          base_url: conf.base_url
        },
        'org.matrix.msc3575.proxy': {
          url: `https://syncv3.${conf.server_name}`
        },
        't.server': {
          base_url: conf.base_url,
          server_name: conf.server_name
        },
        'm.integrations': {
          jitsi: {
            preferredDomain: conf.jitsiPreferredDomain,
            baseUrl: conf.jitsiBaseUrl,
            useJwt: conf.jitsiUseJwt
          }
        },
        'app.twake.chat': this._getTwakeChatConfig(conf),
        ...matrixConfig
      }

      conf.federated_identity_services =
        typeof conf.federated_identity_services === 'object'
          ? conf.federated_identity_services
          : typeof conf.federated_identity_services === 'string'
          ? (conf.federated_identity_services as string).split(/[,\s]+/)
          : []

      if (
        conf.federated_identity_services != null &&
        conf.federated_identity_services.length > 0
      ) {
        wellKnown['m.federated_identity_services'] = {
          base_urls: conf.federated_identity_services.map(
            (address) => `https://${address}/`
          )
        }
      }

      /* istanbul ignore if */ // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (conf.jitsiUseJwt) {
        wellKnown['m.integrations'].jitsi.jwt = {
          algorithm: conf.jitsiJwtAlgorithm,
          secret: conf.jitsiJwtSecret,
          issuer: conf.jitsiJwtIssuer
        }
      }
      if (conf.oidc_issuer != null && conf.oidc_issuer.length >= 0) {
        wellKnown['m.authentication'] = {
          issuer: conf.oidc_issuer
        }
      }
      send(res, 200, wellKnown)
    }
    this.api = {
      get: {
        '/.well-known/matrix/client': this._wellKnownClient,
        '/.well-known/twake/client': this._wellKnownClient
      }
    }
  }

  /**
   * Return the Twake chat configuration object
   *
   * @param {Config} config - the application config
   * @returns {TwakeChatConfig} the Twake chat configuration object
   */
  private readonly _getTwakeChatConfig = (config: Config): TwakeChatConfig => {
    return {
      ...config.twake_chat,
      default_homeserver: config.matrix_server,
      homeserver: `https://${config.matrix_server}/`,
      common_settings: {
        enabled: config.features.common_settings.enabled,
        application_url: config.features.common_settings.application_url
      },
      matrix_profile_updates_allowed:
        config.features.matrix_profile_updates_allowed
    }
  }

  private readonly _getConfigFromMatrixServer = async (
    matrixServer: string
  ): Promise<any> => {
    try {
      const apiUrl = buildUrl(matrixServer, '.well-known/matrix/client')
      const res = await fetch(apiUrl)
      if (!res.ok) {
        throw new Error(
          `Failed to fetch config from ${matrixServer}: ${res.status}`
        )
      }
      const matrixConfig = await res.json()
      return matrixConfig
    } catch (err) {
      return {}
    }
  }
}

export default WellKnown
