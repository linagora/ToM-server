/* eslint-disable @typescript-eslint/naming-convention */

/*
This functions impements the sync function described in the Matrix Protocol : https://spec.matrix.org/v1.11/client-server-api/#syncing
*/

import type MatrixClientServer from '../index'
import { type Request } from 'express'
import { errMsg, send, type expressAppHandler } from '@twake/utils'
import { type tokenContent } from '../utils/authenticate'
import { Filter } from '../utils/filter'

// interface SyncRequest {
//   filter: string
//   full_state: boolean
//   set_presence: string
//   since: string
//   timeout: number
// }

export const sync = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    if (
      (req as Request).query.from !== undefined &&
      (req as Request).query.from !== null
    ) {
      // Some others endpoints related to /events used to use 'from' as a parameter
      // Let's inform the client that this parameter is not used anymore
      send(
        res,
        400,
        errMsg(
          'invalidParam',
          'Parameter "from" is not used anymore. You should use "since" instead.'
        )
      )
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    clientServer.authenticate(req, res, async (token: tokenContent) => {
      const requesterUserId = token.sub
      const deviceId = token.device_id

      // Retrieving query parameters
      let timeout: number
      let full_state: boolean
      let set_presence: string
      let filter_id: string
      let since: string
      try {
        timeout =
          (req as Request).query.timeout !== undefined
            ? parseInt((req as Request).query.timeout as string)
            : 0
        full_state =
          (req as Request).query.full_state !== undefined
            ? parseInt((req as Request).query.full_state as string) === 1
            : false
        set_presence =
          (req as Request).query.set_presence !== undefined
            ? ((req as Request).query.set_presence as string)
            : 'online'
        if (
          set_presence !== 'offline' &&
          set_presence !== 'online' &&
          set_presence !== 'unavailable'
        ) {
          throw new Error('Invalid set_presence value')
        }
        filter_id = (req as Request).query.filter_id as string
        since = (req as Request).query.since as string
      } catch (err) {
        send(res, 400, errMsg('invalidParam', err))
        return
      }

      clientServer.logger.debug(
        'Sync request from user',
        requesterUserId,
        'with device',
        deviceId,
        'with since = ',
        since,
        'and timeout = ',
        timeout,
        'and full_state = ',
        full_state,
        'and set_presence = ',
        set_presence,
        'and filter_id = ',
        filter_id
      )

      // TODO : Retrieve the correct filter
      // If no filter_id is provided the getAll filter is used
      // Check if the filter_id is represents a filter id or a filter JSON object encoded as string
      //   The server will detect whether it is an ID or a JSON object by whether the first character is a "{" open brace.
      //   Passing the JSON inline is best suited to one off requests.
      //   Creating a filter using the filter API is recommended for clients that reuse the same filter multiple times,
      //   for example in long poll requests.

      let syncFilter: Filter

      if (filter_id === undefined) {
        syncFilter = new Filter({})
      } else if (filter_id.startsWith('{')) {
        // This means the filter_id is a JSON object encoded as string
        try {
          const filter = JSON.parse(filter_id)
          syncFilter = new Filter(filter)
        } catch (err) {
          send(
            res,
            500,
            errMsg('unknown', 'Could not create filter from filter_mapping')
          )
        }
      } else {
        // Retrieve the filter from the filter_id either using the filter get API or by directly looking in the database
      }

      // TODO : Retrieve the correct set of events then filter then slice them using limit
      // TODO : implement pagination
      // TODO : implement timeout
    })
  }
}
