import type MatrixClientServer from '..'
import {
  errMsg,
  type expressAppHandler,
  send,
  epoch,
  isMatrixIdValid
} from '@twake/utils'

const getStatus = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const userId: string = req.params.userId as string
    if (!isMatrixIdValid(userId)) {
      send(
        res,
        400,
        errMsg('invalidParam', 'Invalid user ID'),
        clientServer.logger
      )
    } else {
      clientServer.authenticate(req, res, (data, id) => {
        // TODO : Handle error 403 where the user isn't allowed to see this user's presence status, may have to do with the "users_to_send_full_presence_to" table in the matrixDb
        clientServer.matrixDb
          .get(
            'presence_stream',
            ['currently_active', 'last_active_ts', 'state', 'status_msg'],
            {
              user_id: userId
            }
          )
          .then((rows) => {
            if (rows.length === 0) {
              send(
                res,
                404,
                {
                  errcode: 'M_UNKNOWN',
                  error:
                    'There is no presence state for this user. This user may not exist or isn’t exposing presence information to you.'
                },
                clientServer.logger
              )
            } else {
              send(
                res,
                200,
                {
                  currently_active: rows[0].currently_active,
                  last_active_ago: epoch() - (rows[0].last_active_ts as number),
                  presence: rows[0].state,
                  status_msg: rows[0].status_msg
                },
                clientServer.logger
              )
            }
          })
          .catch((e) => {
            // istanbul ignore next
            clientServer.logger.error("Error retrieving user's presence state")
            // istanbul ignore next
            send(res, 500, errMsg('unknown', e.toString()), clientServer.logger)
          })
      })
    }
  }
}
export default getStatus
