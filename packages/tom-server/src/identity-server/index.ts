// import MatrixIdentityServer, {
// defaultConfig as MdefaultConfig
// } from '@twake/matrix-identity-server'
import { type ConfigDescription } from '@twake/config-parser'
import { type TwakeLogger } from '@twake/logger'
import MatrixIdentityServer, {
  type MatrixDB
} from '@twake/matrix-identity-server'
import type { IAddressbookService } from '../addressbook-api/types'
import type { IUserInfoService } from '../user-info-api/types'
import defaultConfig from '../config.json'
import type { Config, TwakeDB, twakeDbCollections } from '../types'
import { tables } from '../utils'
import autocompletion from './lookup/autocompletion'
import diff from './lookup/diff'
import Authenticate from './utils/authenticate'

export type { WhoAmIResponse } from './utils/authenticate'

export default class TwakeIdentityServer extends MatrixIdentityServer<twakeDbCollections> {
  declare db: TwakeDB
  declare conf: Config
  constructor(
    public matrixDb: MatrixDB,
    conf: Config,
    confDesc?: ConfigDescription,
    logger?: TwakeLogger
  ) {
    // istanbul ignore if
    if (confDesc == null) confDesc = defaultConfig
    super(conf, confDesc, logger, tables)
    this.authenticate = Authenticate(this.db, this.conf, this.logger)
    const superReady = this.ready
    this.ready = new Promise((resolve, reject) => {
      superReady
        .then(async () => {
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
           *                  deprecated: true
           *              fields:
           *                type: array
           *                items:
           *                  type: string
           *                  description: List of fields to return for matching users (uid, mail, mobile, displayName, givenName, cn, sn)
           *                  deprecated: true
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
           *                  description: List of users that match
           *                  items:
           *                    type: object
           *                    properties:
           *                      address:
           *                        type: string
           *                        description: Matrix address, will be included in uid
           *                        deprecated: true
           *                      uid:
           *                        type: string
           *                        description: id of a matching user
           *                      display_name:
           *                        type: string
           *                        description: Display name of a matching user
           *                      displayName:
           *                        type: string
           *                        description: Display name of a matching user
           *                        deprecated: true
           *                      givenName:
           *                        type: string
           *                        description: Display name of a matching user
           *                        deprecated: true
           *                      givenname:
           *                        type: string
           *                        description: Display name of a matching user
           *                        deprecated: true
           *                      cn:
           *                        type: string
           *                        description: Display name of a matching user
           *                        deprecated: true
           *                      avatar_url:
           *                        type: string
           *                        description: |-
           *                          Avatar URI of a matching user following the mxc format
           *                          https://spec.matrix.org/v1.10/client-server-api/#matrix-content-mxc-uris
           *                      last_name:
           *                        type: string
           *                        description: Last name of a matching user
           *                      first_name:
           *                        type: string
           *                        description: First name of a matching user
           *                      mail:
           *                        type: string
           *                        description: Email address of a matching user
           *                        deprecated: true
           *                      emails:
           *                       type: array
           *                       items:
           *                         type: string
           *                         description: Email addresses of a matching user
           *                      mobile:
           *                        type: string
           *                        description: Mobile phone number of a matching user
           *                        deprecated: true
           *                      phones:
           *                        type: array
           *                        items:
           *                          type: string
           *                          description: Mobile phone numbers of a matching user
           *                      language:
           *                        type: string
           *                        description: Language of a matching user
           *                      timezone:
           *                        type: string
           *                        description: Timezone of a matching user
           *            example:
           *              matches:
           *                - uid: rtyler
           *                  display_name: Robert Tyler
           *                  avatar_url: mxc://matrix.org/SEsfnsuifSDFWefnsdfWefnsd
           *                  last_name: Tyler
           *                  first_name: Robert
           *                  emails:
           *                    - rtyler@matrix.org
           *                    - robert.t@personal.tld
           *                  phones:
           *                    - '+33612345678'
           *                  language: en
           *                  timezone: Europe/Paris
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
          resolve(true)
        })
        /* istanbul ignore next */
        .catch(reject)
    })
  }

  /**
   * Sets up the lookup routes with singleton services
   * Must be called after singleton services are created
   * @param {IAddressbookService} addressbookService - The singleton addressbook service
   * @param {IUserInfoService} userInfoService - The singleton user info service
   * @returns {Promise<void>} Resolves when routes are set up
   */
  public async setupLookupRoutes(
    addressbookService: IAddressbookService,
    userInfoService: IUserInfoService
  ): Promise<void> {
    await this.ready
    this.api.post['/_twake/identity/v1/lookup/match'] = await autocompletion(
      this,
      this.logger,
      addressbookService,
      userInfoService
    )

    if (this.conf.additional_features === true) {
      this.api.post['/_twake/identity/v1/lookup/diff'] = diff(this, this.logger)
    }
  }
}
