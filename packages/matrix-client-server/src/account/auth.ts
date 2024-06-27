/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import {
    type expressAppHandler,
    send
  } from '../../../matrix-identity-server/src/utils'
import type MatrixClientServer from '..'

const tokenRe = /^Bearer (\S+)$/

const auth = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    const authorization = req.headers.authorization
    if (authorization) {
      const accessToken = authorization.match(tokenRe)?.[1]
      if (accessToken) {
        clientServer.matrixDb
          .get('user_ips', ['user_id'], { access_token: accessToken })
          .then((rows) => {
            if (rows.length === 0) {
              send(res, 401, { error: 'Unauthorized' })
            } else {
              send(res, 200, { user_id: rows[0].user_id })
            }
          })
          .catch((e) => {
            send(res, 500, { error: 'Internal Server Error' })
          })
      } else {
        send(res, 401, { error: 'Unauthorized' })
      }
    } else {
      send(res, 401, { error: 'Unauthorized' })
    }
  }
}

export default auth
