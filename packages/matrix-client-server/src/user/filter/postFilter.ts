import {
  errMsg,
  type expressAppHandler,
  jsonContent,
  send,
  validateParametersStrict,
  isMatrixIdValid
} from '@twake/utils'
import type MatrixClientServer from '../..'
import type { Request } from 'express'
import { randomString } from '@twake/crypto'
import { Filter } from '../../utils/filter'

const schema = {
  account_data: false,
  event_fields: false,
  event_format: false,
  presence: false,
  room: false
}

const PostFilter = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (data) => {
      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParametersStrict(
          res,
          schema,
          obj,
          clientServer.logger,
          (obj) => {
            const filter: Filter = new Filter(obj)
            // TODO : verify if the user is allowed to make requests for this user id
            // we consider for the moment that the user is only allowed to make requests for his own user id
            const userId = (req as Request).params.userId
            if (!isMatrixIdValid(userId)) {
              send(res, 400, errMsg('invalidParam', 'Invalid user ID'))
              return
            }
            if (userId !== data.sub || !clientServer.isMine(userId)) {
              clientServer.logger.error(
                'Forbidden user id for posting a filter:',
                userId
              )
              send(res, 403, errMsg('forbidden'))
              return
            }
            // Assuming this will guarantee the unique constraint
            const filterId = randomString(16)
            clientServer.matrixDb
              .insert('user_filters', {
                user_id: userId,
                filter_id: filterId,
                filter_json: JSON.stringify(filter) // TODO : clarify the type of the filter_json (bytea, string ???)
              })
              .then(() => {
                clientServer.logger.info('Inserted filter:', filterId)
                send(res, 200, { filter_id: filterId })
              })
              .catch((e) => {
                /* istanbul ignore next */
                clientServer.logger.error('Error while inserting filter:', e)
                /* istanbul ignore next */
                send(res, 500, errMsg('unknown', e))
              })
          }
        )
      })
    })
  }
}

export default PostFilter
