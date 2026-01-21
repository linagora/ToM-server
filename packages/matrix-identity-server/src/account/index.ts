import type MatrixIdentityServer from '../index.ts'
import { send, type expressAppHandler } from '@twake-chat/utils'
import { type tokenContent } from './register.ts'

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
