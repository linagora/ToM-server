import { errMsg, type expressAppHandler, send } from '@twake/utils'
import type MatrixClientServer from '../index'
import { type Request } from 'express'

export const getDevices = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (data, id) => {
      const userId = data.sub

      clientServer.matrixDb
        .get('devices', ['device_id', 'display_name', 'last_seen', 'ip'], {
          user_id: userId
        })
        .then((rows) => {
          // returns a list of devices
          const _devices = rows.map((row) => {
            return {
              device_id: row.device_id,
              display_name: row.display_name,
              last_seen_ip: row.ip,
              last_seen_ts: row.last_seen
            }
          })
          send(res, 200, { devices: _devices })
        })
        .catch((e) => {
          /* istanbul ignore next */
          clientServer.logger.error('Error querying devices:', e)
        })
    })
  }
}

export const getDeviceInfo = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (data, id) => {
      const userId = data.sub
      const deviceId: string = (req as Request).params.deviceId

      clientServer.matrixDb
        .get('devices', ['display_name', 'last_seen', 'ip'], {
          user_id: userId,
          device_id: deviceId
        })
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
            send(res, 200, {
              device_id: deviceId,
              display_name: rows[0].display_name,
              last_seen_ip: rows[0].ip,
              last_seen_ts: rows[0].last_seen
            })
          }
        })
        .catch((e) => {
          /* istanbul ignore next */
          clientServer.logger.error('Error querying devices:', e)
        })
    })
  }
}
