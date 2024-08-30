import type MatrixClientServer from '..'
import { type expressAppHandler, send, errMsg } from '@twake/utils'

interface Parameters {
  userId: string
}

interface connectionsContent {
  ip: string
  last_seen: number
  user_agent: string
}

interface sessionsContent {
  connections: connectionsContent[]
}

interface deviceContent {
  sessions: sessionsContent[]
}

const whois = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const parameters: Parameters = req.query as Parameters
    if (parameters.userId?.length != null) {
      clientServer.authenticate(req, res, (data, id) => {
        clientServer.matrixDb
          .get(
            'user_ips',
            ['device_id', 'ip', 'user_agent', 'last_seen', 'access_token'],
            {
              user_id: parameters.userId
            }
          )
          .then((rows) => {
            const sessions: Record<string, sessionsContent> = {}
            const devices: Record<string, deviceContent> = {}
            const deviceIds = Array.from(
              new Set(rows.map((row) => row.device_id as string))
            ) // Get all unique deviceIds
            const mappings: Record<string, string> = {} // Map deviceIds to access_tokens
            rows.forEach((row) => {
              mappings[row.device_id as string] = row.access_token as string
            })
            rows.forEach((row) => {
              if (sessions[row.access_token as string] == null) {
                sessions[row.access_token as string] = { connections: [] }
              }
              sessions[row.access_token as string].connections.push({
                ip: row.ip as string,
                last_seen: row.last_seen as number,
                user_agent: row.user_agent as string
              })
            })
            deviceIds.forEach((deviceId) => {
              if (devices[deviceId] == null) {
                devices[deviceId] = { sessions: [] }
              }
              devices[deviceId].sessions.push(sessions[mappings[deviceId]])
            })
            send(
              res,
              200,
              {
                user_id: parameters.userId,
                devices
              },
              clientServer.logger
            )
          })
          .catch((e) => {
            // istanbul ignore next
            clientServer.logger.error(
              'Error retrieving user informations from the MatrixDB'
            )
            // istanbul ignore next
            send(res, 500, errMsg('unknown', e.toString()), clientServer.logger)
          })
      })
    } else {
      send(res, 400, errMsg('missingParams'), clientServer.logger)
    }
  }
}

export default whois
