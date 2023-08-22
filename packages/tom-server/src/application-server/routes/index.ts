import { EHttpMethod } from '@twake/matrix-application-server'
import type TwakeApplicationServer from '..'
import type TwakeServer from '../..'
import { createRoom } from '../controllers/room'
import { auth } from '../middlewares/auth'
import validation from '../middlewares/validation'

export const extendRoutes = (
  appServer: TwakeApplicationServer,
  twakeServer: TwakeServer
): void => {
  /**
   * @openapi
   * '/_twake/app/v1/rooms':
   *  post:
   *    tags:
   *    - Application server
   *    description: Implements https://www.notion.so/Automatic-channels-89ba6f97bc90474ca482a28cf3228d3e
   *    requestBody:
   *      description: Object containing room's details
   *      required: true
   *      content:
   *        application/json:
   *          schema:
   *            type: object
   *            properties:
   *              ldapFilter:
   *                type: object
   *                additionalProperties: true
   *                description: An object containing keys/values to build a ldap filter
   *              aliasName:
   *                type: string
   *                description: The desired room alias local part. If aliasName is equal to foo the complete room alias will be #_twake_foo:example.com
   *              name:
   *                type: string
   *                description: The room name
   *              topic:
   *                type: string
   *                description: A short message detailing what is currently being discussed in the room.
   *              visibility:
   *                type: string
   *                enum: [public, private]
   *                description: >
   *                  visibility values:
   *                    * `public` - The room will be shown in the published room list
   *                    * `private` - Hide the room from the published room list
   *            required:
   *              - ldapFilter
   *              - aliasName
   *          example:
   *            ldapFilter:
   *              "mail": "example@test.com"
   *              "cn": "example"
   *            aliasName: "exp"
   *            name: "Example"
   *            topic: "This is an example of a room topic"
   *            visibility: "public"
   *    responses:
   *      200:
   *        description: Success
   *        content:
   *          application/json:
   *            schema:
   *              type: array
   *              items:
   *                type: object
   *                properties:
   *                  errcode:
   *                    type: string
   *                  error:
   *                    type: string
   *                additionalProperties:
   *                  type: string
   *                description: List of users uid not added to the new room due to an error
   *              example:
   *                - uid: test1
   *                  errcode: M_FORBIDDEN
   *                  error: The user has been banned from the room
   *                - uid: test2
   *                  errcode: M_UNKNOWN
   *                  error: Internal server error
   *      400:
   *        description: 'Bad request'
   *        content:
   *          application/json:
   *            schema:
   *              $ref: '#/components/schemas/BadRequest'
   *            examples:
   *              example1:
   *                value:
   *                  error: "Error field: Invalid value (property: name)"
   *              example2:
   *                value:
   *                  errcode: "M_NOT_JSON"
   *                  error: "Not_json"
   *      401:
   *        $ref: '#/components/responses/Unauthorized'
   *      403:
   *        $ref: '#/components/responses/Forbidden'
   *      409:
   *        description: 'Conflict'
   *        content:
   *          application/json:
   *            schema:
   *              $ref: '#/components/schemas/Conflict'
   *            examples:
   *              example1:
   *                value:
   *                  error: "This room already exits in Twake database"
   *              example2:
   *                value:
   *                  errcode: "M_ROOM_IN_USE"
   *                  error: "A room with alias foo already exists in Matrix database"
   *      500:
   *        $ref: '#/components/responses/InternalServerError'
   */
  appServer.router.addRoute(
    '/_twake/app/v1/rooms',
    EHttpMethod.POST,
    createRoom(appServer, twakeServer),
    validation(),
    auth
  )
}
