import type MatrixClientServer from '..'
import { type expressAppHandler, send, errMsg } from '@twake/utils'

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

const mxidRe = /^@[0-9a-zA-Z._=-]+:[0-9a-zA-Z.-]+$/

const whois = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const userId: string = req.params.userId as string
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (mxidRe.test(userId)) {
      clientServer.authenticate(req, res, (data, id) => {
        clientServer.matrixDb
          .get(
            'user_ips',
            ['device_id', 'ip', 'user_agent', 'last_seen', 'access_token'],
            {
              user_id: userId
            }
          )
          .then((rows) => {
            if (rows.length === 0) {
              clientServer.logger.error('User not found')
              send(res, 400, errMsg('invalidParam'))
              return
            }
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
            send(res, 200, {
              user_id: userId,
              devices
            })
          })
          .catch((err) => {
            // istanbul ignore next
            clientServer.logger.error(
              'Error retrieving user informations from the MatrixDB',
              err
            )
            // istanbul ignore next
            send(res, 500, errMsg('unknown'))
          })
      })
    } else {
      clientServer.logger.error('Wrong Matrix user ID format')
      send(res, 400, errMsg('invalidParam'))
    }
  }
}

export default whois
