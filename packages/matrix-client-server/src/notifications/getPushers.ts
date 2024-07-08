import { type expressAppHandler, send } from '@twake/utils'
import type MatrixClientServer from '../index'

export const getPushers = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (data, id) => {
      const userId = data.sub
      clientServer.matrixDb
        .get(
          'pushers',
          [
            'app_display_name',
            'app_id',
            'data',
            'device_display_name',
            'kind',
            'lang',
            'profile_tag',
            'pushkey'
          ],
          { user_name: userId }
        )
        .then((rows) => {
          const _pushers = rows.map((row) => ({
            app_display_name: row.app_display_name,
            app_id: row.app_id,
            data: JSON.parse(row.data as string),
            device_display_name: row.device_display_name,
            kind: row.kind,
            lang: row.lang,
            profile_tag: row.profile_tag,
            pushkey: row.pushkey
          }))
          send(res, 200, { pushers: _pushers })
        })
        .catch((e) => {
          /* istanbul ignore next */
          clientServer.logger.error('Error querying pushers:', e)
        })
    })
  }
}
