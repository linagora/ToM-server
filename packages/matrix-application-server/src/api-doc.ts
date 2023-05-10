/**
 * @openapi
 * '/_matrix/app/v1/transactions/{transaction_id}':
 *  put:
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
 */
