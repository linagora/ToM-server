import {
  errMsg,
  expressAppHandler,
  jsonContent,
  send,
  validateParameters
} from '@twake/utils'
import MatrixClientServer from '..'
import { type UserIdentifier } from '../types'

interface LoginRequestBody {
  device_id?: string
  identifier: UserIdentifier
  initial_device_display_name?: string
  password?: string
  refresh_token?: boolean
  token?: string
  type: 'm.login.password' | 'm.login.token'
}

const schema = {
  device_id: false,
  identifier: true,
  initial_device_display_name: false,
  password: false,
  refresh_token: false,
  token: false,
  type: true
}

const postLogin = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    jsonContent(req, res, clientServer.logger, (obj) => {
      validateParameters(res, schema, obj, clientServer.logger, (obj) => {
        const body = obj as LoginRequestBody
        switch (body.type) {
          case 'm.login.password':
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            if (!body.password) {
              clientServer.logger.error('Missing password')
              send(res, 400, errMsg('missingParam', 'password'))
            }
        }
      })
    })
  }
}

export default postLogin
