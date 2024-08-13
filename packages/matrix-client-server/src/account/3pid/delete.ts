import {
  errMsg,
  isEmailValid,
  isPhoneNumberValid,
  isEmailValid,
  isPhoneNumberValid,
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '@twake/utils'
import type MatrixClientServer from '../..'
import fetch from 'node-fetch'
import { type TokenContent } from '../../utils/authenticate'
import type { ServerResponse } from 'http'
import type e from 'express'
import { MatrixResolve } from 'matrix-resolve'
import { type TokenContent } from '../../utils/authenticate'
import type { ServerResponse } from 'http'
import type e from 'express'
import { MatrixResolve } from 'matrix-resolve'
import { isAdmin } from '../../utils/utils'

interface RequestBody {
  address: string
  id_server?: string
  medium: string
}

interface RegisterResponseBody {
  token: string
}

interface OpenIDResponseBody {
  access_token: string
  expires_in: number
  matrix_server_name: string
  token_type: string
}


interface OpenIDResponseBody {
  access_token: string
  expires_in: number
  matrix_server_name: string
  token_type: string
}

const schema = {
  address: true,
  id_server: false,
  medium: true
}

const deleteAndSend = async (
  res: e.Response | ServerResponse,
  body: RequestBody,
  clientServer: MatrixClientServer,
  idServer: string,
  data: TokenContent,
  token: string | null
): Promise<void> => {
  const openIDResponse = await fetch(
    `https://${clientServer.conf.server_name}/_matrix/client/v3/user/${data.sub}/openid/request_token`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token as string}`
      },
      body: JSON.stringify({
        user_id: data.sub
      })
    }
  )
  // istanbul ignore if
  if (!openIDResponse.ok) {
    // istanbul ignore next
    send(
      res,
      500,
      errMsg('unknown', 'Error while requesting OpenID token'),
      clientServer.logger
    )
    // istanbul ignore next
    return
  }
  const openIDResponseBody: OpenIDResponseBody =
    (await openIDResponse.json()) as OpenIDResponseBody

  const matrixResolve = new MatrixResolve({
    cache: 'toad-cache'
  })
  const baseUrl: string | string[] = await matrixResolve.resolve(idServer)
  const registerResponse = await fetch(
    `https://${baseUrl as string}/_matrix/identity/v2/account/register`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(openIDResponseBody)
    }
  )
  const validToken = (
    registerResponse.json() as unknown as RegisterResponseBody
  ).token
  const UnbindResponse = await fetch(
    `https://${baseUrl as string}/_matrix/identity/v2/3pid/unbind`,
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
    const deleteAdd = clientServer.matrixDb.deleteWhere('user_threepids', [
      { field: 'address', value: body.address, operator: '=' },
      { field: 'medium', value: body.medium, operator: '=' },
      { field: 'user_id', value: data.sub, operator: '=' }
    ])
    const deleteBind = clientServer.matrixDb.deleteWhere(
      'user_threepid_id_server',
      [
        { field: 'address', value: body.address, operator: '=' },
        { field: 'medium', value: body.medium, operator: '=' },
        { field: 'user_id', value: data.sub, operator: '=' },
        { field: 'id_server', value: idServer, operator: '=' }
      ]
    )
    Promise.all([deleteAdd, deleteBind])
      .then(() => {
        send(res, 200, { id_server_unbind_result: 'success' })
      })
      .catch((e) => {
        // istanbul ignore next
        clientServer.logger.error('Error while deleting user_threepids', e)
        // istanbul ignore next
        send(res, 500, errMsg('unknown', e), clientServer.logger)
      })
  } else {
    // istanbul ignore next
    send(res, UnbindResponse.status, {
      id_server_unbind_result: 'no-support'
    })
  }
}

const delete3pid = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (data, token) => {
    clientServer.authenticate(req, res, (data, token) => {
      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(
          res,
          schema,
          obj,
          clientServer.logger,
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          async (obj) => {
            const body = obj as RequestBody
            const byAdmin = await isAdmin(clientServer, data.sub)
            const allowed =
              clientServer.conf.capabilities.enable_3pid_changes ?? true
            if (!byAdmin && !allowed) {
              send(
                res,
                403,
                errMsg(
                  'forbidden',
                  'Cannot add 3pid as it is not allowed by server'
                ),
                clientServer.logger
              )
              return
            }
            if (!['email', 'msisdn'].includes(body.medium)) {
              send(
                res,
                400,
                errMsg(
                  'invalidParam',
                  'Invalid medium, medium must be either email or msisdn'
                ),
                clientServer.logger
              )
              return
            }
            if (body.medium === 'email' && !isEmailValid(body.address)) {
              send(
                res,
                400,
                errMsg('invalidParam', 'Invalid email address'),
                clientServer.logger
              )
              return
            }
            if (body.medium === 'msisdn' && !isPhoneNumberValid(body.address)) {
              send(
                res,
                400,
                errMsg('invalidParam', 'Invalid phone number'),
                clientServer.logger
              )
              return
            }
            let idServer: string
            if (!['email', 'msisdn'].includes(body.medium)) {
              send(
                res,
                400,
                errMsg(
                  'invalidParam',
                  'Invalid medium, medium must be either email or msisdn'
                ),
                clientServer.logger
              )
              return
            }
            if (body.medium === 'email' && !isEmailValid(body.address)) {
              send(
                res,
                400,
                errMsg('invalidParam', 'Invalid email address'),
                clientServer.logger
              )
              return
            }
            if (body.medium === 'msisdn' && !isPhoneNumberValid(body.address)) {
              send(
                res,
                400,
                errMsg('invalidParam', 'Invalid phone number'),
                clientServer.logger
              )
              return
            }
            let idServer: string
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            if (typeof body.id_server === 'string' && body.id_server) {
              idServer = body.id_server
              deleteAndSend(
                res,
                body,
                clientServer,
                idServer,
                data,
                token
              ).catch((e) => {
                // istanbul ignore next
                clientServer.logger.error('Error while deleting 3pid', e)
                // istanbul ignore next
                send(res, 500, errMsg('unknown', e), clientServer.logger)
              })
            } else {
              clientServer.matrixDb
                .get('user_threepid_id_server', ['id_server'], {
                  user_id: data.sub,
                  medium: body.medium,
                  address: body.address
                })
                .then((rows) => {
                  if (rows.length === 0) {
                    clientServer.logger.error(
                      'No id_server found corresponding to the user'
                    )
                    send(res, 400, {
                      id_server_unbind_result: 'no-support'
                    })
                    return
                  }
                  deleteAndSend(
                    res,
                    body,
                    clientServer,
                    rows[0].id_server as string,
                    data,
                    token
                  ).catch((e) => {
                    // istanbul ignore next
                    clientServer.logger.error('Error while deleting 3pid', e)
                    // istanbul ignore next
                    send(res, 500, errMsg('unknown', e), clientServer.logger)
                  })
                })
                .catch((e) => {
                  // istanbul ignore next
                  clientServer.logger.error(
                    'Error while getting id_server from the database',
                    e
                  )
                  // istanbul ignore next
                  send(res, 500, errMsg('unknown', e), clientServer.logger)
                })
                })
                .catch((e) => {
                  // istanbul ignore next
                  clientServer.logger.error(
                    'Error while getting id_server from the database',
                    e
                  )
                  // istanbul ignore next
                  send(res, 500, errMsg('unknown', e), clientServer.logger)
                })
            }
          }
        )
      })
    })
  }
}

export default delete3pid
