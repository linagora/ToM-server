/**
 * Implements the Capabilities negotiation of the Matrix Protocol (Client-Server)
 *  cf https://spec.matrix.org/latest/client-server-api/#capabilities-negotiation
 *
 * The capabilities will be stored in the server's configuration file.
 *
 * To be effectively taken into account, the concerned API's should check the capabilities to ensure it can be used.
 *
 * For reference, look at how the capabilities are checked in the `changeDisplayname` function. ( ../profiles/changeProfiles.ts )
 */

import type MatrixClientServer from '../index'
import { errMsg, send, type expressAppHandler } from '@twake/utils'

export const getCapabilities = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    clientServer.authenticate(req, res, (token) => {
      const requesterUserId = token.sub
      // TODO : Check if the requester has the rights to get the capabilities

      let capabilities: Record<string, any>
      try {
        capabilities = {
          //       "m.room_versions": {
          //           "default": self.config.server.default_room_version.identifier,
          //           "available": {
          //               v.identifier: v.disposition
          //               for v in KNOWN_ROOM_VERSIONS.values()
          //           },
          //   },
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
        send(
          res,
          500,
          errMsg('unknown', 'Error getting capabilities'),
          clientServer.logger
        )
        return
      }
      send(res, 200, JSON.stringify(capabilities), clientServer.logger)
    })
  }
}
