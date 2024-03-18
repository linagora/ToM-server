import {
  validationErrorHandler,
  type expressAppHandler
} from '@twake/matrix-application-server'
import { type MatrixDB } from '@twake/matrix-identity-server'
import { type NextFunction, type Request, type Response } from 'express'
import fetch from 'node-fetch'
import { type Config } from '../../types'
import { hostnameRe } from '../utils'

export const blockSender = (
  conf: Config,
  matrixDb: MatrixDB,
  asToken: string
): expressAppHandler => {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      validationErrorHandler(req)
      if (!hostnameRe.test(conf.matrix_server)) {
        throw Error('Bad matrix_server_name')
      }

      const allRoomsIds = (
        (await matrixDb.getAll('rooms' as any, ['room_id'])) as Array<{
          room_id: string
        }>
      ).map((m) => m.room_id)

      console.log(allRoomsIds)

      const response = await Promise.all(
        (req.body.usersIds as string[])
          .map((userId) =>
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            allRoomsIds.map((roomId) =>
              fetch(
                encodeURI(
                  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                  `https://${conf.matrix_server}/_matrix/client/v3/rooms/${roomId}/ban`
                ),
                {
                  method: 'POST',
                  headers: {
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    Authorization: `Bearer ${asToken}`
                  },
                  body: JSON.stringify({
                    user_id: userId
                  })
                }
              )
            )
          )
          .flat()
      )
      console.log(JSON.stringify(response, null, 2))

      // eslint-disable-next-line @typescript-eslint/promise-function-async
      const bodies = await Promise.all(response.map((r) => r.json()))
      console.log(JSON.stringify(bodies, null, 2))

      res.send()
    } catch (error) {
      // appServer.logger.error(error)
      next(error)
    }
  }
}
