import { errMsg, type expressAppHandler, send } from '@twake/utils'
import type MatrixClientServer from '../../index'
import { type Request } from 'express'

export const isPushruleEnabled = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (data, id) => {
      const userId = data.sub
      const kind: string = (req as Request).params.kind
      const scope: string = (req as Request).params.scope
      const ruleId: string = (req as Request).params.ruleId

      clientServer.matrixDb
        .get('push_rules_enable', ['enabled'], {
          user_name: userId,
          rule_id: ruleId
        })
        .then((rows) => {
          if (rows.length === 0) {
            send(res, 404, errMsg('notFound', 'The push rule was not found'))
          } else {
            send(res, 200, { enabled: rows[0].enabled === 1 })
          }
        })
        .catch((e) => {
          /* istanbul ignore next */
          clientServer.logger.error('Error querying push rules:', e)
        })
    })
  }
}
