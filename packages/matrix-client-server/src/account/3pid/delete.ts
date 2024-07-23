import {
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '@twake/utils'
import type MatrixClientServer from '../..'
import fetch from 'node-fetch'

interface RequestBody {
  address: string
  id_server?: string
  medium: string
}

interface RegisterResponseBody {
  token: string
}
const schema = {
  address: true,
  id_server: false,
  medium: true
}

const delete3pid = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (data) => {
      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(
          res,
          schema,
          obj,
          clientServer.logger,
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          async (obj) => {
            const body = obj as RequestBody
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            if (body.id_server) {
              // TODO : call the endpoint https://spec.matrix.org/v1.11/client-server-api/#post_matrixclientv3useruseridopenidrequest_token to request an openID token
              // Exchange the openID token for an access token for the Identity Server using the ID Server's /register endpoints
              // Authenticate the following request to unbind the association
              const registerResponse = await fetch(
                `https://${body.id_server}/_matrix/identity/v2/account/register`,
                {
                  method: 'POST',
                  headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    // The whole response from the previous API call to request an openID token
                  })
                }
              )
              const validToken = (
                registerResponse.json() as unknown as RegisterResponseBody
              ).token
              const UnbindResponse = await fetch(
                `https://${body.id_server}/_matrix/identity/v2/3pid/unbind`,
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${validToken}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    address: body.address,
                    medium: body.medium
                  })
                }
              )
              if (UnbindResponse.ok) {
                // TODO : delete the association from the database
                send(res, 200, {})
              } else {
                send(res, UnbindResponse.status, UnbindResponse.json())
              }
            }
          }
        )
      })
    })
  }
}

export default delete3pid
