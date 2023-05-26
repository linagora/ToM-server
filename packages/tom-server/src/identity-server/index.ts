// import MatrixIdentityServer, {
// defaultConfig as MdefaultConfig
// } from '@twake/matrix-identity-server'
import autocompletion from './lookup/autocompletion'
import { type ConfigDescription } from '@twake/config-parser'
import Authenticate from './utils/authenticate'
import { type Config } from '../types'
import MatrixIdentityServer from '@twake/matrix-identity-server'
import defaultConfig from '../config.json'
import type TwakeServer from '..'
import diff from './lookup/diff'

export type { WhoAmIResponse } from './utils/authenticate'

export default class TwakeIdentityServer extends MatrixIdentityServer {
  declare conf: Config
  constructor(parent: TwakeServer, confDesc?: ConfigDescription) {
    if (confDesc == null) confDesc = defaultConfig
    super(parent.conf, confDesc)
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
           *                description: Optional value to search
           *              limit:
           *                type: integer
           *                description:  Optional max number of result to return (default 30)
           *              offest:
           *                type: integer
           *                description: Optional offset for pagination
           *            required:
           *              - scope
           *              - fields
           *          example:
           *            scope: [mail, uid]
           *            fields: [uid]
           *            val: rtyler
           *            limit: 3
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
           *                      address:
           *                        type: string
           *                        description: Matrix address
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
           *
           * '/_twake/identity/v1/lookup/diff':
           *  post:
           *    tags:
           *    - Identity server
           *    description: Looks up the Organization User IDs updated since X
           *    requestBody:
           *      description: Object containing the timestamp
           *      required: true
           *      content:
           *        application/json:
           *          schema:
           *            type: object
           *            properties:
           *              since:
           *                type: integer
           *                description: timestamp
           *              fields:
           *                type: array
           *                items:
           *                  type: string
           *                  description: List of fields to return for matching users
           *          example:
           *            since: 1685074279
           *            fields: [uid, mail]
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
           *                      address:
           *                        type: string
           *                        description: Matrix address
           *                      uid:
           *                        type: string
           *                        description: id of a matching user
           *                      mail:
           *                        type: string
           *                        description: email address of a matching user
           *                  description: List of users that match
           *            example:
           *              matches: [{uid: dwho, mail: dwho@badwolf.com}]
           */
          this.api.post['/_twake/identity/v1/lookup/match'] =
            autocompletion(parent)
          this.api.post['/_twake/identity/v1/lookup/diff'] = diff(parent)
          resolve(true)
        })
        /* istanbul ignore next */
        .catch(reject)
    })
  }
}
