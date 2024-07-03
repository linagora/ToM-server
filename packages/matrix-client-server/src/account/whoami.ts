import { type tokenContent } from '@twake/matrix-identity-server'
import { errMsg, send, type expressAppHandler } from '@twake/utils'
import type MatrixClientServer from '..'

const whoami = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(
      req,
      res,
      (idToken: tokenContent, token: string | null) => {
        const userId = idToken.sub
        clientServer.matrixDb
          .get('users', ['device_id'], { user_id: userId })
          .then((rows) => {
            if (rows.length === 0) {
              clientServer.matrixDb
                .get('threepid_guest_access_tokens', ['guest_access_token'], {
                  guest_access_token: token as string
                })
                .then((guestRows) => {
                  if (guestRows.length > 0) {
                    send(res, 200, {
                      user_id: idToken.sub,
                      is_guest: true
                    })
                  } else {
                    send(res, 200, {
                      user_id: idToken.sub,
                      is_guest: false
                    })
                  }
                })
                .catch((e) => {
                  clientServer.logger.error(e)
                  send(res, 500, errMsg('unknown'))
                })
            } else {
              clientServer.matrixDb
                .get('threepid_guest_access_tokens', ['guest_access_token'], {
                  guest_access_token: token as string
                })
                .then((guestRows) => {
                  if (guestRows.length > 0) {
                    send(res, 200, {
                      user_id: idToken.sub,
                      is_guest: true,
                      device_id: rows[0].device_id
                    })
                  } else {
                    send(res, 200, {
                      user_id: idToken.sub,
                      device_id: rows[0].device_id,
                      is_guest: false
                    })
                  }
                })
                .catch((e) => {
                  clientServer.logger.error(e)
                  send(res, 500, errMsg('unknown'))
                })
            }
          })
          .catch((e) => {
            clientServer.logger.error(e)
            send(res, 500, errMsg('unknown'))
          })
      }
    )
  }
}

export default whoami
