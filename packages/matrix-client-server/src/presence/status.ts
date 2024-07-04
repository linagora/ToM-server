import type MatrixClientServer from '..'
import {
  jsonContent,
  validateParameters,
  errMsg,
  type expressAppHandler,
  send,
  epoch
} from '@twake/utils'

interface PutRequestBody {
  presence: string
  status_msg: string
}

const schema = {
  presence: true,
  status_msg: false
}

const mxidRe = /^@[0-9a-zA-Z._=-]+:[0-9a-zA-Z.-]+$/

// TODO : Handle error 403 where the user isn't allowed to see this user's presence status, may have to do with the "users_to_send_full_presence_to" table in the matrixDb
// NB : Maybe the function should update the presence_stream table of the matrixDB, reread the code after implementing streams-related endpoints
const status = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const userId: string = req.params.userId as string
    if (!mxidRe.test(userId)) {
      clientServer.logger.warn('Invalid user ID')
      send(res, 400, errMsg('invalidParam'))
    } else {
      clientServer.authenticate(req, res, (data, id) => {
        if (req.method === 'GET') {
          clientServer.matrixDb
            .get('presence', ['state', 'mtime', 'state', 'status_msg'], {
              user_id: userId
            })
            .then((rows) => {
              if (rows.length === 0) {
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
        } else if (req.method === 'PUT') {
          jsonContent(req, res, clientServer.logger, (obj) => {
            validateParameters(res, schema, obj, clientServer.logger, (obj) => {
              if (data.sub !== userId) {
                clientServer.logger.warn(
                  'You cannot set the presence state of another user'
                )
                send(res, 403, errMsg('forbidden'))
                return
              }
              clientServer.matrixDb
                .updateWithConditions(
                  'presence',
                  {
                    state: (obj as PutRequestBody).presence,
                    status_msg: (obj as PutRequestBody).status_msg
                  },
                  [{ field: 'user_id', value: userId }]
                )
                .then(() => {
                  send(res, 200, {})
                })
                .catch((e) => {
                  // istanbul ignore next
                  clientServer.logger.error(
                    "Error updating user's presence state",
                    e
                  )
                  // istanbul ignore next
                  send(res, 500, errMsg('unknown'))
                })
            })
          })
        }
      })
    }
  }
}
export default status
