/**
 * Implements the Capabilities negotiation of the Matrix Protocol (Client-Server)
 *  cf https://spec.matrix.org/latest/client-server-api/#capabilities-negotiation
 *
 * The capabilities will be stored in the server's configuration file.
 *
 * To be effectively taken into account, the concerned API's should check the capabilities to ensure it can be used.
 *
 * For reference, look at how the capabilities are checked in the `changeDisplayname` function. ( ../profiles/changeProfiles.ts )
 *
 * TODO : Implement capability checks in the concerned API's for changing password and 3pid changes
 * (TODO : Implement capability checks in the concerned API's for user_directory search (not specified in spec))
 */

import type MatrixClientServer from '../index'
import { errMsg, send, type expressAppHandler } from '@twake/utils'
import { DEFAULT_ROOM_VERSION, ROOM_VERSIONS } from '../versions'

const getCapabilities = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (data) => {
      let _capabilities: Record<string, any>
      try {
        _capabilities = {
          'm.room_versions': {
            default: DEFAULT_ROOM_VERSION,
            available: {
              ...ROOM_VERSIONS
            }
          },
          'm.change_password': {
            enabled:
              clientServer.conf.capabilities.enable_change_password ?? true
          },
          'm.set_displayname': {
            enabled:
              clientServer.conf.capabilities.enable_set_displayname ?? true
          },
          'm.set_avatar_url': {
            enabled:
              clientServer.conf.capabilities.enable_set_avatar_url ?? true
          },
          'm.3pid_changes': {
            enabled: clientServer.conf.capabilities.enable_3pid_changes ?? true
          }
        }
      } catch (e) {
        /* istanbul ignore next */
        send(
          res,
          500,
          errMsg('unknown', 'Error getting capabilities'),
          clientServer.logger
        )
        /* istanbul ignore next */
        return
      }
      send(res, 200, { capabilities: _capabilities }, clientServer.logger)
    })
  }
}

export default getCapabilities
