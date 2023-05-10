/**
 * @openapi
 * '/_matrix/app/v1/transactions/{txnId}':
 *  put:
 *    parameters:
 *      - in: path
 *        name: txnId
 *        required: true
 *        schema:
 *          type: integer
 *        description: The transaction id
 *    tags:
 *    - Application server
 *    description: Implements https://spec.matrix.org/v1.6/application-service-api/#put_matrixappv1transactionstxnid
 *    responses:
 *      200:
 *        description: Success
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *      308:
 *        $ref: '#/components/responses/PermanentRedirect'
 *      400:
 *        $ref: '#/components/responses/BadRequest'
 *      401:
 *        $ref: '#/components/responses/MatrixUnauthorized'
 *      403:
 *        $ref: '#/components/responses/Forbidden'
 *      404:
 *        description: Not found
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *      500:
 *        $ref: '#/components/responses/InternalServerError'
 *
 * '/_matrix/app/v1/users/{userId}':
 *  get:
 *    parameters:
 *      - in: path
 *        name: userId
 *        required: true
 *        schema:
 *          type: integer
 *        description: The user id
 *    tags:
 *    - Application server
 *    description: Implements https://spec.matrix.org/v1.6/application-service-api/#get_matrixappv1usersuserid
 *    responses:
 *      200:
 *        description: Success
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *      400:
 *        $ref: '#/components/responses/BadRequest'
 *      401:
 *        $ref: '#/components/responses/MatrixUnauthorized'
 *      403:
 *        $ref: '#/components/responses/Forbidden'
 *      500:
 *        $ref: '#/components/responses/InternalServerError'
 *
 * '/_matrix/app/v1/rooms/{roomAlias}':
 *  get:
 *    parameters:
 *      - in: path
 *        name: roomAlias
 *        required: true
 *        schema:
 *          type: integer
 *        description: The room alias
 *    tags:
 *    - Application server
 *    description: Implements https://spec.matrix.org/v1.6/application-service-api/#get_matrixappv1roomsroomalias
 *    responses:
 *      200:
 *        description: Success
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *      400:
 *        $ref: '#/components/responses/BadRequest'
 *      401:
 *        $ref: '#/components/responses/MatrixUnauthorized'
 *      403:
 *        $ref: '#/components/responses/Forbidden'
 *      500:
 *        $ref: '#/components/responses/InternalServerError'
 */
