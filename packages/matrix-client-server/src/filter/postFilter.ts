import {
  errMsg,
  type expressAppHandler,
  jsonContent,
  send,
  validateParameters
} from '@twake/utils'
import type MatrixClientServer from '..'
import type { Filter } from '../types'
import type { Request } from 'express'
import { randomString } from '@twake/crypto'

const schema = {
  filter: true
}

const PostFilter = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (token) => {
      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(res, schema, obj, clientServer.logger, (obj) => {
          const filter = obj as Filter
          // TODO : verify if the user is allowed to make requests for this user id
          // we consider for the moment that the user is only allowed to make requests for his own user id
          const userId = (req as Request).params.userId
          if (userId !== token.sub || !clientServer.isMine(userId)) {
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
              send(res, 200, { filter_id: filterId })
            })
            .catch((e) => {
              clientServer.logger.error('Error while inserting filter:', e)
              send(res, 500, errMsg('unknown', e))
            })
        })
      })
    })
  }
}

export default PostFilter
