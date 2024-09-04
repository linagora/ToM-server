import type MatrixClientServer from '../..'
import { errMsg, send, type expressAppHandler } from '@twake/utils'
import { type Request } from 'express'

const GetFilter = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (data, id) => {
      const filterId = (req as Request).params.filterId
      const userId = (req as Request).params.userId
      if (userId !== data.sub || !clientServer.isMine(userId)) {
        clientServer.logger.error(
          `Forbidden user id for getting a filter: ${userId}`
        )
        send(res, 403, errMsg('forbidden'))
        return
      }
      clientServer.matrixDb
        .get('user_filters', ['filter_json'], {
          user_id: userId,
          filter_id: filterId
        })
        .then((rows) => {
          if (rows.length === 0) {
            clientServer.logger.error('Filter not found')
            send(res, 404, errMsg('notFound', 'Cannot retrieve filter'))
            return
          }
          const filter = JSON.parse(rows[0].filter_json as string) // TODO : clarify the type of the filter_json (bytea, string ???)
          clientServer.logger.info(`Fetched filter: ${filterId}`)
          send(res, 200, filter)
        })
        .catch((e) => {
          /* istanbul ignore next */
          clientServer.logger.error('Error while fetching filter', e)
          /* istanbul ignore next */
          send(res, 500, errMsg('unknown'))
        })
    })
  }
}

export default GetFilter
