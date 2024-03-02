/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  allowCors,
  errorMiddleware,
  methodNotAllowed
} from '@twake/matrix-application-server'
import type TwakeSearchEngine from '..'
import { OpenSearchController } from '../controllers/opensearch.controller'

export const extendRoutes = (server: TwakeSearchEngine): void => {
  const openSearchController = new OpenSearchController(
    server.openSearchService,
    server.logger
  )

  /**
   * @openapi
   * '/_twake/app/v1/opensearch/restore':
   *  post:
   *    tags:
   *    - Search Engine
   *    description: Restore OpenSearch indexes using Matrix homeserver database
   *    requestBody:
   *      content:
   *        application/json:
   *          schema:
   *            type: object
   *    responses:
   *      204:
   *        description: Success
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *      405:
   *        $ref: '#/components/responses/Unrecognized'
   *      500:
   *        $ref: '#/components/responses/InternalServerError'
   */
  server.router.routes
    .route(openSearchController.restoreRoute)
    .post(allowCors, openSearchController.postRestore, errorMiddleware)
    .all(allowCors, methodNotAllowed, errorMiddleware)
}
