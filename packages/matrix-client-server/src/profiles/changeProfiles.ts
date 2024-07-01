import type MatrixDBmodified from '../matrixDb'
import { type TwakeLogger } from '@twake/logger'
import { type Request } from 'express'
import {
  send,
  type expressAppHandler
} from '../../../matrix-identity-server/src/utils'
import { errMsg } from '../../../matrix-identity-server/src/utils/errors'

const schema = {
  avatar_url: true
}

export const changeAvatarUrl = (
  matrixDb: MatrixDBmodified,
  logger: TwakeLogger
): expressAppHandler => {
  return (req, res) => {
    const userId: string = (req as Request).params.userId
    if (userId !== undefined && userId.length > 0) {
      matrixDb.authenticate(req, res, (data, id) => {
        jsonContent(req, res, idServer.logger, (obj) => {
          validateParameters(res, schema, obj, idServer.logger, (obj) => {
            const new_avatar_url = obj.avatar_url as string

            matrixDb
              .update(
                'profiles',
                { avatar_url: new_avatar_url },
                'user_id',
                userId
              )
              .then(() => {
                logger.debug('Avatar URL updated')
                send(res, 200, {})
              })
              .catch((e) => {
                /* istanbul ignore next */
                logger.error('Error querying profiles:', e)
                send(res, 404, errMsg('notFound', 'This user does not exist'))
              })
          })
        })
      })
    } else {
      logger.debug('No user ID provided')
      send(res, 400, errMsg('missingParams', 'No user ID provided'))
    }
  }
}

const schema_name = {
  displayname: true
}

export const changeDisplayname = (
  matrixDb: MatrixDBmodified,
  logger: TwakeLogger
): expressAppHandler => {
  return (req, res) => {
    const userId: string = (req as Request).params.userId
    if (userId !== undefined && userId.length > 0) {
      matrixDb.authenticate(req, res, (data, id) => {
        jsonContent(req, res, idServer.logger, (obj) => {
          validateParameters(res, schema_name, obj, idServer.logger, (obj) => {
            const new_displayname = obj.displayname as string

            matrixDb
              .update(
                'profiles',
                { displayname: new_displayname },
                'user_id',
                userId
              )
              .then(() => {
                logger.debug('Displayname updated')
                send(res, 200, {})
              })
              .catch((e) => {
                /* istanbul ignore next */
                logger.error('Error querying profiles:', e)
                send(res, 404, errMsg('notFound', 'This user does not exist'))
              })
          })
        })
      })
    } else {
      logger.debug('No user ID provided')
      send(res, 400, errMsg('missingParams', 'No user ID provided'))
    }
  }
}
