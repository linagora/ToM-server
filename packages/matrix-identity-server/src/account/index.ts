import type MatrixIdentityServer from '..'
import { send, type expressAppHandler } from '@twake/utils'
import { type tokenContent } from './register'

const Account = <T extends string = never>(
  idServer: MatrixIdentityServer<T>
): expressAppHandler => {
  return (req, res) => {
    idServer.authenticate(req, res, (idToken: tokenContent) => {
      send(res, 200, { user_id: idToken.sub })
    })
  }
}

export default Account
