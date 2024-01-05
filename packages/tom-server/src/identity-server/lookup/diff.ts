import { type TwakeLogger } from '@twake/logger'
import { Utils, errMsg } from '@twake/matrix-identity-server'
import type TwakeServer from '../..'
import { type expressAppHandler } from '../../types'

const schema = {
  since: true,
  fields: false,
  limit: false,
  offset: false
}

interface DiffQueryBody {
  since: number
  fields?: string[]
  limit?: number
  offset?: number
}

const diff = (
  tomServer: TwakeServer,
  logger: TwakeLogger
): expressAppHandler => {
  return (req, res) => {
    const error = (e: any): void => {
      /* istanbul ignore next */
      logger.error('lookup/diff error', e)
      /* istanbul ignore next */
      Utils.send(res, 500, errMsg('unknown'))
    }
    tomServer.idServer.authenticate(req, res, (token) => {
      const timestamp = Utils.epoch()
      Utils.jsonContent(req, res, logger, (obj) => {
        Utils.validateParameters(res, schema, obj, logger, (data) => {
          tomServer.idServer.db
            .getHigherThan(
              'userHistory',
              ['address', 'active'],
              {
                timestamp: (data as DiffQueryBody).since
              },
              'address'
            )
            .then((rows) => {
              const uids = rows.map((row) => {
                return (row.address as string).replace(/^@(.*?):.*$/, '$1')
              })
              const fields = (data as { fields: string[] }).fields ?? []
              if (!fields.includes('uid')) fields.push('uid')
              tomServer.idServer.userDB
                .get('users', fields, { uid: uids })
                .then((userRows) => {
                  const newUsers: object[] = []
                  const deleted: object[] = []
                  const users: Record<string, object> = {}
                  userRows.forEach((user) => {
                    users[(user as { uid: string }).uid] = user
                  })
                  rows.forEach((row) => {
                    const matrixAddress = row.address as string
                    const uid = matrixAddress.replace(/^@(.*?):.*$/, '$1')
                    const user: object = users[uid]
                    // eslint-disable-next-line eqeqeq
                    if (row.active != 0) {
                      ;(user as Record<string, string>).address = matrixAddress
                      newUsers.push(user)
                    } else {
                      deleted.push({ uid, address: row.address as string })
                    }
                  })
                  const start = (data as DiffQueryBody).offset ?? 0
                  const end = start + ((data as DiffQueryBody).limit ?? 30)
                  Utils.send(res, 200, {
                    new: newUsers.slice(start, end),
                    deleted: deleted.slice(start, end),
                    timestamp
                  })
                })
                .catch(error)
            })
            .catch(error)
        })
      })
    })
  }
}

export default diff
