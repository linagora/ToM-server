/*
As done in the Synapse implementation of the Matrix Protocol,
one user will have the ability to change the displayname and avatar_url of another user if they are an admin,
if they are changing their own displayname and avatar_url,
or if the servers congiguration allows it.

Future implementations may include :
 - the ability to change the displayname and avatar_url of a user while deactivating them
 - the ability to change the displayname and avatar_url of a user and have it apply to the user's membership events
 - the ability to change another user's profile if the requester presents one of the target's valid tokens
*/

import type MatrixClientServer from '../index'
import { type Request } from 'express'

import {
  send,
  type expressAppHandler,
  jsonContent,
  validateParameters
} from '@twake/utils'

const MAX_DISPLAYNAME_LEN = 256
const MAX_AVATAR_URL_LEN = 1000

const schema = {
  avatar_url: true
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const schema_name = {
  displayname: true
}

interface changeAvatarUrlArgs {
  avatar_url: string
}
interface changeDisplaynameArgs {
  displayname: string
}

export const changeAvatarUrl = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    /*
    Sets the avatar_url of a user

    Arguments to take into account :
      target_user: the user whose avatar_url is to be changed.
      requester: The user attempting to make this change.
      newAvatarUrl: The avatar_url to give this user.
      byAdmin: Whether this change was made by an administrator.

      TODO : The following arguments are not used in this function,
      but are used in the equivalent function in the Synapse codebase:
        deactivation: Whether this change was made while deactivating the user.
        propagate: Whether this change also applies to the user's membership events.
    */
    const userId: string = (req as Request).params.userId

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    clientServer.authenticate(req, res, async (token) => {
      const requesterUserId = token.sub
      let byAdmin = 0
      try {
        // Check wether requester is admin or not
        const response = await clientServer.matrixDb.get('users', ['admin'], {
          name: requesterUserId
        })
        byAdmin = response[0].admin as number
      } catch (e) {
        /* istanbul ignore next */
        send(
          res,
          500,
          errMsg('unknown', 'Error checking admin'),
          clientServer.logger
        )
      }

      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(res, schema, obj, clientServer.logger, (obj) => {
          const newAvatarUrl = (obj as changeAvatarUrlArgs).avatar_url
          const targetUserId: string = (req as Request).params.userId

          /*  istanbul ignore if */
          if (!clientServer.isMine(targetUserId)) {
            send(
              res,
              400,
              errMsg('unknown', 'Cannot change displayname of a remote user'),
              clientServer.logger
            )
            return
          }

          if (byAdmin === 0 && requesterUserId !== targetUserId) {
            send(
              res,
              403,
              errMsg(
                'forbidden',
                'Cannot change displayname of another user when not admin'
              ),
              clientServer.logger
            )
            return
          }

          // TODO: check if changing displayname is allowed according to config settings

          if (newAvatarUrl.length > MAX_AVATAR_URL_LEN) {
            send(
              res,
              400,
              errMsg(
                'invalidParam',
                `Avatar url too long. Max length is + ${MAX_AVATAR_URL_LEN}`
              ),
              clientServer.logger
            )
            return
          }

          clientServer.matrixDb
            .updateWithConditions('profiles', { avatar_url: newAvatarUrl }, [
              { field: 'user_id', value: userId }
            ])
            .then(() => {
              clientServer.logger.debug('AvatarUrl updated')
              send(res, 200, {}, clientServer.logger)
            })
            .catch((e) => {
              /* istanbul ignore next */
              send(
                res,
                500,
                errMsg('unknown', 'Error querying profiles'),
                clientServer.logger
              )
            })
        })
      })
    })
  }
}

export const changeDisplayname = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    /*
    Set the displayname of a user

    Arguments to take into account :
      target_user: the user whose displayname is to be changed.
      requester: The user attempting to make this change.
      newDisplayname: The displayname to give this user.
      byAdmin: Whether this change was made by an administrator.

      TODO : The following arguments are not used in this function,
      but are used in the equivalent function in the Synapse codebase:
        deactivation: Whether this change was made while deactivating the user.
        propagate: Whether this change also applies to the user's membership events.
    */
    const userId: string = (req as Request).params.userId

    console.log('i am here displayname')

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    clientServer.authenticate(req, res, async (token) => {
      const requesterUserId = token.sub
      // Check wether requester is admin or not
      let byAdmin = 0
      try {
        const response = await clientServer.matrixDb.get('users', ['admin'], {
          name: requesterUserId
        })
        byAdmin = response[0].admin as number
      } catch (e) {
        /* istanbul ignore next */
        clientServer.logger.error('Error checking admin:', e)
        /* istanbul ignore next */
        send(
          res,
          500,
          errMsg('unknown', 'Error checking admin'),
          clientServer.logger
        )
      }

      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(
          res,
          schema_name,
          obj,
          clientServer.logger,
          (obj) => {
            const newDisplayname = (obj as changeDisplaynameArgs).displayname
            const targetUserId: string = (req as Request).params.userId

            /*  istanbul ignore if */
            if (!clientServer.isMine(targetUserId)) {
              send(
                res,
                400,
                errMsg('unknown', 'Cannot change displayname of a remote user'),
                clientServer.logger
              )
              return
            }

            if (byAdmin === 0 && requesterUserId !== targetUserId) {
              send(
                res,
                403,
                errMsg(
                  'forbidden',
                  'Cannot change displayname of another user when not admin'
                ),
                clientServer.logger
              )
              return
            }

            // TODO: check if changing displayname is allowed according to config settings

            if (newDisplayname.length > MAX_DISPLAYNAME_LEN) {
              send(
                res,
                400,
                errMsg(
                  'invalidParam',
                  `Displayname too long. Max length is + ${MAX_DISPLAYNAME_LEN}`
                ),
                clientServer.logger
              )
              return
            }

            clientServer.matrixDb
              .updateWithConditions(
                'profiles',
                { displayname: newDisplayname },
                [{ field: 'user_id', value: userId }]
              )
              .then(() => {
                clientServer.logger.debug('Displayname updated')
                send(res, 200, {}, clientServer.logger)
              })
              .catch((e) => {
                /* istanbul ignore next */
                send(
                  res,
                  500,
                  errMsg('unknown', 'Error querying profiles'),
                  clientServer.logger
                )
              })
          }
        )
      })
    })
  }
}
