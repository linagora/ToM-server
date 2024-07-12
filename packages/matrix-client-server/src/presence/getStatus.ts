import type MatrixClientServer from '..'
import { errMsg, type expressAppHandler, send, epoch } from '@twake/utils'

const matrixIdRegex = /^@[0-9a-zA-Z._=-]+:[0-9a-zA-Z.-]+$/

// TODO : Handle error 403 where the user isn't allowed to see this user's presence status, may have to do with the "users_to_send_full_presence_to" table in the matrixDb
const getStatus = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const userId: string = req.params.userId as string
    if (!matrixIdRegex.test(userId)) {
      clientServer.logger.warn('Invalid user ID')
      send(res, 400, errMsg('invalidParam'))
    } else {
      clientServer.authenticate(req, res, (data, id) => {
        clientServer.matrixDb
          .get('presence', ['state', 'mtime', 'state', 'status_msg'], {
            user_id: userId
          })
          .then((rows) => {
            if (rows.length === 0) {
              clientServer.logger.error('No presence state for this user')
              send(res, 404, {
                errcode: 'M_UNKNOWN',
                error:
                  'There is no presence state for this user. This user may not exist or isn’t exposing presence information to you.'
              })
            } else {
              send(res, 200, {
                currently_active: rows[0].state === 'online',
                last_active_ts: epoch() - (rows[0].mtime as number), // TODO : Check if mtime corresponds to last_active_ts, not clear in the spec
                state: rows[0].state,
                status_msg: rows[0].status_msg
              })
            }
          })
          .catch((e) => {
            // istanbul ignore next
            clientServer.logger.error(
              "Error retrieving user's presence state",
              e
            )
            // istanbul ignore next
            send(res, 500, errMsg('unknown'))
          })
      })
    }
  }
}
export default getStatus
