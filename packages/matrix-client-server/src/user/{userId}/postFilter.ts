import { randomString } from '@twake/crypto'
import MatrixClientServer from '../..'
import {
  send,
  type expressAppHandler
} from '@twake/matrix-identity-server/dist/utils'
import {
  jsonContent,
  validateParameters
} from '@twake/matrix-identity-server/dist/utils'
import { type EventFilter, RoomFilter } from '../../types'

interface postFilterArgs {
  account_data?: EventFilter
  event_fields?: string[]
  event_format?: 'client' | 'federation'
  presence?: EventFilter
  room?: RoomFilter
}

const schema = {
  event_fields: false,
  event_format: false,
  account_data: false,
  presence: false,
  room: false
}

const PostFilter = (ClientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    ClientServer.authenticate(req, res, (data, id) => {
      jsonContent(req, res, ClientServer.logger, (obj) => {
        validateParameters(res, schema, obj, ClientServer.logger, (obj) => {
          const requestBody = obj as postFilterArgs
          const filter_id = randomString(16)
          // TODO : store the filter in the db
          send(res, 200, { filter_id: filter_id })
        })
      })
    })
  }
}

export default PostFilter
