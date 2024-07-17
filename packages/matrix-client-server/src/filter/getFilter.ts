import type MatrixClientServer from '..'
import { errMsg, send, type expressAppHandler } from '@twake/utils'
import { type Request } from 'express'

const GetFilter = (ClientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    ClientServer.authenticate(req, res, (data, id) => {
      const filterId = (req as Request).params.filterId
      const userId = (req as Request).params.userId
      if (userId !== data.sub || !ClientServer.isMine(userId)) {
        send(res, 403, errMsg('forbidden'))
        return
      }
      ClientServer.matrixDb
        .get('user_filters', ['filter_json'], {
          user_id: userId,
          filter_id: filterId
        })
        .then((rows) => {
          if (rows.length === 0) {
            ClientServer.logger.error('Filter not found')
            send(res, 404, errMsg('notFound', 'Cannot retrieve filter'))
            return
          }
          const filter = JSON.parse(rows[0].filter_json as string) // TODO : clarify the type of the filter_json (bytea, string ???)
          send(res, 200, filter)
        })
        .catch((e) => {
          ClientServer.logger.error('Error while fetching filter', e)
          /* istanbul ignore next */
          send(res, 500, errMsg('unknown'))
        })
    })
  }
}

export default GetFilter
