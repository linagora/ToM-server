// import MatrixIdentityServer, {
// defaultConfig as MdefaultConfig
// } from '@twake/matrix-identity-server'
import { type ConfigDescription } from '@twake/config-parser'
import { type TwakeLogger } from '@twake/logger'
import MatrixIdentityServer, {
  type MatrixDB
} from '@twake/matrix-identity-server'
import defaultConfig from '../config.json'
import { type Config } from '../types'
import autocompletion from './lookup/autocompletion'
import diff from './lookup/diff'
import Authenticate from './utils/authenticate'

export type { WhoAmIResponse } from './utils/authenticate'

export default class AugmentedIdentityServer extends MatrixIdentityServer {
  declare conf: Config
  constructor(
    public matrixDb: MatrixDB,
    conf: Config,
    confDesc?: ConfigDescription,
    logger?: TwakeLogger
  ) {
    // istanbul ignore if
    if (confDesc == null) confDesc = defaultConfig
    super(conf, confDesc, logger)
    this.authenticate = Authenticate(this.db, this.conf, this.logger)
    const superReady = this.ready
    this.ready = new Promise((resolve, reject) => {
      superReady
        .then(() => {
          if (
            process.env.ADDITIONAL_FEATURES === 'true' ||
            (this.conf.additional_features as boolean)
          ) {
            // Extend API
            /**
             * @openapi
             * '/_twake/identity/v1/lookup/match':
             *  post:
             *    tags:
             *    - Identity server
             *    description: Looks up the Organization User IDs which match value sent
             *    requestBody:
             *      description: Object containing detail for the search and the returned data
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
             *                  description: List of fields to return for matching users (uid, mail, mobile, displayName, givenName, cn, sn)
             *              val:
             *                type: string
             *                description: Optional value to search
             *              limit:
             *                type: integer
             *                description:  Optional max number of result to return (default 30)
             *              offset:
             *                type: integer
             *                description: Optional offset for pagination
             *            required:
             *              - scope
             *              - fields
             *          example:
             *            scope: [mail, uid]
             *            fields: [uid, displayName, sn, givenName, mobile]
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
             *              limit:
             *                type: integer
             *                description:  Optional max number of result to return (default 30)
             *              offset:
             *                type: integer
             *                description: Optional offset for pagination
             *          example:
             *            since: 1685074279
             *            fields: [uid, mail]
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
             *                      timestamp:
             *                        type: integer
             *                        description: current server timestamp
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
            this.api.post['/_twake/identity/v1/lookup/match'] = autocompletion(
              this,
              this.logger
            )
            this.api.post['/_twake/identity/v1/lookup/diff'] = diff(
              this,
              this.logger
            )
          }
          resolve(true)
        })
        /* istanbul ignore next */
        .catch(reject)
    })
  }
}
