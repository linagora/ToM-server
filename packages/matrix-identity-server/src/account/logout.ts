import type MatrixIdentityServer from '..'
import { errMsg, send, type expressAppHandler } from '@twake-chat/utils'
import { type tokenContent } from './register'

const Logout = <T extends string = never>(
  idServer: MatrixIdentityServer<T>
): expressAppHandler => {
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
          send(res, 401, errMsg('unknownToken'))
        })
    })
  }
}

export default Logout
