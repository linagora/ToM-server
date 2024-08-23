import { errMsg, type expressAppHandler, jsonContent, send } from '@twake/utils'
import type MatrixClientServer from '..'
import { type AuthenticationData } from '../types'
import { validateUserWithUIAuthentication } from '../utils/userInteractiveAuthentication'
import { verifyAuthenticationData, verifyString } from '../typecheckers'
import { deleteDevicesData } from '../delete_devices'

interface RequestBody {
  auth?: AuthenticationData
}

interface Parameters {
  deviceId: string
}
const deleteDevice = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (data) => {
      jsonContent(req, res, clientServer.logger, (obj) => {
        const body = obj as unknown as RequestBody
        // @ts-expect-error : request has parameters
        const deviceId = (req.params as Parameters).deviceId
        if (
          body.auth != null &&
          body.auth !== undefined &&
          !verifyAuthenticationData(body.auth)
        ) {
          send(res, 400, errMsg('invalidParam', 'Invalid auth'))
          return
        } else if (!verifyString(deviceId)) {
          send(res, 400, errMsg('invalidParam', 'Invalid device ID'))
          return
        }
        validateUserWithUIAuthentication(
          clientServer,
          req,
          res,
          data.sub,
          'delete device',
          obj,
          (obj, userId) => {
            deleteDevicesData(clientServer, [deviceId], userId as string)
              .then(() => {
                send(res, 200, {})
              })
              .catch((e) => {
                // istanbul ignore next
                clientServer.logger.error(`Error while deleting device`, e)
                // istanbul ignore next
                send(
                  res,
                  500,
                  errMsg('unknown', e.toString()),
                  clientServer.logger
                )
              })
          }
        )
      })
    })
  }
}

export default deleteDevice
