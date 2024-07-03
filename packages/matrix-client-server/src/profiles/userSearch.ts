import type MatrixClientServer from '../index'
import {
  send,
  type expressAppHandler,
  jsonContent,
  validateParameters
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
    clientServer.authenticate(req, res, (data, id) => {
      const userId = data.sub

      jsonContent(req, res, clientServer.logger, (obj) => {
        validateParameters(
          res,
          schema,
          obj,
          clientServer.logger,
          (validatedObj) => {
            const searchArgs = validatedObj as UserSearchArgs
            const searchTerm = searchArgs.search_term
            const limit = searchArgs.limit === undefined ? 10 : searchArgs.limit

            clientServer.matrixDb
              .get('local_current_membership', ['room_id'], {
                user_id: userId,
                membership: 'join'
              })
              .then((roomsResult) => {
                const roomIds = roomsResult.map(
                  (row) => row.room_id
                ) as string[]
                clientServer.matrixDb
                  .get('local_current_membership', ['user_id'], {
                    room_id: roomIds,
                    membership: 'join'
                  })
                  .then((usersResult) => {
                    const userIds = usersResult.map(
                      (row) => row.user_id
                    ) as string[]

                    clientServer.matrixDb
                      .get(
                        'profiles',
                        ['user_id', 'displayname', 'avatar_url'],
                        { user_id: userIds }
                      )
                      .then((profilesResult) => {
                        const filteredResults = profilesResult
                          .filter(
                            (profile) =>
                              (profile.user_id as string).includes(
                                searchTerm
                              ) ||
                              (profile.displayname !== undefined &&
                                (profile.displayname as string).includes(
                                  searchTerm
                                ))
                          )
                          .slice(0, limit)

                        const results = filteredResults.map((profile) => ({
                          user_id: profile.user_id,
                          display_name:
                            profile.displayname !== undefined
                              ? profile.displayname
                              : null,
                          avatar_url:
                            profile.avatar_url !== undefined
                              ? profile.avatar_url
                              : null
                        }))

                        send(res, 200, {
                          limited: filteredResults.length > limit,
                          results
                        })
                      })
                      .catch((e) => {
                        /* istanbul ignore next */
                        clientServer.logger.error('Error querying profiles:', e)
                      })
                  })
                  .catch((e) => {
                    /* istanbul ignore next */
                    clientServer.logger.error(
                      'Error querying local_current_membership for users:',
                      e
                    )
                  })
              })
              .catch((e) => {
                /* istanbul ignore next */
                clientServer.logger.error(
                  'Error querying local_current_membership for rooms:',
                  e
                )
              })
          }
        )
      })
    })
  }
}
