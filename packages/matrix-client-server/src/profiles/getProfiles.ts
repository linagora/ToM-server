/*
As specified in the Matrix Protocol, access to the profile information of another user is allowed on the local server,
and may be allowed on remote servers via federation.

TODO : implement the ability to access the profile information of another user on a remote server via federation.
TODO : implement the ability to close access to the profile information of another user on the local server.
*/

import type MatrixClientServer from '../'
import { type Request } from 'express'
import { errMsg, send, type expressAppHandler } from '@twake/utils'

export const getProfile = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    const userId: string = (req as Request).params.userId
    /* istanbul ignore else */
    if (
      userId !== undefined &&
      typeof userId === 'string' &&
      userId.length > 0
    ) {
      if (clientServer.isMine(userId)) {
        clientServer.matrixDb
          .get('profiles', ['displayname', 'avatar_url'], {
            user_id: userId
          })
          .then((rows) => {
            if (rows.length === 0) {
              send(
                res,
                404,
                errMsg('notFound', 'Profile not found'),
                clientServer.logger
              )
            } else {
              send(
                res,
                200,
                {
                  avatar_url: rows[0].avatar_url,
                  displayname: rows[0].displayname
                },
                clientServer.logger
              )
            }
          })
          .catch((e) => {
            /* istanbul ignore next */
            send(res, 500, errMsg('unknown', e), clientServer.logger)
          })
      } else {
        // TODO : Have a look on remote server via federation
        send(
          res,
          500,
          errMsg('unknown', 'Cannot get profile of a remote user'),
          clientServer.logger
        )
      }
    } else {
      send(
        res,
        400,
        errMsg('missingParams', 'No user ID provided'),
        clientServer.logger
      )
    }
  }
}

export const getAvatarUrl = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    const userId: string = (req as Request).params.userId
    /* istanbul ignore else */
    if (
      userId !== undefined &&
      typeof userId === 'string' &&
      userId.length > 0
    ) {
      if (clientServer.isMine(userId)) {
        clientServer.matrixDb
          .get('profiles', ['avatar_url'], {
            user_id: userId
          })
          .then((rows) => {
            if (rows.length === 0) {
              send(
                res,
                404,
                errMsg('notFound', 'User not found'),
                clientServer.logger
              )
            } else {
              if (rows[0].avatar_url === null) {
                send(
                  res,
                  404,
                  errMsg('notFound', 'Avatar not found'),
                  clientServer.logger
                )
              } else {
                send(
                  res,
                  200,
                  {
                    avatar_url: rows[0].avatar_url
                  },
                  clientServer.logger
                )
              }
            }
          })
          .catch((e) => {
            /* istanbul ignore next */
            send(res, 500, errMsg('unknown', e), clientServer.logger)
          })
      } else {
        // TODO : Have a look on remote server via federation
        send(
          res,
          500,
          errMsg('unknown', 'Cannot get profile of a remote user'),
          clientServer.logger
        )
      }
    } else {
      send(
        res,
        400,
        errMsg('missingParams', 'No user ID provided'),
        clientServer.logger
      )
    }
  }
}

export const getDisplayname = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    const userId: string = (req as Request).params.userId
    /* istanbul ignore else */
    if (
      userId !== undefined &&
      typeof userId === 'string' &&
      userId.length > 0
    ) {
      if (clientServer.isMine(userId)) {
        clientServer.matrixDb
          .get('profiles', ['displayname'], {
            user_id: userId
          })
          .then((rows) => {
            if (rows.length === 0) {
              send(
                res,
                404,
                errMsg('notFound', 'User not found'),
                clientServer.logger
              )
            } else {
              if (rows[0].displayname === null) {
                send(
                  res,
                  404,
                  errMsg('notFound', 'Displayname not found'),
                  clientServer.logger
                )
              } else {
                send(
                  res,
                  200,
                  {
                    displayname: rows[0].displayname
                  },
                  clientServer.logger
                )
              }
            }
          })
          .catch((e) => {
            /* istanbul ignore next */
            send(res, 500, errMsg('unknown', e), clientServer.logger)
          })
      } else {
        // TODO : Have a look on remote server via federation
        send(
          res,
          500,
          errMsg('unknown', 'Cannot get profile of a remote user'),
          clientServer.logger
        )
      }
    } else {
      send(
        res,
        400,
        errMsg('missingParams', 'No user ID provided'),
        clientServer.logger
      )
    }
  }
}
