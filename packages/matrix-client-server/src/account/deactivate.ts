import {
  errMsg,
  type expressAppHandler,
  getAccessToken,
  send
} from '@twake/utils'
import type MatrixClientServer from '..'
import { type TokenContent } from '../utils/authenticate'
import {
  getParams,
  validateUserWithUIAuthentication
} from '../utils/userInteractiveAuthentication'
import {
  type AuthenticationFlowContent,
  type AuthenticationData
} from '../types'
import type { ServerResponse } from 'http'
import type e from 'express'

interface RequestBody {
  auth: AuthenticationData
  erase: boolean
  id_server: string
}

const requestBodyReference = {
  erase: 'boolean',
  id_server: 'string'
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

const realMethod = async (
  res: e.Response | ServerResponse,
  clientServer: MatrixClientServer,
  body: RequestBody,
  userId: string
): Promise<void> => {
  // TODO : Check if the user's account can be deactivated (ex if he is not an admin, check synapse)

  // 1) Get all users 3pids and call the endpoint /delete to delete the bindings from the ID server and the 3pid associations from the homeserver
  // Delete the device and access token used in the request. The most simple way is to just delete all devices and access tokens associated to the userId
  // So we don't have to separate the case where there was an access token in the request or not
  clientServer.matrixDb
    .get('user_threepids', ['medium', 'address'], { user_id: userId })
    .then((rows) => {
      const promises = rows.forEach((row) => {
        fetch(
          `https://${clientServer.conf.server_name}/_matrix/client/v3/account/3pid/delete`,
          {}
        )
      })
    })
    .catch((e) => {
      // istanbul ignore next
      console.error('Error while getting user 3pids')
      // istanbul ignore next
      send(res, 500, errMsg('unknown', e), clientServer.logger)
    })

  // TODO :
  // 2) Delete all pushers ???
  // 3) Delete from user_directory ??
  // 4) Mark the user as erased, set avatar_url and display_name to ""
  // 5) Part user from rooms
  // 6) Reject all pending invites
  // 7) Remove user information from "account_validity" table
  // 8) Set deactivated to 1 and password_hash to null in the users table
  // 9) Remove account_data
  // 10) Delete server_side backup-keys ??
  // 11) Let module know the user has been deleted ??
}

const deactivate = (clientServer: MatrixClientServer): expressAppHandler => {
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
            realMethod(
              res,
              clientServer,
              obj as RequestBody,
              userId as string
            ).catch((e) => {
              // istanbul ignore next
              console.error('Error while deactivating account')
              // istanbul ignore next
              send(res, 500, errMsg('unknown', e), clientServer.logger)
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
        }
      )
    }
  }
}
export default deactivate
