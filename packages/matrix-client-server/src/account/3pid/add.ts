import {
  epoch,
  errMsg,
  send,
  validateParameters,
  type expressAppHandler
} from '@twake/utils'
import { type AuthenticationData } from '../../types'
import type MatrixClientServer from '../..'
import { allowedFlows } from '../../utils/userInteractiveAuthentication'

interface RequestBody {
  auth: AuthenticationData
  client_secret: string
  sid: string
}

const schema = {
  auth: false,
  client_secret: true,
  sid: true
}

const clientSecretRegex = /^[0-9a-zA-Z.=_-]{6,255}$/
const sidRegex = /^[0-9a-zA-Z.=_-]{1,255}$/
const matrixIdRegex = /^@[0-9a-zA-Z._=-]+:[0-9a-zA-Z.-]+$/

const add = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    clientServer.uiauthenticate(req, res, allowedFlows, (obj, userId) => {
      validateParameters(res, schema, obj, clientServer.logger, (obj) => {
        if (!clientSecretRegex.test((obj as RequestBody).client_secret)) {
          send(res, 400, errMsg('invalidParam', 'Invalid client_secret'))
          return
        }
        if (!sidRegex.test((obj as RequestBody).sid)) {
          send(res, 400, errMsg('invalidParam', 'Invalid session ID'))
          return
        }
        const body = obj as RequestBody
        clientServer.matrixDb
          .get(
            'threepid_validation_session',
            ['address', 'medium', 'validated_at'],
            {
              // Get the address from the validation session. This API has to be called after /requestToken, else it will send error 400
              client_secret: body.client_secret,
              session_id: body.sid
            }
          )
          .then((sessionRows) => {
            if (sessionRows.length === 0) {
              send(res, 400, errMsg('noValidSession'))
              return
            }
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            if (!sessionRows[0].validated_at) {
              send(res, 400, errMsg('sessionNotValidated'))
              return
            }
            clientServer.matrixDb
              .get('user_threepids', ['user_id'], {
                address: sessionRows[0].address
              })
              .then((rows) => {
                if (rows.length > 0) {
                  send(res, 400, errMsg('threepidInUse'))
                } else {
                  if (!matrixIdRegex.test(userId as string)) {
                    send(res, 400, errMsg('invalidParam', 'Invalid user ID'))
                    return
                  }
                  clientServer.matrixDb
                    .insert('user_threepids', {
                      user_id: userId as string,
                      address: sessionRows[0].address as string,
                      medium: sessionRows[0].medium as string,
                      validated_at: sessionRows[0].validated_at as number,
                      added_at: epoch()
                    })
                    .then(() => {
                      send(res, 200, {})
                    })
                    .catch((e) => {
                      // istanbul ignore next
                      clientServer.logger.error(
                        'Error while inserting user_threepids',
                        e
                      )
                      // istanbul ignore next
                      send(res, 400, errMsg('unknown', e))
                    })
                }
              })
              .catch((e) => {})
          })
          .catch((e) => {})
      })
    })
  }
}

export default add
