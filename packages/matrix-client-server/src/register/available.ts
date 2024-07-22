import { errMsg, send, type expressAppHandler } from '@twake/utils'
import type MatrixClientServer from '..'

interface Parameters {
  username: string
}

const matrixIdRegex = /^@[0-9a-zA-Z._=-]+:[0-9a-zA-Z.-]+$/

const available = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    // @ts-expect-error req has query
    const userId = (req.query as Parameters).username
    if (!matrixIdRegex.test(userId)) {
      clientServer.logger.error('Invalid user ID')
      send(
        res,
        400,
        errMsg('invalidParam', 'Invalid user ID'),
        clientServer.logger
      )
      return
    }
    for (const appService of clientServer.conf.application_services) {
      if (
        // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
        appService.namespaces.users !== undefined &&
        appService.namespaces.users !== null &&
        appService.namespaces.users.some(
          (namespace) =>
            new RegExp(namespace.regex).test(userId) && namespace.exclusive
        )
      ) {
        send(
          res,
          400,
          errMsg(
            'exclusive',
            'The desired username is in the exclusive namespace claimed by an application service.'
          ),
          clientServer.logger
        )
        return
      }
      clientServer.matrixDb
        .get('users', ['name'], { name: userId })
        .then((rows) => {
          if (rows.length > 0) {
            send(res, 400, errMsg('userInUse'), clientServer.logger)
          } else {
            send(res, 200, { available: true }, clientServer.logger)
          }
        })
        .catch((e) => {
          // istanbul ignore next
          clientServer.logger.error('Error while checking user availability', e)
          // istanbul ignore next
          send(res, 500, e, clientServer.logger)
        })
    }
  }
}

export default available
