import { errMsg, send, type expressAppHandler } from '@twake/utils'
import type MatrixClientServer from '..'
import { type tokenContent } from '../utils/authenticate'

interface responseBody {
  user_id: string
  is_guest: boolean
  device_id?: string
}
const whoami = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (data: tokenContent) => {
      clientServer.matrixDb
        .get('users', ['name', 'is_guest'], { name: data.sub })
        .then((rows) => {
          // istanbul ignore if // might remove the istanbul ignore if an endpoint other than /register modifies the users table
          if (rows.length === 0) {
            send(res, 403, errMsg('invalidUsername'))
            return
          }
          const isGuest = rows[0].is_guest !== 0
          const body: responseBody = { user_id: data.sub, is_guest: isGuest }
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          if (data.device_id) {
            body.device_id = data.device_id
          }
          send(res, 200, body)
        })
        .catch((e) => {
          // istanbul ignore next
          clientServer.logger.error('Error while fetching user data', e)
          // istanbul ignore next
          send(res, 500, errMsg('unknown'))
        })
    })
  }
}
export default whoami
