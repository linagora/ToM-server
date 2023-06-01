import { Utils, errMsg } from '@twake/matrix-identity-server'
import type TwakeServer from '../..'
import { type expressAppHandler } from '../../types'

const schema = {
  since: true,
  fields: false
}

const diff = (tomServer: TwakeServer): expressAppHandler => {
  return (req, res) => {
    const error = (e: any): void => {
      /* istanbul ignore next */
      console.error('lookup/diff error', e)
      /* istanbul ignore next */
      Utils.send(res, 500, errMsg('unknown'))
    }
    tomServer.idServer.authenticate(req, res, (token) => {
      const timestamp = Utils.epoch()
      Utils.jsonContent(req, res, (obj) => {
        Utils.validateParameters(res, schema, obj, (data) => {
          tomServer.idServer.db
            .getHigherThan('userHistory', ['address', 'active'], {
              timestamp: (data as { since: number }).since
            })
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
                  Utils.send(res, 200, {
                    new: newUsers,
                    deleted,
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
