/**
 * @openapi
 * /.well-knwon/matrix/client:
 *  get:
 *    tags:
 *      - Auto configuration
 *    description: Get server metadata for auto configuration
 *    responses:
 *      200:
 *        description: Give server metadata
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                m.homeserver:
 *                  type: object
 *                  properties:
 *                    base_url:
 *                      type: string
 *                      description: Base URL of Matrix server
 *                m.identity_server:
 *                  type: object
 *                  properties:
 *                    base_url:
 *                      type: string
 *                      description: Base URL of Identity server
 *                m.federated_identity_services:
 *                  type: object
 *                  properties:
 *                    base_urls:
 *                      type: array
 *                      items:
 *                        type: string
 *                        description: Base URL of Federated identity service
 *                      description: Available Federated identity services Base URL list
 *                t.server:
 *                  type: object
 *                  properties:
 *                    base_url:
 *                      type: string
 *                      description: Base URL of Identity server
 *                    server_name:
 *                      type: string
 *                      description: Domain handled by Matrix server
 *                m.integrations:
 *                  type: object
 *                  properties:
 *                    jitsi:
 *                      type: object
 *                      properties:
 *                        preferredDomain:
 *                          type: string
 *                          description: Jitsi's preffered domain
 *                        baseUrl:
 *                          type: string
 *                          description: URL of Jitsi server
 *                        useJwt:
 *                          type: boolean
 *                          description: True if Jitsi server requires a JWT
 *                        jwt:
 *                          type: object
 *                          properties:
 *                            algorithm:
 *                              type: string
 *                              description: algorithm used to generate JWT
 *                            secret:
 *                              type: string
 *                              description: password of JWTs
 *                            issuer:
 *                              type: string
 *                              description: issuer of JWTs
 *                m.authentication:
 *                  type: object
 *                  properties:
 *                    issuer:
 *                      type: string
 *                      description: URL of OIDC issuer
 *            example:
 *              m.homeserver:
 *                base_url: matrix.example.com
 *              m.identity_server:
 *                base_url: global-id-server.twake.app
 *              m.federated_identity_services:
 *                base_urls: ["global-federated_identity_service.twake.app", "other-federated-identity-service.twake.app"]
 *              m.integrations:
 *                jitsi:
 *                  baseUrl: https://jitsi.example.com/
 *                  preferredDomain: jitsi.example.com
 *                  useJwt: false
 *              m.authentication:
 *                issuer: https://auth.example.com
 *              t.server:
 *                base_url: https://tom.example.com
 *                server_name: example.com
 */

import { send } from '@twake/utils'
import { type Config, type expressAppHandler } from '../types'

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
    base_urls: string[]
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
}

class WellKnown {
  api: {
    get: Record<string, expressAppHandler>
  }

  _wellKnownClient: expressAppHandler

  constructor(conf: Config) {
    this._wellKnownClient = (req, res) => {
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
        }
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
}

export default WellKnown
