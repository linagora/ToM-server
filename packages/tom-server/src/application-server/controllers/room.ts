import {
  AppServerAPIError,
  validationErrorHandler,
  type expressAppHandler
} from '@twake/matrix-application-server'
import { type DbGetResult } from '@twake/matrix-identity-server'
import { type NextFunction, type Request, type Response } from 'express'
import fetch, { type Response as FetchResponse } from 'node-fetch'
import type TwakeApplicationServer from '..'
import type TwakeServer from '../..'
import { type TwakeDB } from '../../db'
import { allMatrixErrorCodes } from '../../types'
import { TwakeRoom } from '../models/room'

const hostnameRe =
  /^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9-]*[A-Za-z0-9])$/i

export const createRoom = (
  appServer: TwakeApplicationServer,
  twakeServer: TwakeServer
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
      if (!hostnameRe.test(twakeServer.conf.matrix_server)) {
        throw Error('Bad matrix_server_name')
      }
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const roomAliasName = `_twake_${req.body.aliasName}`
      const rooms = await twakeServer.matrixDb.get('room_aliases', undefined, {
        room_alias: roomAliasName
      })
      if (rooms.length > 1) {
        throw new AppServerAPIError({
          status: 500,
          message:
            'Critical error: several rooms have the same alias in Matrix database'
        })
      } else if (rooms.length === 1) {
        if (
          rooms[0].creator !==
          `@${appServer.appServiceRegistration.senderLocalpart}:${twakeServer.conf.server_name}`
        ) {
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
            `https://${twakeServer.conf.matrix_server}/_matrix/client/v3/createRoom`
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
              topic: req.body.topic
            })
          }
        )
        const body = (await response.json()) as Record<string, string>
        if ('errcode' in body) {
          throw new AppServerAPIError<typeof allMatrixErrorCodes>({
            status: response.status,
            code: body.errcode,
            message: body.error
          })
        }
        newRoomId = body.room_id
      }
      const twakeRoom = await TwakeRoom.getRoom(
        twakeServer.db as TwakeDB,
        newRoomId
      )
      if (twakeRoom != null && rooms.length > 0) {
        throw new AppServerAPIError<typeof allMatrixErrorCodes>({
          status: 409,
          message: 'This room already exits in Twake database'
        })
      } else if (twakeRoom != null) {
        await twakeRoom.updateRoom(
          twakeServer.db as TwakeDB,
          req.body.ldapFilter
        )
      } else {
        await new TwakeRoom(newRoomId, req.body.ldapFilter).saveRoom(
          twakeServer.db as TwakeDB
        )
      }
      const usersMatchingFilter: DbGetResult =
        await twakeServer.idServer.userDB.get(
          'users',
          [twakeServer.conf.ldap_uid_field as string],
          req.body.ldapFilter
        )
      const joinResponses = await Promise.allSettled<
        Array<Promise<FetchResponse>>
      >(
        usersMatchingFilter
          .map(
            (user) =>
              `@${user[twakeServer.conf.ldap_uid_field as string] as string}:${
                twakeServer.conf.server_name
              }`
          )
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          .map((id) => {
            return fetch(
              encodeURI(
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `https://${twakeServer.conf.matrix_server}/_matrix/client/v3/join/${newRoomId}?user_id=${id}`
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
                [twakeServer.conf.ldap_uid_field as string]:
                  usersMatchingFilter[index][
                    twakeServer.conf.ldap_uid_field as string
                  ] as string,
                ...body
              })
            }
            break
          }
          case 'rejected':
            joinErrors.push({
              [twakeServer.conf.ldap_uid_field as string]: usersMatchingFilter[
                index
              ][twakeServer.conf.ldap_uid_field as string] as string,
              errcode: allMatrixErrorCodes.unknown,
              error: response.reason || 'Internal server error'
            })
            break
          default:
            break
        }
      }
      joinErrors.length > 0 ? res.json(joinErrors) : res.send()
    } catch (error) {
      appServer.logger.error(error)
      next(error)
    }
  }
}
