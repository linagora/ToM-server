/**
 * @typedef {Object.<string, string>} StringMap
 *
 * @openapi
 * '/_matrix/identity/v2':
 *  get:
 *    tags:
 *    - Identity server
 *    description: Implements https://spec.matrix.org/v1.6/identity-service-api/#get_matrixidentityv2
 *
 * '/_matrix/identity/v2/hash_details':
 *  get:
 *    tags:
 *    - Identity server
 *    description: Implements https://spec.matrix.org/v1.6/identity-service-api/#get_matrixidentityv2hash_details
 *
 * '/_matrix/identity/v2/lookup':
 *  post:
 *    tags:
 *    - Identity server
 *    description: Extends https://spec.matrix.org/v1.6/identity-service-api/#post_matrixidentityv2lookup to display inactive users
 *    requestBody:
 *      description: Object containing hashes of mails/phones to search
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              addresses:
 *                type: array
 *                items:
 *                  type: string
 *                  description: List of (hashed) addresses to lookup
 *              algorithm:
 *                type: string
 *                description: Algorithm the client is using to encode the addresses
 *              pepper:
 *                type: string
 *                description: Pepper from '/hash_details'
 *            required:
 *              - addresses
 *              - algorithm
 *              - pepper
 *          example:
 *            addresses: ["4kenr7N9drpCJ4AfalmlGQVsOn3o2RHjkADUpXJWZUc", "nlo35_T5fzSGZzJApqu8lgIudJvmOQtDaHtr-I4rU7I"]
 *            algorithm: "sha256"
 *            pepper: "matrixrocks"
 *    responses:
 *      200:
 *        description: Success
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                mappings:
 *                  type: object
 *                  additionalProperties:
 *                    type: string
 *                  description: List of active accounts
 *                inactive_mappings:
 *                  type: object
 *                  additionalProperties:
 *                    type: string
 *                  description: List of inactive accounts
 *            example:
 *              mappings:
 *                "4kenr7N9drpCJ4AfalmlGQVsOn3o2RHjkADUpXJWZUc": "@dwho:company.com"
 *              inactive_mappings:
 *                "nlo35_T5fzSGZzJApqu8lgIudJvmOQtDaHtr-I4rU7I": "@rtyler:company.com"
 *      401:
 *        $ref: '#/components/responses/Unauthorized'
 *      400:
 *        $ref: '#/components/responses/BadRequest'
 *
 * '/_matrix/identity/v2/account':
 *  get:
 *    tags:
 *    - Identity server
 *    description: Implements https://spec.matrix.org/v1.6/identity-service-api/#get_matrixidentityv2account
 *
 * '/_matrix/identity/v2/account/register':
 *  post:
 *    tags:
 *    - Identity server
 *    description: Implements https://spec.matrix.org/v1.6/identity-service-api/#post_matrixidentityv2accountregister
 *
 * '/_matrix/identity/v2/account/logout':
 *  post:
 *    tags:
 *    - Identity server
 *    description: Implements https://spec.matrix.org/v1.6/identity-service-api/#post_matrixidentityv2accountlogout
 *
 * '/_matrix/identity/v2/terms':
 *  get:
 *    tags:
 *    - Identity server
 *    description: Implements https://spec.matrix.org/v1.6/identity-service-api/#get_matrixidentityv2terms
 *
 * '/_matrix/identity/v2/validate/email/requestToken':
 *  post:
 *    tags:
 *    - Identity server
 *    description: Implements https://spec.matrix.org/v1.6/identity-service-api/#post_matrixidentityv2validateemailrequesttoken
 *
 * '/_matrix/identity/v2/validate/email/submitToken':
 *  post:
 *    tags:
 *    - Identity server
 *    description: Implements https://spec.matrix.org/v1.6/identity-service-api/#post_matrixidentityv2validateemailsubmittoken
 *
 * '/_matrix/identity/versions':
 *  get:
 *    tags:
 *    - Identity server
 *    description: Implements https://spec.matrix.org/v1.6/identity-service-api/#get_matrixidentityversions
 */
