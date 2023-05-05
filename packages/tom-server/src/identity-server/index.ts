// import MatrixIdentityServer, {
// defaultConfig as MdefaultConfig
// } from '@twake/matrix-identity-server'
import autocompletion from './lookup/autocompletion'
import { type ConfigDescription } from '@twake/config-parser'
import Authenticate from './utils/authenticate'
import { type Config } from '../types'
import MatrixIdentityServer from '@twake/matrix-identity-server'
import defaultConfig from '../config.json'

export type { WhoAmIResponse } from './utils/authenticate'

export default class TwakeIdentityServer extends MatrixIdentityServer {
  declare conf: Config
  constructor(conf: Config, confDesc?: ConfigDescription) {
    if (confDesc == null) confDesc = defaultConfig
    super(conf, confDesc)
    this.authenticate = Authenticate(this.db, this.conf)
    const superReady = this.ready
    this.ready = new Promise((resolve, reject) => {
      superReady
        .then(() => {
          // Extend API
          /**
           * @openapi
           * '/_twake/identity/v1/lookup/match':
           *  post:
           *    tags:
           *    - Identity server
           *    description: Looks up the Organization User IDs which match value sent
           *    requestBody:
           *      description: Object containing the recovery words of the connected user
           *      required: true
           *      content:
           *        application/json:
           *          schema:
           *            type: object
           *            properties:
           *              scope:
           *                type: array
           *                items:
           *                  type: string
           *                  description: List of fields to search in (uid, mail,...)
           *              fields:
           *                type: array
           *                items:
           *                  type: string
           *                  description: List of fields to return for matching users
           *              val:
           *                type: string
           *                description: Value to search
           *            required:
           *              - scope
           *              - fields
           *              - val
           *          example:
           *            scope: [mail, uid]
           *            fields: [uid]
           *            val: rtyler
           *    responses:
           *      200:
           *        description: Success
           *        content:
           *          application/json:
           *            schema:
           *              type: object
           *              properties:
           *                matches:
           *                  type: array
           *                  items:
           *                    type: object
           *                    properties:
           *                      uid:
           *                        type: string
           *                        description: id of a matching user
           *                      mail:
           *                        type: string
           *                        description: email address of a matching user
           *                  description: List of users that match
           *            example:
           *              matches: [{uid: dwho, mail: dwho@badwolf.com}]
           *      401:
           *        $ref: '#/components/responses/Unauthorized'
           *      400:
           *        $ref: '#/components/responses/BadRequest'
           */
          this.api.post['/_twake/identity/v1/lookup/match'] =
            autocompletion(this)
          resolve(true)
        })
        /* istanbul ignore next */
        .catch(reject)
    })
  }
}
