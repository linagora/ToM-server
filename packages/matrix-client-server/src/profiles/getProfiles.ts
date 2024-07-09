import type MatrixDBmodified from '../matrixDb'
import { type TwakeLogger } from '@twake/logger'
import { type Request } from 'express'
import { errMsg, send, type expressAppHandler } from '@twake/utils'

export const getProfile = (
  matrixDb: MatrixDBmodified,
  logger: TwakeLogger
): expressAppHandler => {
  return (req, res) => {
    const userId: string = (req as Request).params.userId
    /* istanbul ignore else */
    if (
      userId !== undefined &&
      typeof userId === 'string' &&
      userId.length > 0
    ) {
      matrixDb
        .get('profiles', ['displayname', 'avatar_url'], {
          user_id: userId
        })
        .then((rows) => {
          if (rows.length === 0) {
            logger.info('Profile not found')
            send(res, 404, errMsg('notFound', 'Profile not found'))
          } else {
            // logger.info('Profile found:', rows[0])
            send(res, 200, {
              avatar_url: rows[0].avatar_url,
              displayname: rows[0].displayname
            })
          }
        })
        .catch((e) => {
          /* istanbul ignore next */
          send(
            res,
            403,
            errMsg(
              'forbidden',
              'Profile lookup over federation is disabled on this homeserver'
            )
          )
          /* istanbul ignore next */
          logger.error('Error querying profiles:', e)
        })
    } else {
      send(res, 400, errMsg('missingParams', 'No user ID provided'))
      logger.debug('No user ID provided')
    }
  }
}

export const getAvatarUrl = (
  matrixDb: MatrixDBmodified,
  logger: TwakeLogger
): expressAppHandler => {
  return (req, res) => {
    const userId: string = (req as Request).params.userId
    /* istanbul ignore else */
    if (
      userId !== undefined &&
      typeof userId === 'string' &&
      userId.length > 0
    ) {
      matrixDb
        .get('profiles', ['avatar_url'], {
          user_id: userId
        })
        .then((rows) => {
          if (rows.length === 0) {
            logger.info('No avatar found')
            send(res, 404, errMsg('notFound', 'This user does not exist'))
          } else {
            if (rows[0].avatar_url === null) {
              logger.info('No avatar found')
              send(
                res,
                404,
                errMsg('notFound', 'No avatar found for this user')
              )
            } else {
              send(res, 200, {
                avatar_url: rows[0].avatar_url
              })
            }
          }
        })
        .catch((e) => {
          /* istanbul ignore next */
          logger.error('Error querying profiles:', e)
          /* istanbul ignore next */
          send(res, 500, errMsg('unknown', 'Error querying profiles'))
        })
    } else {
      send(res, 400, errMsg('missingParams', 'No user ID provided'))
      logger.debug('No user ID provided')
    }
  }
}

export const getDisplayname = (
  matrixDb: MatrixDBmodified,
  logger: TwakeLogger
): expressAppHandler => {
  return (req, res) => {
    const userId: string = (req as Request).params.userId
    /* istanbul ignore else */
    if (
      userId !== undefined &&
      typeof userId === 'string' &&
      userId.length > 0
    ) {
      matrixDb
        .get('profiles', ['displayname'], {
          user_id: userId
        })
        .then((rows) => {
          if (rows.length === 0) {
            logger.info('No display_name found')
            send(res, 404, errMsg('notFound', 'This user does not exist'))
          } else {
            if (rows[0].displayname === null) {
              logger.info('No display_name found')
              send(
                res,
                404,
                errMsg('notFound', 'No display_name found for this user')
              )
            } else {
              send(res, 200, {
                displayname: rows[0].displayname
              })
            }
          }
        })
        .catch((e) => {
          /* istanbul ignore next */
          logger.error('Error querying profiles:', e)
          /* istanbul ignore next */
          send(res, 500, errMsg('unknown', 'Error querying profiles'))
        })
    } else {
      send(res, 400, errMsg('missingParams', 'No user ID provided'))
      logger.debug('No user ID provided')
    }
  }
}
