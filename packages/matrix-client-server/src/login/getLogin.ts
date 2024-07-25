import { type expressAppHandler, send } from '@twake/utils'
import type MatrixClientServer from '..'

// TODO : Modify default value of sso login in config
const getLogin = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    send(res, 200, clientServer.conf.login_flows, clientServer.logger)
  }
}

export default getLogin
