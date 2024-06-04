/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  EHttpMethod,
  allowCors,
  errorMiddleware,
  methodNotAllowed
} from '@twake/matrix-application-server'
import { body } from 'express-validator'
import type TwakeSearchEngine from '..'
import authMiddleware from '../../utils/middlewares/auth.middleware'
import { OpenSearchController } from '../controllers/opensearch.controller'
import { SearchEngineController } from '../controllers/search-engine.controller'
import { SearchEngineService } from '../services/search-engine.service'

export const extendRoutes = (server: TwakeSearchEngine): void => {
  const searchEngineService = new SearchEngineService(
    server.openSearchRepository,
    server.matrixDBRoomsRepository
  )
  const searchEngineController = new SearchEngineController(
    searchEngineService,
    server.userDB,
    server.logger
  )

  const openSearchController = new OpenSearchController(
    server.openSearchService,
    server.logger
  )

  /**
   * @openapi
   * '/_twake/app/v1/search':
   *  post:
   *    tags:
   *    - Search Engine
   *    description: Search performs with OpenSearch on Tchat messages and rooms
   *    requestBody:
   *      description: Object containing search query details
   *      required: true
   *      content:
   *        application/json:
   *          schema:
   *            type: object
   *            properties:
   *              searchValue:
   *                type: string
   *                description: Value used to perform the search on rooms and messages data
   *            required:
   *              - searchValue
   *          example:
   *            searchValue: "hello"
   *    responses:
   *      200:
   *        description: Success
   *        content:
   *          application/json:
   *            schema:
   *              type: object
   *              properties:
   *                rooms:
   *                  type: array
   *                  description: List of rooms whose name contains the search value
   *                  items:
   *                    type: object
   *                    properties:
   *                      room_id:
   *                        type: string
   *                      name:
   *                        type: string
   *                      avatar_url:
   *                        type: string
   *                        description: Url of the room's avatar
   *                messages:
   *                  type: array
   *                  description: List of messages whose content or/and sender display name contain the search value
   *                  items:
   *                    type: object
   *                    properties:
   *                      room_id:
   *                        type: string
   *                      event_id:
   *                        type: string
   *                        description: Id of the message
   *                      content:
   *                        type: string
   *                      display_name:
   *                        type: string
   *                        description: Sender display name
   *                      avatar_url:
   *                        type: string
   *                        description: Sender's avatar url if it is a direct chat, otherwise it is the room's avatar url
   *                      room_name:
   *                        type: string
   *                        description: Room's name in case of the message is not part of a direct chat
   *                mails:
   *                  type: array
   *                  description: List of mails from Tmail whose meta or content contain the search value
   *                  items:
   *                    type: object
   *                    properties:
   *                      attachments:
   *                        type: array
   *                        items:
   *                          type: object
   *                          properties:
   *                            contentDisposition:
   *                              type: string
   *                            fileExtension:
   *                              type: string
   *                            fileName:
   *                              type: string
   *                            mediaType:
   *                              type: string
   *                            subtype:
   *                              type: string
   *                            textContent:
   *                              type: string
   *                      bcc:
   *                        type: array
   *                        items:
   *                          type: object
   *                          properties:
   *                            address:
   *                              type: string
   *                            domain:
   *                              type: string
   *                            name:
   *                              type: string
   *                      cc:
   *                        type: array
   *                        items:
   *                          type: object
   *                          properties:
   *                            address:
   *                              type: string
   *                            domain:
   *                              type: string
   *                            name:
   *                              type: string
   *                      date:
   *                        type: string
   *                      from:
   *                        type: array
   *                        items:
   *                          type: object
   *                          properties:
   *                            address:
   *                              type: string
   *                            domain:
   *                              type: string
   *                            name:
   *                              type: string
   *                      hasAttachment:
   *                        type: boolean
   *                      headers:
   *                        type: array
   *                        items:
   *                          type: object
   *                          properties:
   *                            name:
   *                              type: string
   *                            value:
   *                              type: string
   *                      htmlBody:
   *                        type: string
   *                      isAnswered:
   *                        type: boolean
   *                      isDeleted:
   *                        type: boolean
   *                      isDraft:
   *                        type: boolean
   *                      isFlagged:
   *                        type: boolean
   *                      isRecent:
   *                        type: boolean
   *                      isUnread:
   *                        type: boolean
   *                      mailboxId:
   *                        type: string
   *                      mediaType:
   *                        type: string
   *                      messageId:
   *                        type: string
   *                      mimeMessageID:
   *                        type: string
   *                      modSeq:
   *                        type: number
   *                      saveDate:
   *                        type: string
   *                      sentDate:
   *                        type: string
   *                      size:
   *                        type: number
   *                      subject:
   *                        type: array
   *                        items:
   *                          type: string
   *                      subtype:
   *                        type: string
   *                      textBody:
   *                        type: string
   *                      threadId:
   *                        type: string
   *                      to:
   *                        type: array
   *                        items:
   *                          type: object
   *                          properties:
   *                            address:
   *                              type: string
   *                            domain:
   *                              type: string
   *                            name:
   *                              type: string
   *                      uid:
   *                        type: number
   *                      userFlags:
   *                        type: array
   *                        items:
   *                          type: string
   *            example:
   *              rooms: [{"room_id": "!dYqMpBXVQgKWETVAtJ:example.com", "name": "Hello world room", "avatar_url": "mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR"}, {"room_id": "!dugSgNYwppGGoeJwYB:example.com", "name": "Worldwide room", "avatar_url": null}]
   *              messages:
   *                [{"room_id": "!dYqMpBXVQgKWETVAtJ:example.com", "event_id": "$c0hW6db_GUjk0NRBUuO12IyMpi48LE_tQK6sH3dkd1U", "content": "Hello world", "display_name": "Anakin Skywalker", "avatar_url": "mxc://linagora.com/IBGFusHnOOzCNfePjaIVHpgR", "room_name": "Hello world room"}, {"room_id": "!ftGqINYwppGGoeJwYB:example.com", "event_id": "$IUzFofxHCvvoHJ-k2nfx7OlWOO8AuPvlHHqkeJLzxJ8", "content": "Hello world my friends in direct chat", "display_name": "Luke Skywalker", "avatar_url": "mxc://matrix.org/wefh34uihSDRGhw34"}]
   *              mails: [{"id": "message1","attachments": [{"contentDisposition": "attachment","fileExtension": "jpg","fileName": "image1.jpg","mediaType": "image/jpeg","textContent": "A beautiful galaxy far, far away."}],"bcc": [{"address": "okenobi@example.com","domain": "example.com","name": "Obi-Wan Kenobi"}],"cc": [{"address": "pamidala@example.com","domain": "example.com","name": "Padme Amidala"}],"date": "2024-02-24T10:15:00Z","from": [{"address": "dmaul@example.com","domain": "example.com","name": "Dark Maul"}],"hasAttachment": true,"headers": [{ "name": "Header5", "value": "Value5" },{ "name": "Header6", "value": "Value6" }],"htmlBody": "<p>A beautiful galaxy far, far away.</p>","isAnswered": true,"isDeleted": false,"isDraft": false,"isFlagged": true,"isRecent": true,"isUnread": false,"mailboxId": "mailbox3","mediaType": "image/jpeg","messageId": "message3","mimeMessageID": "mimeMessageID3","modSeq": 98765,"saveDate": "2024-02-24T10:15:00Z","sentDate": "2024-02-24T10:15:00Z","size": 4096,"subject": ["Star Wars Message 3"],"subtype": "subtype3","textBody": "A beautiful galaxy far, far away.","threadId": "thread3","to": [{"address": "kren@example.com","domain": "example.com","name": "Kylo Ren"}],"uid": 987654,"userFlags": ["Flag4", "Flag5"]}]
   *      400:
   *        $ref: '#/components/responses/BadRequest'
   *      401:
   *        $ref: '#/components/responses/Unauthorized'
   *      404:
   *        $ref: '#/components/responses/NotFound'
   *      405:
   *        $ref: '#/components/responses/Unrecognized'
   *      500:
   *        $ref: '#/components/responses/InternalServerError'
   */
  server.router.addRoute(
    searchEngineController.searchRoute,
    EHttpMethod.POST,
    searchEngineController.postSearch,
    [body('searchValue').exists().isString()],
    authMiddleware(server.authenticate, server.logger)
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
