import {
  type expressAppHandler,
  jsonContent,
  send,
  validateParameters
} from '@twake/utils'
import type MatrixClientServer from '../..'
import { type TokenContent } from '../../utils/authenticate'
import fetch from 'node-fetch'

interface RequestBody {
  client_secret: string
  id_access_token: string
  id_server: string
  sid: string
}

interface ResponseBody {
  address: string
  medium: string
  mxid: string
  not_after: number
  not_before: number
  ts: number
}

const schema = {
  client_secret: true,
  id_access_token: true,
  id_server: true,
  sid: true
}

const bind = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (data: TokenContent) => {
      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(
          res,
          schema,
          obj,
          clientServer.logger,
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          async (obj) => {
            const requestBody = obj as RequestBody
            const response = await fetch(
              `https://${requestBody.id_server}/_matrix/identity/v2/3pid/bind`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${requestBody.id_access_token}`,
                  Accept: 'application/json',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  sid: requestBody.sid,
                  client_secret: requestBody.client_secret,
                  mxid: data.sub
                })
              }
            )
            const responseBody = (await response.json()) as ResponseBody
            if (response.status === 200) {
              clientServer.matrixDb
                .insert('user_threepid_id_server', {
                  user_id: data.sub,
                  id_server: requestBody.id_server,
                  medium: responseBody.medium,
                  address: responseBody.address
                })
                .then(() => {
                  send(res, 200, {})
                })
                .catch((e) => {
                  // istanbul ignore next
                  clientServer.logger.error(
                    'Error while inserting data into the Matrix database',
                    e
                  )
                  // istanbul ignore next
                  send(res, 500, {})
                })
            } else {
              send(res, response.status, responseBody)
            }
          }
        )
      })
    })
  }
}

export default bind
