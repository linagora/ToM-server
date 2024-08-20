import { type expressAppHandler } from '@twake/utils'
import type MatrixClientServer from '.'
import { validateUserWithUIAuthentication } from './utils/userInteractiveAuthentication'
import { type AuthenticationData } from './types'

interface RequestBody {
  auth?: AuthenticationData
  devices: string[]
}

const reference = {}
const deleteDevices = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (data) => {
      validateUserWithUIAuthentication(
        clientServer,
        req,
        res,
        reference,
        data.sub,
        'remove device(s) from your account',
        (obj, userId) => {}
      )
    })
  }
}

export default deleteDevices
