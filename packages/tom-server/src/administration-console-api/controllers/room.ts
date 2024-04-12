import { type TwakeLogger } from '@twake/logger'
import type MatrixApplicationServer from '@twake/matrix-application-server'
import {
  AppServerAPIError,
  validationErrorHandler,
  type expressAppHandler
} from '@twake/matrix-application-server'
import {
  type DbGetResult,
  type MatrixDB,
  type UserDB
} from '@twake/matrix-identity-server'
import { type NextFunction, type Request, type Response } from 'express'
import lodash from 'lodash'
import fetch, { type Response as FetchResponse } from 'node-fetch'
import { type TwakeDB } from '../../db'
import { allMatrixErrorCodes, type Config } from '../../types'
import { TwakeRoom } from '../models/room'
const { intersection } = lodash

const domainRe =
  '(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9])\\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9-]*[A-Za-z0-9])'
const portRe =
  '((6553[0-5])|(655[0-2][0-9])|(65[0-4][0-9]{2})|(6[0-4][0-9]{3})|([1-5][0-9]{4})|([0-5]{0,5})|([0-9]{1,4}))'
const hostnameRe = new RegExp(`^${domainRe}(:${portRe})?$`, 'i')

export const createRoom = (
  appServer: MatrixApplicationServer,
  db: TwakeDB,
  userDb: UserDB,
  matrixDb: MatrixDB,
  conf: Config,
  logger: TwakeLogger
): expressAppHandler => {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      let newRoomId: string | null = null
      validationErrorHandler(req)
      if (!hostnameRe.test(conf.matrix_server)) {
        throw Error('Bad matrix_server_name')
      }
      const appServiceMatrixId = `@${appServer.appServiceRegistration.senderLocalpart}:${conf.server_name}`
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const roomAliasName = `_twake_${req.body.aliasName}`
      const rooms = await matrixDb.get('room_aliases', undefined, {
        room_alias: roomAliasName
      })
      if (rooms.length > 1) {
        throw new AppServerAPIError({
          status: 500,
          message:
            'Critical error: several rooms have the same alias in Matrix database'
        })
      } else if (rooms.length === 1) {
        if (rooms[0].creator !== appServiceMatrixId) {
          throw new AppServerAPIError<typeof allMatrixErrorCodes>({
            status: 409,
            code: allMatrixErrorCodes.roomInUse,
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            message: `A room with alias ${req.body.aliasName} already exists in Matrix database`
          })
        }
        newRoomId = rooms[0].room_id as string
      } else {
        const response = await fetch(
          encodeURI(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `https://${conf.matrix_server}/_matrix/client/v3/createRoom`
          ),
          {
            method: 'POST',
            headers: {
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              Authorization: `Bearer ${appServer.appServiceRegistration.asToken}`
            },
            body: JSON.stringify({
              creation_content: {
                'm.federate': true
              },
              name: req.body.name,
              visibility: req.body.visibility,
              room_alias_name: roomAliasName,
              topic: req.body.topic,
              power_level_content_override: {
                ban: 100,
                invite: 100,
                kick: 100,
                redact: 100,
                state_default: 100,
                users: {
                  [appServiceMatrixId]: 100
                },
                users_default: 0
              }
            })
          }
        )
        const body = (await response.json()) as Record<string, string>
        if ('errcode' in body) {
          throw new AppServerAPIError<typeof allMatrixErrorCodes>({
            status: response.status,
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            code: body.errcode as (typeof allMatrixErrorCodes)[keyof typeof allMatrixErrorCodes],
            message: body.error
          })
        }
        newRoomId = body.room_id
      }
      const twakeRoom = await TwakeRoom.getRoom(db, newRoomId)
      if (twakeRoom != null && rooms.length > 0) {
        throw new AppServerAPIError<typeof allMatrixErrorCodes>({
          status: 409,
          message: 'This room already exits in Twake database'
        })
      } else if (twakeRoom != null) {
        await twakeRoom.updateRoom(db, req.body.ldapFilter)
      } else {
        await new TwakeRoom(newRoomId, req.body.ldapFilter).saveRoom(db)
      }
      const [ldapUsers, matrixUsers] = await Promise.all<
        Array<Promise<DbGetResult>>
      >([
        userDb.get(
          'users',
          [conf.ldap_uid_field as string],
          req.body.ldapFilter
        ),
        matrixDb.getAll('users', ['name'])
      ])

      const ldapUsersIds = ldapUsers.map(
        (user) =>
          `@${user[conf.ldap_uid_field as string] as string}:${
            conf.server_name
          }`
      )
      const matrixUsersIds = matrixUsers.map((user) => user.name as string)

      const usersIdsMatchingFilter = intersection(ldapUsersIds, matrixUsersIds)

      const joinResponses = await Promise.allSettled<
        Array<Promise<FetchResponse>>
      >(
        usersIdsMatchingFilter
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          .map((id) => {
            return fetch(
              encodeURI(
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `https://${conf.matrix_server}/_matrix/client/v3/join/${newRoomId}?user_id=${id}`
              ),
              {
                method: 'POST',
                headers: {
                  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                  Authorization: `Bearer ${appServer.appServiceRegistration.asToken}`
                }
              }
            )
          })
      )
      const joinErrors: Array<Record<string, string | number>> = []
      for (const [index, response] of joinResponses.entries()) {
        switch (response.status) {
          case 'fulfilled': {
            const body = (await response.value.json()) as Record<
              string,
              string | number
            >
            if ('errcode' in body) {
              joinErrors.push({
                [conf.ldap_uid_field as string]: usersIdsMatchingFilter[index],
                ...body
              })
            }
            break
          }
          case 'rejected':
            joinErrors.push({
              [conf.ldap_uid_field as string]: usersIdsMatchingFilter[index],
              errcode: allMatrixErrorCodes.unknown,
              error: response.reason ?? 'Internal server error'
            })
            break
          default:
            break
        }
      }
      joinErrors.length > 0 ? res.json(joinErrors) : res.send()
    } catch (error) {
      logger.error(error)
      next(error)
    }
  }
}
