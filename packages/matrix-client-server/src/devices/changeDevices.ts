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
    clientServer.authenticate(req, res, (data, id) => {
      const userId = data.sub
      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(res, schema, obj, clientServer.logger, (obj) => {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          const _display_name = (obj as changeDeviceNameArgs).display_name

          clientServer.matrixDb
            .updateWithConditions('devices', { display_name: _display_name }, [
              { field: 'device_id', value: deviceId },
              { field: 'user_id', value: userId }
            ])
            .then((rows) => {
              if (rows.length === 0) {
                send(
                  res,
                  404,
                  errMsg(
                    'notFound',
                    'The current user has no device with the given ID'
                  )
                )
              } else {
                clientServer.logger.debug('Device Name updated')
                send(res, 200, {})
              }
            })
            .catch((e) => {
              /* istanbul ignore next */
              clientServer.logger.error('Error querying profiles:', e)
            })
        })
      })
    })
  }
}
