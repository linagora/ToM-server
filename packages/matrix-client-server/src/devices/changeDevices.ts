/*
This file implements the changeDeviceName functions, which is used to update the display name of a device associated with a user.
These functions are used to provide device management functionality in the Matrix client server : https://spec.matrix.org/v1.11/client-server-api/#get_matrixclientv3devices

TODO : Add checks to ensure that the user has the rigths to change the device name.
*/

import {
  errMsg,
  type expressAppHandler,
  jsonContent,
  send,
  validateParameters
} from '@twake/utils'
import type MatrixClientServer from '../index'
import { type Request } from 'express'

const schema = {
  display_name: true
}

interface changeDeviceNameArgs {
  display_name: string
}

export const changeDeviceName = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    const deviceId: string = (req as Request).params.deviceId
    clientServer.authenticate(req, res, (token) => {
      const userId = token.sub
      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(res, schema, obj, clientServer.logger, (obj) => {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          const new_display_name = (obj as changeDeviceNameArgs).display_name

          if (new_display_name.length > 255) {
            send(
              res,
              400,
              errMsg(
                'invalidParam',
                'The display name must be less than 255 characters'
              )
            )
            return
          }

          clientServer.matrixDb
            .updateWithConditions(
              'devices',
              { display_name: new_display_name },
              [
                { field: 'device_id', value: deviceId },
                { field: 'user_id', value: userId }
              ]
            )
            .then((rows) => {
              if (rows.length === 0) {
                send(
                  res,
                  404,
                  errMsg(
                    'notFound',
                    'The current user has no device with the given ID'
                  ),
                  clientServer.logger
                )
              } else {
                clientServer.logger.debug('Device Name updated')
                send(res, 200, {}, clientServer.logger)
              }
            })
            .catch((e) => {
              /* istanbul ignore next */
              clientServer.logger.error('Error querying profiles:')
              /* istanbul ignore next */
              send(res, 500, errMsg('unknown', e), clientServer.logger)
            })
        })
      })
    })
  }
}
