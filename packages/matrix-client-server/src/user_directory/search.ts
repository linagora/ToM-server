/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Implements https://spec.matrix.org/latest/client-server-api/#post_matrixclientv3user_directorysearch
 *
 * This is not fixed in the spec and could be modified if needed :
 * Performs a search for users. The homeserver may determine which subset of users are searched.
 * We have decided to  consider the users the requesting user shares a room with and those who reside in public rooms (known to the homeserver)
 *
 * The search MUST consider local users to the homeserver, and SHOULD query remote users as part of the search.
 *
 * TODO : The search is performed case-insensitively on user IDs and display names preferably using a collation determined
 * based upon the Accept-Language header provided in the request, if present.
 *
 */

// TODO : determiner quand la table user_directory est remplie user_who_share_private_rooms et users_in_public_rooms

import type MatrixClientServer from '../index'
import {
  send,
  type expressAppHandler,
  jsonContent,
  validateParameters,
  errMsg
} from '@twake/utils'

const schema = {
  limit: false,
  search_term: true
}

interface UserSearchArgs {
  limit: number
  search_term: string
}

export const userSearch = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (data) => {
      const userId = data.sub

      // ( TODO : could add a check to the capabilities to see if the user has the right to search for users)

      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(
          res,
          schema,
          obj,
          clientServer.logger,
          (validatedObj) => {
            const searchArgs = validatedObj as UserSearchArgs
            // We retrieve the limit from the request, if not present we set it to 10
            const limit = searchArgs.limit === undefined ? 10 : searchArgs.limit

            // We retrieve the search term from the request if not present we return an error
            const searchTerm = searchArgs.search_term
            if (
              searchTerm === undefined ||
              searchTerm === '' ||
              searchTerm === null
            ) {
              send(
                res,
                400,
                errMsg('missingParams', 'Missing search term'),
                clientServer.logger
              )
              return
            }

            const searchAllUsers =
              clientServer.conf.user_directory.enable_all_users_search ?? false

            clientServer.matrixDb
              .searchUserDirectory(userId, searchTerm, limit, searchAllUsers)
              .then((rows) => {
                const _limited = rows.length > limit

                const _results = rows.map((row) => {
                  return {
                    avatar_url: row.avatar_url,
                    display_name: row.display_name,
                    user_id: row.user_id
                  }
                })

                send(
                  res,
                  200,
                  { results: _results, limited: _limited },
                  clientServer.logger
                )
              })
              .catch((err) => {
                send(res, 500, errMsg('unknown', err), clientServer.logger)
              })
          }
        )
      })
    })
  }
}
