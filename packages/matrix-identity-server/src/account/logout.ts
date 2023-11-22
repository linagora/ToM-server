import type MatrixIdentityServer from '..'
import { send, type expressAppHandler } from '../utils'
import { errMsg } from '../utils/errors'
import { type tokenContent } from './register'

const Logout = (idServer: MatrixIdentityServer): expressAppHandler => {
  return (req, res) => {
    // @ts-expect-error id is defined here
    idServer.authenticate(req, res, (idToken: tokenContent, id: string) => {
      idServer.db
        .deleteEqual('accessTokens', 'id', id)
        .then(() => {
          send(res, 200, {})
        })
        .catch((e) => {
          /* istanbul ignore next */
          idServer.logger.warn(`Unable to delete token ${id}`, e)
          /* istanbul ignore next */
          send(res, 500, errMsg('unknown', 'Unable to delete session'))
        })
    })
  }
}

export default Logout
