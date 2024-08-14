import {
  errMsg,
  type expressAppHandler,
  getAccessToken,
  send,
  validateParameters
} from '@twake/utils'
import type MatrixClientServer from '../..'
import {
  getParams,
  validateUserWithUIAuthentication
} from '../../utils/userInteractiveAuthentication'
import {
  type AuthenticationData,
  type AuthenticationFlowContent
} from '../../types'
import type { ServerResponse } from 'http'
import type e from 'express'
import { Hash } from '@twake/crypto'
import { type TokenContent } from '../../utils/authenticate'
import { isAdmin } from '../../utils/utils'

interface RequestBody {
  auth: AuthenticationData
  logout_devices: boolean
  new_password: string
}

const requestBodyReference = {
  logout_devices: 'boolean',
  new_password: 'string'
}

const schema = {
  auth: false,
  logout_devices: false,
  new_password: true
}

const allowedFlows: AuthenticationFlowContent = {
  // Those can be changed. Synapse's implementation only includes m.login.email.identity but
  // I think it's relevant to also include m.login.msisdn and m.login.password
  flows: [
    {
      stages: ['m.login.email.identity']
    },
    {
      stages: ['m.login.msisdn']
    },
    {
      stages: ['m.login.password']
    }
  ],
  params: {
    'm.login.email.identity': getParams('m.login.email.identity'),
    'm.login.msisdn': getParams('m.login.msisdn'),
    'm.login.password': getParams('m.login.password')
  }
}

const revokeTokenAndDevicesAndSend = (
  res: e.Response | ServerResponse,
  clientServer: MatrixClientServer,
  userId: string,
  accessToken?: string,
  deviceId?: string
): void => {
  const deleteDevicesPromise = clientServer.matrixDb.deleteWhere('devices', [
    { field: 'user_id', value: userId, operator: '=' },
    { field: 'device_id', value: deviceId as string, operator: '!=' }
  ])
  const deleteTokenPromise = clientServer.matrixDb.deleteWhere(
    'access_tokens',
    [
      { field: 'user_id', value: userId, operator: '=' },
      { field: 'token', value: accessToken as string, operator: '!=' }
    ]
  )
  Promise.all([deleteDevicesPromise, deleteTokenPromise])
    .then(() => {
      send(res, 200, {})
    })
    .catch((e) => {
      // istanbul ignore next
      console.error('Error while deleting devices and token')
      // istanbul ignore next
      send(res, 500, errMsg('unknown', e), clientServer.logger)
    })
}

const realMethod = async (
  res: e.Response | ServerResponse,
  clientServer: MatrixClientServer,
  body: RequestBody,
  userId: string,
  deviceId?: string,
  accessToken?: string
): Promise<void> => {
  const byAdmin = await isAdmin(clientServer, userId)
  const allowed = clientServer.conf.capabilities.enable_change_password ?? true
  if (!byAdmin && !allowed) {
    // To comply with spec : https://spec.matrix.org/v1.11/client-server-api/#mchange_password-capability
    send(
      res,
      403,
      errMsg(
        'forbidden',
        'Cannot change password as it is not allowed by server'
      ),
      clientServer.logger
    )
    return
  }
  const hash = new Hash()
  hash.ready
    .then(() => {
      const hashedPassword = hash.sha256(body.new_password) // TODO : Handle other algorithms
      clientServer.matrixDb
        .updateWithConditions('users', { password_hash: hashedPassword }, [
          { field: 'name', value: userId }
        ])
        .then(() => {
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          if (body.logout_devices) {
            revokeTokenAndDevicesAndSend(
              res,
              clientServer,
              userId,
              accessToken,
              deviceId
            )
          } else {
            send(res, 200, {})
          }
        })
        .catch((e) => {
          // istanbul ignore next
          console.error('Error while updating password')
          // istanbul ignore next
          send(res, 500, errMsg('unknown', e), clientServer.logger)
        })
    })
    .catch((e) => {
      // istanbul ignore next
      console.error('Error while hashing password')
      // istanbul ignore next
      send(res, 500, errMsg('unknown', e), clientServer.logger)
    })
}
const passwordReset = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    const token = getAccessToken(req)
    if (token != null) {
      clientServer.authenticate(req, res, (data: TokenContent) => {
        validateUserWithUIAuthentication(
          clientServer,
          req,
          res,
          requestBodyReference,
          data.sub,
          'modify your account password',
          data,
          (obj, userId) => {
            validateParameters(res, schema, obj, clientServer.logger, (obj) => {
              realMethod(
                res,
                clientServer,
                obj as RequestBody,
                userId as string,
                data.device_id,
                token
              ).catch((e) => {
                // istanbul ignore next
                console.error('Error while changing password')
                // istanbul ignore next
                send(res, 500, errMsg('unknown', e), clientServer.logger)
              })
            })
          }
        )
      })
    } else {
      clientServer.uiauthenticate(
        req,
        res,
        requestBodyReference,
        allowedFlows,
        'modify your account password',
        (obj, userId) => {
          validateParameters(res, schema, obj, clientServer.logger, (obj) => {
            realMethod(
              res,
              clientServer,
              obj as RequestBody,
              userId as string
            ).catch((e) => {
              // istanbul ignore next
              console.error('Error while changing password')
              // istanbul ignore next
              send(res, 500, errMsg('unknown', e), clientServer.logger)
            })
          })
        }
      )
    }
  }
}

export default passwordReset
